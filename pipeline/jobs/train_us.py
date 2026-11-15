"""Crop-name model trained across the USA (CDL 2023–2025 labels on our HLS curves) and its Ukrainian check.

The crop model behind the Ukrainian crop-name hints was trained on one Red River tile-year (2023). This job
trains it on a spatial sample of US tiles in every state with HLS 2023–2025, holds out whole tiles for the
score, then predicts Ukrainian summer seasons and prints yearly crop shares per oblast, to compare with
official statistics. Nothing in the site changes: models go to work/models_us.pkl, numbers to
work/metrics_us_crop.json.

Season timing: the reference green-up is the median of summer-crop rows per tile and year (latitude and
weather move whole regions; a field's timing relative to its neighbours is what separates crops).
Usage: uv run python jobs/train_us.py [--tiles 160] [--per-tile 1500]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

from lan.cdl import cdl_class
from lan.classify import CROPS, FEATS, GROUPS, MIN_VALID, SEED, crop_features, evaluate, features, fit, load_models, predict
from lan.config import DATA_DIR, WORK_DIR
from lan.curves import build_curves, home_tile

YEARS = (2023, 2024, 2025)
NDVI_US = WORK_DIR / "ndvi_us"
LOGS = DATA_DIR / "logs"


def log(msg: str) -> None:
    print(f"{time.strftime('%H:%M:%S')} {msg}", flush=True)


def tile_ref(df: pd.DataFrame, summer: np.ndarray) -> pd.Series:
    """Median green-up dekad of the summer rows per (tile, year); falls back to the year's median."""
    s = df[summer]
    by_ty = s.groupby(["tile", "y"])["greenup_dekad"].median()
    by_y = s.groupby("y")["greenup_dekad"].median()
    key = pd.MultiIndex.from_arrays([df["tile"], df["y"]])
    r = pd.Series(by_ty.reindex(key).to_numpy(), index=df.index)
    return r.fillna(df["y"].map(by_y)).astype(float)


def rare_fields() -> pd.DataFrame:
    """Fields with sunflower (CDL 6) or sugar beet (41) in any of YEARS: index id, columns sun, beet (years)."""
    cols = [f"CDL{y}" for y in YEARS]
    out = []
    for p in sorted((WORK_DIR / "crops_us").glob("*.parquet")):
        c = pd.read_parquet(p, columns=["id"] + cols).set_index("id")
        v = c.to_numpy()
        sun, beet = (v == 6).sum(1), (v == 41).sum(1)
        keep = (sun + beet) > 0
        out.append(pd.DataFrame({"sun": sun[keep], "beet": beet[keep]}, index=c.index[keep]))
    return pd.concat(out)


def us_sample(n_tiles: int, per_tile: int) -> pd.DataFrame:
    tiles = [ln.split()[0] for ln in (LOGS / "tiles_us.txt").read_text().split("\n") if ln.strip()]
    ready = [t for t in tiles if all((NDVI_US / f"{t}_{y}.ok").exists() and (NDVI_US / f"{t}_{y}.parquet").exists() for y in YEARS)]
    rng = np.random.default_rng(SEED)
    # Sunflower and sugar beet are rare in the USA (Dakotas, Minnesota, Kansas, Idaho) but central in Ukraine:
    # take the tiles that grow them most and every such field in them, then fill up with random tiles.
    rare = rare_fields()
    tix = pd.read_parquet(WORK_DIR / "us" / "tile_ids.parquet")
    tix = tix[tix["tile"].isin(set(ready))]
    rt = tix[tix["id"].isin(set(rare.index))].copy()
    rt["sun"] = rt["id"].map(rare["sun"])
    rt["beet"] = rt["id"].map(rare["beet"])
    by = rt.groupby("tile")[["sun", "beet"]].sum()
    top = list(by["sun"].nlargest(n_tiles // 4).index) + list(by["beet"].nlargest(n_tiles // 8).index)
    top = list(dict.fromkeys(top))
    rest = [t for t in ready if t not in set(top)]
    pick = sorted(top + list(rng.choice(rest, size=max(0, min(n_tiles - len(top), len(rest))), replace=False)))
    log(f"tiles with 2023–2025: {len(ready)}; sampled {len(pick)} ({len(top)} for sunflower / sugar beet); "
        f"rare fields: {len(rare):,}")
    rare_by_tile = rt.groupby("tile")["id"].apply(list).to_dict()
    del tix, rt
    # curves are built per batch of tiles: all tiles at once did not fit in the laptop's memory
    feats, parts = [], []

    def flush():
        if not parts:
            return
        obs = pd.concat(parts, ignore_index=True)
        parts.clear()
        ht = home_tile(obs)
        cur = build_curves(obs)
        del obs
        cur.columns = [f"d{k}" for k in cur.columns]
        cur = cur.reset_index()
        cur = cur[cur["y"].isin(YEARS)]
        f = features(cur)
        f["tile"] = f["id"].map(ht)
        feats.append(f)

    for i, t in enumerate(pick, 1):
        d0 = pd.read_parquet(NDVI_US / f"{t}_{YEARS[-1]}.parquet", columns=["id"])
        ids = d0["id"].unique()
        ids = set(rng.choice(ids, size=min(per_tile, len(ids)), replace=False))
        ids |= set(rare_by_tile.get(t, [])[: 3 * per_tile])
        for y in YEARS:
            d = pd.read_parquet(NDVI_US / f"{t}_{y}.parquet", columns=["id", "date", "ndvi", "frac"])
            d = d[d["id"].isin(ids)]
            d["tile"] = t
            parts.append(d)
        if i % 20 == 0:
            flush()
            log(f"  curves for {i}/{len(pick)} tiles")
    flush()
    # a field sampled on two overlapping tiles: keep the season with more looks
    df = pd.concat(feats, ignore_index=True).sort_values("n_valid").drop_duplicates(["id", "y"], keep="last")
    # labels: CDL code of that year → our class and group
    want = set(df["id"])
    lab = []
    for p in sorted((WORK_DIR / "crops_us").glob("*.parquet")):
        c = pd.read_parquet(p, columns=["id"] + [f"CDL{y}" for y in YEARS])
        c = c[c["id"].isin(want)]
        for y in YEARS:
            k = c[f"CDL{y}"].map(lambda v: cdl_class(int(v)) if pd.notna(v) else ("other", None))
            lab.append(pd.DataFrame({"id": c["id"].to_numpy(), "y": y, "crop": [a for a, _ in k], "group": [b for _, b in k]}))
    lab = pd.concat(lab, ignore_index=True)
    df = df.merge(lab, on=["id", "y"])
    return df[df["n_valid"] >= MIN_VALID].reset_index(drop=True)


def ua_curves(code: str, n: int) -> pd.DataFrame:
    """Curves of a sample of fields of one oblast (Cherkasy: the saved work/curves.parquet)."""
    if code == "71" and (WORK_DIR / "curves.parquet").exists():
        cur = pd.read_parquet(WORK_DIR / "curves.parquet")
        cur["tile"] = cur["id"].map(pd.read_parquet(WORK_DIR / "home_tile.parquet")["tile"])
        return cur

    tix = pd.read_parquet(WORK_DIR / "ua" / "tile_ids.parquet")
    hist = pd.read_parquet(WORK_DIR / "ua" / code / "history.parquet", columns=["id"])
    rng = np.random.default_rng(SEED)
    ids_all = hist["id"].unique()
    ids = set(rng.choice(ids_all, size=min(n, len(ids_all)), replace=False))
    tiles = sorted(set(tix.loc[tix["id"].isin(ids), "tile"]))
    parts = []
    for t in tiles:
        for ok in sorted((WORK_DIR / "ndvi").glob(f"{t}_*.ok")):
            p = ok.with_suffix(".parquet")
            if p.exists():
                d = pd.read_parquet(p, columns=["id", "date", "ndvi", "frac"])
                d = d[d["id"].isin(ids)]
                d["tile"] = t
                parts.append(d)
    obs = pd.concat(parts, ignore_index=True)
    ht = home_tile(obs)
    cur = build_curves(obs)
    cur.columns = [f"d{k}" for k in cur.columns]
    cur = cur.reset_index()
    cur["tile"] = cur["id"].map(ht)
    return cur


def ua_shares(cur: pd.DataFrame, mg, mc_old, mc_new) -> dict:
    ua = features(cur.drop(columns=["tile"]))
    ua["tile"] = ua["id"].map(cur.drop_duplicates("id").set_index("id")["tile"])
    ua = ua[ua["n_valid"] >= MIN_VALID].reset_index(drop=True)
    g, _ = predict(mg, ua[FEATS], GROUPS)
    summer = g == "summer"
    out = {}
    for name, m, ref in (("old", mc_old, ua["y"].map(ua[summer].groupby("y")["greenup_dekad"].median()).astype(float)),
                         ("new", mc_new, tile_ref(ua, summer))):
        x = crop_features(ua, ref)
        k, _ = predict(m, x[summer], CROPS)
        s = pd.DataFrame({"y": ua.loc[summer, "y"].to_numpy(), "k": k})
        out[name] = {int(y): {c: round(100 * float((grp["k"] == c).mean())) for c in CROPS} for y, grp in s.groupby("y")}
    out["summerFieldYears"] = int(summer.sum())
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tiles", type=int, default=160)
    ap.add_argument("--per-tile", type=int, default=1500)
    ap.add_argument("--ua", default="71,63,51", help="oblasts for the plausibility check")
    ap.add_argument("--ua-fields", type=int, default=6000)
    a = ap.parse_args()

    df = us_sample(a.tiles, a.per_tile)
    log(f"US field-years with labels: {len(df):,}; classes: {df['crop'].value_counts().to_dict()}")
    summer = (df["group"] == "summer").to_numpy()
    df["ref"] = tile_ref(df, summer)
    tr = df[df["crop"].isin(CROPS)].reset_index(drop=True)
    x = crop_features(tr, tr["ref"])

    tiles = sorted(tr["tile"].dropna().unique())
    rng = np.random.default_rng(SEED + 1)
    test = set(rng.choice(tiles, size=max(1, len(tiles) // 5), replace=False))
    is_test = tr["tile"].isin(test).to_numpy()
    log(f"train rows {int((~is_test).sum()):,}, held-out rows {int(is_test.sum()):,} on {len(test)} tiles")
    m = fit(x[~is_test], tr.loc[~is_test, "crop"], CROPS)
    pc, _ = predict(m, x[is_test], CROPS)
    held = evaluate(tr.loc[is_test, "crop"], pc, CROPS)
    log("held-out tiles: " + json.dumps({k: held[k] for k in ("macroF1", "accuracy", "perClass", "support")}))

    m_all = fit(x, tr["crop"], CROPS)
    import pickle

    (WORK_DIR / "models_us.pkl").write_bytes(pickle.dumps({"crop": m_all}))
    mg, mc_old = load_models(WORK_DIR / "models.pkl")

    ua = {}
    for code in a.ua.split(","):
        log(f"Ukraine {code}: curves")
        ua[code] = ua_shares(ua_curves(code, a.ua_fields), mg, mc_old, m_all)
        log(f"Ukraine {code}: {json.dumps(ua[code])}")

    metrics = {"heldOut": held, "trainTiles": len(tiles) - len(test), "testTiles": sorted(test), "years": list(YEARS),
               "rows": int(len(tr)), "ukraineShares": ua,
               "labelSource": "USDA NASS Crop Sequence Boundaries 2018–2025 (CDL 2023–2025)"}
    (WORK_DIR / "metrics_us_crop.json").write_text(json.dumps(metrics, indent=1), encoding="utf-8")
    log("saved work/models_us.pkl and work/metrics_us_crop.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
