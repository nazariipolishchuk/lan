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
    return {
        "id": row.id, "c": [round(row.lon, 5), round(row.lat, 5)], "ha": round(float(row.ha), 2),
        "adm": {"oblast": row.oblast, "raion": ""}, "cell": row.cell, "soil": soil_rec, "terrain": terr,
        "hist": hist, "now": now, "bareDays": bare_days, "flags": flags,
    }


def write_chunks(fields: pd.DataFrame, out_dir: Path, soil=None, terrain=None) -> int:
    d = out_dir / "fields"
    d.mkdir(parents=True, exist_ok=True)
    n = 0
    for ck, g in fields.groupby("ck"):
        recs = [field_record(r, soil, terrain) for r in g.itertuples(index=False)]
        (d / f"{ck}.json").write_text(json.dumps({"v": 1, "ck": ck, "fields": recs}, separators=(",", ":"),
                                                 ensure_ascii=False), encoding="utf-8")
        n += 1
    return n


def write_geojsonseq(fields, path: Path) -> None:
    """One feature per line for tippecanoe; k = last crop code (−1 unknown), rh = rotation health (−1)."""
    import shapely

    with path.open("w", encoding="utf-8") as fh:
        for r, geom in zip(fields.itertuples(index=False), fields.geometry):
            f = FLAG_BITS["small"] if r.small else 0
            props = {"id": r.id, "ck": r.ck, "ha": round(float(r.ha), 1), "k": -1, "rh": -1, "f": f | FLAG_BITS["no_history"]}
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
    soil = pd.read_parquet(WORK_DIR / "soil_cherkasy.parquet")
    terrain = pd.read_parquet(WORK_DIR / "terrain_cherkasy.parquet")
    n = write_chunks(f, OUT_DIR, soil, terrain)
    write_geojsonseq(f, WORK_DIR / "cherkasy.geojsonseq")
    write_meta(OUT_DIR, [])
    print(f"chunks: {n}, fields: {len(f)}")
