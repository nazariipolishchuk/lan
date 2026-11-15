"""Crop names from Ukrainian labels: the 2020 10 m crop type map of Ukraine as training labels.

Labels: Chen, Tu et al. 2024 (Commun. Earth Environ.), Zenodo 11065080, CC-BY-4.0: wheat, sunflower,
rapeseed, other, maize (the map scores 90 % on its authors' 954 validation points). A field-year gets the
map's majority class with the KPI rules (≥ 50 % of the field mapped, ≥ 70 % purity).

Two models inside our existing group model (winter / summer / uncultivated, trained on KPI maps):
  summer: maize / sunflower / other summer crop      winter: wheat / rapeseed
Features: the absolute season curve and phenology (FEATS) plus the curve relative to each tile-year's
median summer green-up (CROP_FEATS), so a season running early or late does not move the crop.

Checks: (1) held-out tiles in 2020; (2) the 2020 model applied to 2019 and 2021–2026: yearly crop shares
per oblast, to compare with official statistics. Nothing in the site changes; models go to
work/models_ua_crop.pkl, numbers to work/metrics_ua_crop.json.
Usage: uv run python jobs/train_ua_crops.py [--oblasts 71,63,51,...] [--fields 8000]
"""

from __future__ import annotations

import argparse
import json
import pickle
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from build_ukraine import oblast_fields  # noqa: E402

from lan.classify import CROP_FEATS, FEATS, GROUPS, MIN_VALID, SEED, crop_features, evaluate, features, fit, load_models, predict  # noqa: E402
from lan.config import RAW_DIR, WORK_DIR  # noqa: E402
from lan.curves import build_curves, home_tile  # noqa: E402
from lan.labels import UA2020_CLASSES, class_counts, crop_majority  # noqa: E402

MAP = RAW_DIR / "ua_cropmap_2020" / "UkraineCropMap-10m.tif"
LABEL_YEAR = 2020
SUMMER = ["maize", "sunflower", "other"]
WINTER = ["wheat", "rapeseed"]
# forest-steppe, steppe, east, west, south: one oblast or more from each zone
DEFAULT = "71,05,12,18,32,35,48,51,53,63,14,23,46,59"


def log(msg: str) -> None:
    print(f"{time.strftime('%H:%M:%S')} {msg}", flush=True)


def tile_ref(df: pd.DataFrame, summer: np.ndarray) -> pd.Series:
    s = df[summer]
    by_ty = s.groupby(["tile", "y"])["greenup_dekad"].median()
    by_y = s.groupby("y")["greenup_dekad"].median()
    key = pd.MultiIndex.from_arrays([df["tile"], df["y"]])
    r = pd.Series(by_ty.reindex(key).to_numpy(), index=df.index)
    return r.fillna(df["y"].map(by_y)).astype(float)


def curves_for(ids: set[str]) -> pd.DataFrame:
    tix = pd.read_parquet(WORK_DIR / "ua" / "tile_ids.parquet")
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
    del obs
    cur.columns = [f"d{k}" for k in cur.columns]
    cur = cur.reset_index()
    f = features(cur)
    f["tile"] = f["id"].map(ht)
    return f


def oblast_sample(code: str, n: int, rng) -> pd.DataFrame:
    f = oblast_fields(code, columns=["id", "small", "geometry"])
    f = f[~f["small"]].drop_duplicates("id")
    f = f.iloc[rng.choice(len(f), size=min(n, len(f)), replace=False)]
    c = class_counts(MAP, f[["id", "geometry"]], UA2020_CLASSES, band_rows=1024)
    lab = pd.DataFrame({"id": c["id"], "label": crop_majority(c, list(UA2020_CLASSES.values())).to_numpy()})
    cur = curves_for(set(f["id"]))
    cur = cur.merge(lab, on="id", how="left")
    cur.loc[cur["y"] != LABEL_YEAR, "label"] = None
    cur["oblast"] = code
    return cur


def xmat(df: pd.DataFrame) -> pd.DataFrame:
    x = crop_features(df, df["ref"])
    return pd.concat([df[FEATS], x[[c for c in CROP_FEATS if c not in FEATS]]], axis=1)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--oblasts", default=DEFAULT)
    ap.add_argument("--fields", type=int, default=8000)
    a = ap.parse_args()
    rng = np.random.default_rng(SEED)
    mg, _ = load_models(WORK_DIR / "models.pkl")

    parts = []
    for code in a.oblasts.split(","):
        d = oblast_sample(code, a.fields, rng)
        lab = d.loc[d["y"] == LABEL_YEAR, "label"]
        log(f"{code}: {d['id'].nunique()} fields, {len(d)} field-years; 2020 labels {lab.value_counts(dropna=False).to_dict()}")
        parts.append(d)
    df = pd.concat(parts, ignore_index=True)
    df = df[df["n_valid"] >= MIN_VALID].reset_index(drop=True)
    g, pg = predict(mg, df[FEATS], GROUPS)
    df["g"] = g
    df["ref"] = tile_ref(df, g == "summer")
    x = xmat(df)

    tiles = sorted(df["tile"].dropna().unique())
    test = set(np.random.default_rng(SEED + 1).choice(tiles, size=max(1, len(tiles) // 5), replace=False))
    is_test = df["tile"].isin(test).to_numpy()
    res, models = {}, {}
    for name, grp, labels in (("summer", "summer", SUMMER), ("winter", "winter", WINTER)):
        rows = ((df["g"] == grp) & df["label"].isin(labels)).to_numpy()
        tr, te = rows & ~is_test, rows & is_test
        m = fit(x[tr], df.loc[tr, "label"], labels)
        p, _ = predict(m, x[te], labels)
        res[name] = evaluate(df.loc[te, "label"], p, labels)
        log(f"{name} model, held-out tiles 2020: " + json.dumps({k: res[name][k] for k in ("macroF1", "accuracy", "perClass", "support")}))
        models[name] = fit(x[rows], df.loc[rows, "label"], labels)

    # the 2020 model on every year: shares inside each group per oblast
    shares = {}
    for name, grp, labels in (("summer", "summer", SUMMER), ("winter", "winter", WINTER)):
        sel = (df["g"] == grp).to_numpy()
        k, _ = predict(models[name], x[sel], labels)
        s = pd.DataFrame({"oblast": df.loc[sel, "oblast"].to_numpy(), "y": df.loc[sel, "y"].to_numpy(), "k": k})
        shares[name] = {ob: {int(y): {c: round(100 * float((t["k"] == c).mean())) for c in labels} for y, t in go.groupby("y")}
                        for ob, go in s.groupby("oblast")}
        # the map's own 2020 shares on the same fields, for reference
        lab = df[sel & (df["y"] == LABEL_YEAR).to_numpy() & df["label"].isin(labels).to_numpy()]
        shares[name + "Map2020"] = {ob: {c: round(100 * float((t["label"] == c).mean())) for c in labels} for ob, t in lab.groupby("oblast")}
    for ob in sorted(shares["summer"]):
        log(f"{ob} summer: " + " ".join(f"{y}:{v['maize']}/{v['sunflower']}/{v['other']}" for y, v in shares["summer"][ob].items())
            + f"  (map 2020: {shares['summerMap2020'].get(ob)})")
    for ob in sorted(shares["winter"]):
        log(f"{ob} winter rapeseed %: " + " ".join(f"{y}:{v['rapeseed']}" for y, v in shares["winter"][ob].items())
            + f"  (map 2020: {shares['winterMap2020'].get(ob)})")

    (WORK_DIR / "models_ua_crop.pkl").write_bytes(pickle.dumps(models))
    out = {"heldOut2020": res, "testTiles": sorted(test), "shares": shares, "oblasts": a.oblasts.split(","),
           "labelSource": "Ukraine crop type map 2020, 10 m (Chen, Tu et al. 2024; Zenodo 11065080, CC-BY-4.0)"}
    (WORK_DIR / "metrics_ua_crop.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    log("saved work/models_ua_crop.pkl and work/metrics_ua_crop.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
