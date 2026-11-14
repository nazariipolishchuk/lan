"""Export the web data (contract §7.6): out/fields/{ck}.json, out/meta.json, and a GeoJSONSeq for
tippecanoe (feature properties id, ck, ha, k, rh, f)."""

from __future__ import annotations

import datetime as dt
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

FLAG_BITS = {"small": 1, "low_conf": 2, "no_history": 4}
CONFIDENCE = 0.6  # the engine's threshold (web/src/engine/precursors.ts)


def _num(x, nd=1):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(float(x), nd)


def field_record(row, soil: pd.DataFrame | None, terrain: pd.DataFrame | None, hist=None, now=None,
                 bare_days=None) -> dict:
    s = soil.loc[row.id] if soil is not None and row.id in soil.index else None
    t = terrain.loc[row.id] if terrain is not None and row.id in terrain.index else None
    soil_rec = None
    if s is not None and all(np.isfinite(s[k]) for k in ("clay", "sand", "soc", "ph")):
        soil_rec = {"clay": _num(s["clay"]), "sand": _num(s["sand"]), "soc": _num(s["soc"], 2), "ph": _num(s["ph"])}
    terr = None
    if t is not None and all(np.isfinite(t[k]) for k in ("slope", "slopeP90", "elev")):
        terr = {"slope": _num(t["slope"]), "slopeP90": _num(t["slopeP90"]), "elev": _num(t["elev"], 0)}
    hist = hist or []
    flags = []
    if row.small:
        flags.append("small")
    if not hist:
        flags.append("no_history")
    elif sum(h["p"] >= CONFIDENCE for h in hist) < len(hist) / 2:
        flags.append("low_conf")
    return {
        "id": row.id, "c": [round(row.lon, 5), round(row.lat, 5)], "ha": round(float(row.ha), 2),
        "adm": {"oblast": row.oblast, "raion": ""}, "cell": row.cell, "soil": soil_rec, "terrain": terr,
        "hist": hist, "now": now, "bareDays": bare_days, "flags": flags,
    }


def history_items(h: pd.DataFrame) -> dict[str, list[dict]]:
    """history.parquet rows → contract HistoryItem lists per field (y, k, p, src, g)."""
    out: dict[str, list[dict]] = {}
    for r in h.sort_values(["id", "y"]).itertuples(index=False):
        item = {"y": int(r.y), "k": r.k, "p": float(r.p), "src": "model"}
        if r.k != "unknown" and r.pg >= CONFIDENCE:  # group only where the group model is confident
            item["g"] = r.g
        out.setdefault(r.id, []).append(item)
    return out


def write_chunks(fields: pd.DataFrame, out_dir: Path, soil=None, terrain=None, hist=None, now=None,
                 bare=None) -> int:
    d = out_dir / "fields"
    d.mkdir(parents=True, exist_ok=True)
    hist, now, bare = hist or {}, now or {}, bare or {}
    n = 0
    for ck, g in fields.groupby("ck"):
        recs = [field_record(r, soil, terrain, hist.get(r.id), now.get(r.id), bare.get(r.id))
                for r in g.itertuples(index=False)]
        (d / f"{ck}.json").write_text(json.dumps({"v": 1, "ck": ck, "fields": recs}, separators=(",", ":"),
                                                 ensure_ascii=False), encoding="utf-8")
        n += 1
    return n


def write_curve_chunks(fields: pd.DataFrame, curves: pd.DataFrame, out_dir: Path, years: list[int]) -> int:
    """Contract CurveChunk: per field all seasons concatenated (len(years) × 27 values)."""
    from lan.curves import D0, D1, encode_curve

    d = out_dir / "curves"
    d.mkdir(parents=True, exist_ok=True)
    cols = [f"d{k}" for k in range(D0, D1 + 1)]
    full = pd.MultiIndex.from_product([sorted(set(curves["id"])), years], names=["id", "y"])
    a = curves.set_index(["id", "y"])[cols].reindex(full)
    arr = a.to_numpy(dtype=np.float32).reshape(-1, len(years) * len(cols))
    enc = {i: encode_curve(arr[j]) for j, i in enumerate(a.index.get_level_values(0)[:: len(years)])}
    n = 0
    for ck, g in fields.groupby("ck"):
        cur = {i: enc[i] for i in g["id"] if i in enc}
        if not cur:
            continue
        (d / f"{ck}.json").write_text(json.dumps({"v": 1, "ck": ck, "years": years, "dekads": list(range(D0, D1 + 1)),
                                                  "curves": cur}, separators=(",", ":")), encoding="utf-8")
        n += 1
    return n


HIST_CODES = ["winter_cereal", "spring_cereal", "rapeseed", "maize", "sunflower", "soy", "sugar_beet", "other"]


def last_code(items: list[dict] | None) -> int:
    """Index in HIST_CODES of the last confident season, −1 if none."""
    for it in reversed(items or []):
        if it["p"] >= CONFIDENCE and it["k"] in HIST_CODES:
            return HIST_CODES.index(it["k"])
    return -1


def write_geojsonseq(fields, path: Path, hist: dict | None = None) -> None:
    """One feature per line for tippecanoe; k = last confident class code (−1 unknown), rh = rotation health (−1)."""
    import shapely

    hist = hist or {}
    with path.open("w", encoding="utf-8") as fh:
        for r, geom in zip(fields.itertuples(index=False), fields.geometry):
            f = FLAG_BITS["small"] if r.small else 0
            h = hist.get(r.id)
            if not h:
                f |= FLAG_BITS["no_history"]
            props = {"id": r.id, "ck": r.ck, "ha": round(float(r.ha), 1), "k": last_code(h), "rh": -1, "f": f}
            fh.write(json.dumps({"type": "Feature", "properties": props,
                                 "geometry": json.loads(shapely.to_geojson(shapely.set_precision(geom, 1e-6)))}) + "\n")


def write_meta(out_dir: Path, history_tiles: list[str], accuracy=None) -> None:
    sources = [
        {"id": "hls_vi", "name": "NASA HLS Vegetation Indices", "version": "2.0", "licence": "NASA open data"},
        {"id": "power", "name": "NASA POWER daily (MERRA-2)", "version": "v2", "licence": "NASA open data"},
        {"id": "nasadem", "name": "NASA NASADEM", "version": "001", "licence": "NASA open data"},
        {"id": "ftw", "name": "Fields of The World, global field boundaries 2025", "version": "2026", "licence": "CC-BY-4.0"},
        {"id": "soilgrids", "name": "ISRIC SoilGrids", "version": "2.0", "licence": "CC-BY-4.0"},
        {"id": "kpi_wb", "name": "KPI winter/summer crop maps of Ukraine 2019–2024 (World Bank DDH 0066913)", "version": "2025", "licence": "CC-BY-4.0"},
    ]
    meta = {"v": 1, "built": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "coverage": {"historyTiles": history_tiles, "climateOnly": False}, "accuracy": accuracy, "sources": sources}
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")


if __name__ == "__main__":
    import sys

    from lan.config import OUT_DIR, WORK_DIR
    from lan.fields import load_fields

    src = Path(sys.argv[1]) if len(sys.argv) > 1 else WORK_DIR / "cherkasy.parquet"
    f = load_fields(src)
    from lan.curves import D0, autumn_state, bare_days, load_obs

    soil = pd.read_parquet(WORK_DIR / "soil_cherkasy.parquet")
    terrain = pd.read_parquet(WORK_DIR / "terrain_cherkasy.parquet")
    hist_df = pd.read_parquet(WORK_DIR / "history.parquet")
    curves = pd.read_parquet(WORK_DIR / "curves.parquet")
    years = sorted(int(y) for y in curves["y"].unique())
    cols = [c for c in curves.columns if c.startswith("d")]
    now_year = years[-1]
    obs = load_obs(WORK_DIR / "ndvi", set(f["id"]))
    last = obs[pd.to_datetime(obs["date"]).dt.year == now_year].groupby("id")["date"].max()
    cur_now = curves[curves["y"] == now_year].set_index("id")[cols]
    now = {i: autumn_state(cur_now.loc[i].to_numpy(dtype=np.float32), pd.Timestamp(last[i]).date())
           for i in cur_now.index if i in last.index}
    by_field = {i: [r for r in g[cols].to_numpy(dtype=np.float32)] for i, g in curves[curves["y"] < now_year].groupby("id")}
    bare = {i: bare_days(v) for i, v in by_field.items()}
    hist = history_items(hist_df)
    n = write_chunks(f, OUT_DIR, soil, terrain, hist, now, bare)
    nc = write_curve_chunks(f, curves, OUT_DIR, years)
    write_geojsonseq(f, WORK_DIR / "cherkasy.geojsonseq", hist)
    tiles = sorted(set(pd.read_parquet(WORK_DIR / "home_tile.parquet")["tile"]))
    metrics = json.loads((WORK_DIR / "metrics.json").read_text(encoding="utf-8"))
    g = metrics["group"]
    acc = {"macroF1": g["macroF1"], "perClass": g["perClass"], "n": g["n"], "labelSource": g["labelSource"],
           "accuracy": g["accuracy"], "testTiles": g["testTiles"],
           "crop": {k: metrics["crop"][k] for k in ("macroF1", "accuracy", "perClass", "n", "labelSource", "testTiles")}}
    write_meta(OUT_DIR, tiles, acc)
    states = pd.Series([v["state"] for v in now.values()]).value_counts().to_dict()
    print(f"chunks: {n}, curve chunks: {nc}, fields: {len(f)}, with history: {len(hist)}, now: {states}")
