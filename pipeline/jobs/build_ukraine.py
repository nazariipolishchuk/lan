"""Build the web data for all of Ukraine, oblast by oblast (PLAN 4.0).

Every step caches its result under work/ua/<oblast code>/, so a crashed or interrupted run continues
where it stopped. Steps:

  split            fields parts → one fields folder per oblast (one pass over the 16 parts)
  prep CODE…       soil (SoilGrids) and terrain (NASADEM, in 1° blocks to bound memory) per oblast
  tiles-index      which HLS tile holds which field (ids of one season per tile)
  oblast CODE…     curves → crop history (saved models) → now/bare → chunk fragments → GeoJSONSeq input
  validate [CODE…] group model vs KPI maps on one tile per oblast outside Cherkasy → work/metrics_ua.json
  merge            fragments of every oblast → out/fields/{ck}.json.gz, out/curves/{ck}.json.gz, meta.json
  geojson CODE…    GeoJSONSeq per oblast with layer values (needs work/ua/scores.json from batch-score.ts),
                   then out/oblasts.json (oblast outlines with the layers summarised, for small scales)

Usage: uv run python jobs/build_ukraine.py <step> [codes…|all]
"""

from __future__ import annotations

import argparse
import gzip
import json
import logging
import shutil
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow.parquet as pq

import os

from lan.config import DATA_DIR, RAW_DIR, WORK_DIR
from lan.fields import OBLASTS as _UA_OBLASTS, load_fields
from lan.us_fields import STATES

# LAN_REGION=us builds the USA from work/fields_us (CSB 2018–2025) into data/out_us, state by state; the
# state plays the oblast's role. Ukraine stays the default.
REGION = os.environ.get("LAN_REGION", "ua")
if REGION == "us":
    OBLASTS = dict(STATES)
    UA = WORK_DIR / "us"
    NDVI = WORK_DIR / "ndvi_us"
    FIELDS_SRC = WORK_DIR / "fields_us"
    OUT_DIR = DATA_DIR / "out_us"
    CODES = list(OBLASTS)
else:
    OBLASTS = _UA_OBLASTS
    UA = WORK_DIR / "ua"
    NDVI = WORK_DIR / "ndvi"
    FIELDS_SRC = WORK_DIR / "fields"
    OUT_DIR = DATA_DIR / "out"
    # Kyiv City and Sevastopol hold almost no farmland; Crimea is processed like any other oblast
    CODES = [c for c in OBLASTS if c not in ("30", "40")]


def log(msg: str) -> None:
    print(f"{time.strftime('%H:%M:%S')} {msg}", flush=True)


def codes_arg(xs: list[str]) -> list[str]:
    return CODES if not xs or xs == ["all"] else xs


# ---------- split ----------

def split() -> None:
    """One pass over work/fields/*.parquet: rows of each oblast go to ua/<code>/fields/<part>.parquet."""
    names = {v: k for k, v in OBLASTS.items()}
    for part in sorted(FIELDS_SRC.glob("*.parquet")):
        t = pq.read_table(part)
        ob = t.column("oblast").to_pandas()
        for name, idx in ob.groupby(ob).groups.items():
            code = names[name]
            d = UA / code / "fields"
            d.mkdir(parents=True, exist_ok=True)
            pq.write_table(t.take(np.asarray(idx)), d / part.name)
        log(f"split {part.name}: {t.num_rows} rows")


def oblast_fields(code: str, columns=None):
    return load_fields(UA / code / "fields", columns=columns)


def oblast_table(code: str, columns: list[str]) -> pd.DataFrame:
    """Attribute columns of an oblast's fields without decoding geometry (fast for 1 M-field US states)."""
    t = pq.read_table(UA / code / "fields", columns=columns).to_pandas()
    return t.drop_duplicates("id") if "id" in t.columns else t


# ---------- soil and terrain ----------

def prep(code: str) -> None:
    from lan import soil, terrain

    d = UA / code
    f = oblast_fields(code)
    if not (d / "soil.parquet").exists():
        t = time.time()
        s = None
        for attempt in range(3):  # SoilGrids is read over the network; a failed window read is retried
            try:
                s = soil.build(f[["id", "lon", "lat"]])
                break
            except Exception as e:
                log(f"{code} soil attempt {attempt + 1} failed: {e}")
                time.sleep(10)
        if s is None:
            log(f"{code} soil skipped (fields keep 'soil unknown')")
            s = pd.DataFrame(index=f["id"].to_numpy(), columns=["clay", "sand", "soc", "ph"], dtype="float64")
        s.to_parquet(d / "soil.parquet")
        log(f"{code} soil: {len(s)} fields, missing {int(s['clay'].isna().sum())}, {time.time() - t:.0f}s")
    if not (d / "terrain.parquet").exists():
        t = time.time()
        blocks = []
        key = np.floor(f["lon"]).astype(int).astype(str) + "_" + np.floor(f["lat"]).astype(int).astype(str)
        for _, g in f.groupby(key):
            try:
                blocks.append(terrain.build(g.reset_index(drop=True), RAW_DIR / "nasadem"))
            except Exception as e:  # a failed block leaves its fields without terrain, never stops the build
                log(f"{code} terrain block failed: {e}")
        tr = pd.concat(blocks) if blocks else pd.DataFrame(columns=["slope", "slopeP90", "elev"])
        tr.to_parquet(d / "terrain.parquet")
        log(f"{code} terrain: {len(tr)} fields, missing {int(tr['slope'].isna().sum())}, {time.time() - t:.0f}s")


# ---------- HLS tile index ----------

def tiles_index() -> None:
    """(tile, id) for every processed tile, from the ids of one season (all seasons of a tile share them)."""
    rows = []
    seen = set()
    for ok in sorted(NDVI.glob("*.ok")):
        tile = ok.stem.split("_")[0]
        p = ok.with_suffix(".parquet")
        if tile in seen or not p.exists():
            continue
        ids = pd.read_parquet(p, columns=["id"])["id"].unique()
        if len(ids) == 0:
            continue
        seen.add(tile)
        rows.append(pd.DataFrame({"tile": tile, "id": ids}))
    idx = pd.concat(rows, ignore_index=True)
    idx.to_parquet(UA / "tile_ids.parquet", index=False)
    log(f"tile index: {idx['tile'].nunique()} tiles, {idx['id'].nunique()} fields")


def load_obs_for(ids: set[str], tiles: list[str]) -> pd.DataFrame:
    parts = []
    for tile in tiles:
        for ok in sorted(NDVI.glob(f"{tile}_*.ok")):
            p = ok.with_suffix(".parquet")
            if not p.exists():
                continue
            d = pd.read_parquet(p, columns=["id", "date", "ndvi", "frac"])
            d = d[d["id"].isin(ids)]
            d["tile"] = tile
            parts.append(d)
    return pd.concat(parts, ignore_index=True) if parts else pd.DataFrame(columns=["id", "date", "ndvi", "frac", "tile"])


# ---------- one oblast ----------

def oblast(code: str, models) -> dict:
    from lan.classify import predict_history
    from lan.curves import autumn_state, bare_days, build_curves, home_tile
    from lan.export import history_items, write_chunks, write_curve_chunks

    d = UA / code
    done = d / "oblast.json"
    if done.exists():
        return json.loads(done.read_text(encoding="utf-8"))
    t0 = time.time()
    f = oblast_fields(code, columns=["id", "ftw_id", "ha", "conf", "lon", "lat", "ck", "cell", "oblast", "small"])
    ids = set(f["id"])
    tix = pd.read_parquet(UA / "tile_ids.parquet")
    tiles = sorted(set(tix.loc[tix["id"].isin(ids), "tile"]))
    soil = pd.read_parquet(d / "soil.parquet") if (d / "soil.parquet").exists() else None
    terr = pd.read_parquet(d / "terrain.parquet") if (d / "terrain.parquet").exists() else None
    hist, now, bare, curves, years = {}, {}, {}, None, []
    if tiles:
        obs = load_obs_for(ids, tiles)
        log(f"{code} {OBLASTS[code]}: {len(f)} fields, {len(tiles)} tiles, {len(obs):,} looks")
        ht = home_tile(obs)
        cur = build_curves(obs)
        cur.columns = [f"d{k}" for k in cur.columns]
        curves = cur.reset_index()
        years = sorted(int(y) for y in curves["y"].unique())
        h = predict_history(curves, *models)
        h["tile"] = h["id"].map(ht)
        h.to_parquet(d / "history.parquet", index=False)
        hist = history_items(h)
        cols = [c for c in curves.columns if c.startswith("d")]
        now_year = years[-1]
        last = obs[pd.to_datetime(obs["date"]).dt.year == now_year].groupby("id")["date"].max()
        del obs
        cur_now = curves[curves["y"] == now_year].set_index("id")[cols]
        now = {i: autumn_state(cur_now.loc[i].to_numpy(dtype=np.float32), pd.Timestamp(last[i]).date())
               for i in cur_now.index if i in last.index}
        prev = curves[curves["y"] < now_year]
        bare = {i: bare_days(list(g[cols].to_numpy(dtype=np.float32))) for i, g in prev.groupby("id")}
    if REGION == "us":
        hist = merge_cdl(f["id"], hist)
    out = d / "out"
    shutil.rmtree(out, ignore_errors=True)
    n = write_chunks(f, out, soil, terr, hist, now, bare)
    nc = write_curve_chunks(f[~f["small"]], curves[curves["id"].isin(set(f.loc[~f["small"], "id"]))], out, years) \
        if curves is not None else 0
    info = {"code": code, "oblast": OBLASTS[code], "fields": len(f), "withHistory": len(hist), "tiles": tiles,
            "years": years, "chunks": n, "curveChunks": nc, "bbox": [round(float(x), 4) for x in f.total_bounds],
            "seconds": round(time.time() - t0)}
    if hist:
        hdf = pd.read_parquet(d / "history.parquet")
        last_season = hdf[hdf["y"] == years[-1]]
        info["lastSeason"] = {"year": years[-1], "groups": last_season.loc[last_season["pg"] >= 0.6, "g"].value_counts().to_dict(),
                              "unknown": int((last_season["k"] == "unknown").sum())}
    done.write_text(json.dumps(info, indent=1), encoding="utf-8")
    log(f"{code} done: {json.dumps({k: info[k] for k in ('fields', 'withHistory', 'chunks', 'curveChunks', 'seconds')})}")
    return info


def merge_cdl(ids, hist: dict) -> dict:
    """USA: seasons 2018–2025 from the USDA crop sequence (CDL codes), the rest from our HLS model."""
    from lan.cdl import cdl_items

    want = set(ids)
    cols = [f"CDL{y}" for y in range(2018, 2026)]
    out = dict(hist)
    for p in sorted((WORK_DIR / "crops_us").glob("*.parquet")):
        c = pd.read_parquet(p)
        c = c[c["id"].isin(want)]
        for row in c.itertuples(index=False):
            codes = {2018 + i: getattr(row, col) for i, col in enumerate(cols)}
            items = [it for it in out.get(row.id, []) if not (2018 <= it["y"] <= 2025)]
            out[row.id] = sorted(items + cdl_items(codes), key=lambda it: it["y"])
    return out


# ---------- out-of-region validation ----------

# One HLS tile per zone the model never saw (it was trained in Cherkasy, Forest-Steppe). The tile with the
# most fields of the oblast is used, so the KPI raster is read over one 110 km square only.
VALIDATE = {"51": "Steppe, south (Odesa)", "63": "Steppe/Forest-Steppe, east (Kharkiv)",
            "07": "Polissia, north-west (Volyn)", "46": "West (Lviv)", "12": "Steppe, centre (Dnipropetrovsk)"}


def validate(codes: list[str]) -> None:
    """Group model vs the KPI winter/summer map 2019–2024 on fields ≥ 2 ha of one tile per oblast."""
    from lan.classify import GROUPS, evaluate
    from lan.labels import kpi_labels

    res = json.loads((WORK_DIR / "metrics_ua.json").read_text(encoding="utf-8")) if (WORK_DIR / "metrics_ua.json").exists() else {}
    for code in codes:
        if code in res:
            continue
        d = UA / code
        h = pd.read_parquet(d / "history.parquet")
        h = h[(h["y"] >= 2019) & (h["y"] <= 2024) & (h["k"] != "unknown")]
        tile = h["tile"].value_counts().index[0]
        f = oblast_fields(code, columns=["id", "small"])
        f = f[(~f["small"]) & f["id"].isin(set(h.loc[h["tile"] == tile, "id"]))]
        t = time.time()
        lab = kpi_labels(RAW_DIR / "kpi", f[["id", "geometry"]]).dropna()
        m = h.merge(lab, on=["id", "y"])
        ev = evaluate(m["group"], m["g"], GROUPS)
        ev.update({"oblast": OBLASTS[code], "zone": VALIDATE.get(code, ""), "tile": tile, "fields": int(m["id"].nunique()),
                   "seconds": round(time.time() - t)})
        res[code] = ev
        (WORK_DIR / "metrics_ua.json").write_text(json.dumps(res, indent=1), encoding="utf-8")
        log(f"{code} {OBLASTS[code]} tile {tile}: accuracy {ev['accuracy']}, macro-F1 {ev['macroF1']}, "
            f"F1 {ev['perClass']}, n {ev['n']}")


# ---------- merge ----------

def _dump_gz(path: Path, obj) -> int:
    raw = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    path.write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
    return path.stat().st_size


def merge() -> None:
    """Fragments of all oblasts → out/fields and out/curves (gzip JSON), plus meta.json."""
    from lan.export import write_meta

    infos = [json.loads((UA / c / "oblast.json").read_text(encoding="utf-8")) for c in CODES if (UA / c / "oblast.json").exists()]
    for kind, key in (("fields", "fields"), ("curves", "curves")):
        dst = OUT_DIR / kind
        shutil.rmtree(dst, ignore_errors=True)
        dst.mkdir(parents=True)
        frags: dict[str, list[Path]] = {}
        for i in infos:
            for p in (UA / i["code"] / "out" / kind).glob("*.json"):
                frags.setdefault(p.stem, []).append(p)
        size = 0
        for ck, ps in frags.items():
            docs = [json.loads(p.read_text(encoding="utf-8")) for p in ps]
            doc = docs[0]
            for o in docs[1:]:
                if kind == "fields":
                    doc["fields"].extend(o["fields"])
                else:
                    assert o["years"] == doc["years"], f"curve years differ in chunk {ck}"
                    doc["curves"].update(o["curves"])
            size += _dump_gz(dst / f"{ck}.json.gz", doc)
        log(f"{kind}: {len(frags)} chunks, {size / 1e6:.1f} MB gzip")
    tiles = sorted({t for i in infos for t in i["tiles"]})
    if REGION == "us":
        # USA history 2018–2025 is USDA's own crop record; accuracy numbers of the Ukrainian model do not apply
        write_meta(OUT_DIR, sorted({t for i in infos for t in i["tiles"]}), None,
                   oblasts={i["code"]: {"name": i["oblast"], "fields": i["fields"], "withHistory": i["withHistory"],
                                        "bbox": i["bbox"], "tiles": f"tiles/fields-{i['code']}.pmtiles"} for i in infos})
        log(f"meta (USA): {len(infos)} states, {sum(i['fields'] for i in infos)} fields")
        return
    metrics = json.loads((WORK_DIR / "metrics.json").read_text(encoding="utf-8"))
    g = metrics["group"]
    acc = {"macroF1": g["macroF1"], "perClass": g["perClass"], "n": g["n"], "labelSource": g["labelSource"],
           "accuracy": g["accuracy"], "testTiles": g["testTiles"], "confusion": g["confusion"], "labels": g["labels"],
           "crop": {k: metrics["crop"][k] for k in ("macroF1", "accuracy", "perClass", "n", "labelSource", "testTiles")}}
    if (WORK_DIR / "metrics_ua.json").exists():
        acc["ukraine"] = json.loads((WORK_DIR / "metrics_ua.json").read_text(encoding="utf-8"))
    oblasts = {i["code"]: {"name": i["oblast"], "fields": i["fields"], "withHistory": i["withHistory"],
                           "bbox": i["bbox"], "tiles": f"tiles/fields-{i['code']}.pmtiles"} for i in infos}
    write_meta(OUT_DIR, tiles, acc, oblasts=oblasts)
    log(f"meta: {len(infos)} oblasts, {sum(i['fields'] for i in infos)} fields, "
        f"{sum(i['withHistory'] for i in infos)} with history, {len(tiles)} HLS tiles")


# ---------- GeoJSONSeq for tippecanoe ----------

def geojson(code: str, scores: dict) -> None:
    from lan.export import write_geojsonseq

    d = UA / code
    f = oblast_fields(code)
    hist = {}
    if (d / "history.parquet").exists():
        from lan.export import history_items
        hist = history_items(pd.read_parquet(d / "history.parquet"))
    write_geojsonseq(f, d / f"fields-{code}.geojsonseq", hist, scores)
    log(f"{code} geojsonseq: {len(f)} features")


def oblast_layer(scores: dict) -> None:
    """out/oblasts.json: simplified oblast outlines (geoBoundaries, ODbL) with the map layers' values
    summarised per oblast, drawn below the zoom where single fields appear."""
    from lan.export import LAST_GROUPS, history_items, last_group

    if REGION == "us":
        import shapely
        from shapely.geometry import mapping, shape

        from lan.us_fields import POSTAL

        src = json.loads((RAW_DIR / "admin" / "usa_adm1_simplified.geojson").read_text(encoding="utf-8"))
        feats0 = []
        for ft in src["features"]:
            post = ft["properties"]["shapeISO"].split("-")[1]
            if post not in POSTAL:
                continue  # Alaska, Hawaii, territories: no CSB fields
            g = shapely.simplify(shape(ft["geometry"]), 0.01, preserve_topology=True)
            ft = {**ft, "geometry": mapping(g), "properties": {**ft["properties"], "shapeISO": f"US-{POSTAL[post]}"}}
            feats0.append(ft)
        src = {"features": feats0}
    else:
        src = json.loads((RAW_DIR / "admin" / "ukr_adm1_simplified.geojson").read_text(encoding="utf-8"))

    def rnd(c):
        return [rnd(x) for x in c] if isinstance(c[0], list) else [round(c[0], 3), round(c[1], 3)]

    feats = []
    for ft in src["features"]:
        code = ft["properties"]["shapeISO"].split("-")[1]
        props: dict = {"code": code, "name": OBLASTS.get(code, ft["properties"]["shapeName"]), "fields": 0, "hist": 0}
        d = UA / code
        if (d / "oblast.json").exists():
            f = oblast_table(code, ["id", "small"])
            hist = history_items(pd.read_parquet(d / "history.parquet")) if (d / "history.parquet").exists() else {}
            lg = np.array([last_group(hist.get(i)) for i in f["id"]])
            known = lg >= 0
            sc = [scores.get(i, {}) for i in f["id"]]
            dr = np.array([s.get("dr", -1) for s in sc])
            rh = np.array([s.get("rh", -1) for s in sc])
            props.update({
                "fields": int(len(f)), "hist": int(sum(1 for i in f["id"] if i in hist)),
                # share of fields with a confident latest season that carried a winter crop, %
                "lgw": round(100 * float((lg == LAST_GROUPS.index("winter")).sum()) / max(1, int(known.sum()))) if known.sum() >= 100 else -1,
                "dr": int(np.median(dr[dr >= 0])) if (dr >= 0).any() else -1,
                "rh": int(np.median(rh[rh >= 0])) if (rh >= 0).sum() >= 100 else -1,
                "rhn": int((rh >= 0).sum()),
            })
        feats.append({"type": "Feature", "properties": props,
                      "geometry": {"type": ft["geometry"]["type"], "coordinates": rnd(ft["geometry"]["coordinates"])}})
    attribution = ("geoBoundaries gbOpen USA ADM1 (U.S. Census Bureau TIGER, public domain)" if REGION == "us"
                   else "geoBoundaries gbOpen UKR ADM1 (OpenStreetMap, ODbL 1.0)")
    out = {"type": "FeatureCollection", "attribution": attribution, "features": feats}
    (OUT_DIR / "oblasts.json").write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    log(f"oblasts.json: {len(feats)} oblasts, {(OUT_DIR / 'oblasts.json').stat().st_size / 1e3:.0f} KB")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["split", "prep", "tiles-index", "oblast", "validate", "merge", "geojson"])
    ap.add_argument("codes", nargs="*")
    ap.add_argument("--force", action="store_true", help="geojson: rewrite existing files")
    ap.add_argument("--layer", action="store_true", help="geojson: also write oblasts.json for these codes")
    a = ap.parse_args()
    logging.disable(logging.WARNING)
    UA.mkdir(parents=True, exist_ok=True)
    if a.step == "split":
        split()
    elif a.step == "prep":
        from lan.config import earthdata_login
        earthdata_login()
        for c in codes_arg(a.codes):
            prep(c)
    elif a.step == "tiles-index":
        tiles_index()
    elif a.step == "oblast":
        from lan.classify import load_models
        models = load_models(WORK_DIR / "models.pkl")
        for c in codes_arg(a.codes):
            oblast(c, models)
    elif a.step == "validate":
        validate(a.codes or list(VALIDATE))
    elif a.step == "merge":
        merge()
    elif a.step == "geojson":
        codes = [c for c in codes_arg(a.codes) if (UA / c / "oblast.json").exists()]
        if (UA / "scores.tsv").exists():  # large builds: read only the fields of the requested regions
            sc = pd.read_csv(UA / "scores.tsv", sep="	", dtype={"id": str, "rh": "int16", "dr": "int16"})
            want = set()
            for c in codes:
                want |= set(oblast_table(c, ["id"])["id"])
            sc = sc[sc["id"].isin(want)]
            scores = {i: {"rh": int(r), "dr": int(d)} for i, r, d in zip(sc["id"], sc["rh"], sc["dr"])}
        else:
            scores = json.loads((UA / "scores.json").read_text(encoding="utf-8"))
        for c in codes:
            if not (UA / c / f"fields-{c}.geojsonseq").exists() or a.force:
                geojson(c, scores)
        if not a.codes or a.codes == ["all"] or a.layer:
            oblast_layer(scores)
    return 0


if __name__ == "__main__":
    sys.exit(main())
