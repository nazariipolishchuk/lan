"""Crop-history classifier (§7.5, Path B+).

Two LightGBM models on the 27-dekad greenness curve plus phenology features:

* Group model (Ukraine): winter / summer / uncultivated, trained on the KPI winter/summer maps 2019–2024.
  No class re-weighting: with "balanced" weights 13 % of summer fields became "uncultivated" (precision 18 %),
  and a false "fallow" claim misleads the rules more than a missed one.
* Crop model (USA, Red River Valley): maize / soy / sugar beet / sunflower / spring cereal, trained
  on USDA Crop Sequence Boundaries 2023. The Red River season runs later than the Ukrainian
  Forest-Steppe; the lag is measured (median green-up dekad of summer crops) and the training curves
  are shifted by it, with ±1 dekad of augmentation.

Splits are always by whole tiles (spatial blocks), never by random rows. A Ukrainian field-year gets
group = argmax of the group model; inside the summer group the crop comes from the crop model and its
confidence is P(summer) × P(crop | summer).
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from lan.curves import D0, D1, phenology

DEK = [f"d{k}" for k in range(D0, D1 + 1)]
GROUPS = ["winter", "summer", "uncultivated"]
CROPS = ["maize", "soy", "sugar_beet", "sunflower", "spring_cereal"]  # fallow and grass: the group model
MIN_VALID = 12  # season dekads with a value; fewer → the year is unknown (review focus 1)
SEED = 7
HINT_CAP = 0.5  # below the engine threshold (0.6): an unconfirmed crop name


# ---------- features ----------

def features(cur: pd.DataFrame) -> pd.DataFrame:
    """cur: columns id, y, d6..d32. Adds phenology and the previous season's autumn greenness."""
    a = cur[DEK].to_numpy(dtype=np.float32)
    ph = pd.DataFrame([phenology(r) for r in a], index=cur.index)
    out = pd.concat([cur[["id", "y"]], cur[DEK], ph], axis=1)
    prev = cur[["id", "y"]].copy()
    prev["y"] = prev["y"] + 1
    with np.errstate(all="ignore"), __import__("warnings").catch_warnings():
        __import__("warnings").simplefilter("ignore", RuntimeWarning)
        prev["prev_autumn"] = np.nanmean(a[:, -6:], axis=1)
        prev["prev_late"] = np.nanmean(a[:, -3:], axis=1)
    out = out.merge(prev, on=["id", "y"], how="left")
    return out


FEATS = DEK + ["n_valid", "peak", "peak_dekad", "greenup_dekad", "senesc_dekad", "season_len", "auc", "spring",
               "early_summer", "late_summer", "autumn", "prev_autumn", "prev_late"]
REL = [f"r{j}" for j in range(-3, 15)]
CROP_FEATS = REL + ["gu_rel", "sen_rel", "pk_rel", "season_len", "peak", "auc", "n_valid"]


def crop_features(df: pd.DataFrame, ref: pd.Series) -> pd.DataFrame:
    """Season-relative features for the crop model.

    `ref` (per row) is the median green-up dekad of summer crops in that region and year. Timing is
    expressed relative to it and the curve is resampled from 3 dekads before it, so a whole season
    running early or late (weather, latitude) does not change the features; only a field's timing
    relative to its neighbours does. This is what lets a model trained in the Red River Valley read
    Ukrainian curves.
    """
    a = df[DEK].to_numpy(dtype=np.float32)
    r = ref.to_numpy(dtype=float)
    out = pd.DataFrame(index=df.index)
    rows = np.arange(len(df))
    for j in range(-3, 15):
        col = np.round(r).astype(int) - D0 + j
        ok = (col >= 0) & (col < a.shape[1])
        v = np.full(len(df), np.nan, dtype=np.float32)
        v[ok] = a[rows[ok], col[ok]]
        out[f"r{j}"] = v
    out["gu_rel"] = df["greenup_dekad"].to_numpy() - r
    out["sen_rel"] = df["senesc_dekad"].to_numpy() - r
    out["pk_rel"] = df["peak_dekad"].to_numpy() - r
    for f in ("season_len", "peak", "auc", "n_valid"):
        out[f] = df[f].to_numpy()
    return out


def year_ref(df: pd.DataFrame, summer: pd.Series) -> pd.Series:
    """Median green-up dekad of the summer rows of each year, broadcast to every row of that year."""
    med = df[summer.to_numpy()].groupby("y")["greenup_dekad"].median()
    return df["y"].map(med).astype(float)


def shift_curves(df: pd.DataFrame, s: int) -> pd.DataFrame:
    """Move a season curve earlier by `s` dekads (s > 0): value at dekad k becomes the value at k + s."""
    if s == 0:
        return df.copy()
    a = df[DEK].to_numpy(dtype=np.float32)
    b = np.full_like(a, np.nan)
    if s > 0:
        b[:, :-s] = a[:, s:]
    else:
        b[:, -s:] = a[:, :s]
    out = df.copy()
    out[DEK] = b
    return out


def split_by_tile(df: pd.DataFrame, test_tiles: set[str]) -> tuple[pd.DataFrame, pd.DataFrame]:
    test = df["tile"].isin(test_tiles)
    return df[~test], df[test]


# ---------- models ----------

def _lgbm(n_classes: int, balanced: bool = True):
    import lightgbm as lgb

    return lgb.LGBMClassifier(objective="multiclass", num_class=n_classes, n_estimators=300, learning_rate=0.05,
                              num_leaves=31, min_child_samples=40, subsample=0.8, subsample_freq=1,
                              colsample_bytree=0.8, class_weight="balanced" if balanced else None, random_state=SEED, verbose=-1)


def evaluate(y_true, y_pred, labels: list[str]) -> dict:
    from sklearn.metrics import confusion_matrix, f1_score

    f1 = f1_score(y_true, y_pred, labels=labels, average=None, zero_division=0)
    return {
        "macroF1": round(float(np.mean(f1)), 3),
        "accuracy": round(float(np.mean(np.asarray(y_true) == np.asarray(y_pred))), 3),
        "perClass": {c: round(float(v), 3) for c, v in zip(labels, f1)},
        "support": {c: int(np.sum(np.asarray(y_true) == c)) for c in labels},
        "n": int(len(y_true)),
        "labels": labels,
        "confusion": confusion_matrix(y_true, y_pred, labels=labels).tolist(),
    }


def fit(X: pd.DataFrame, y: pd.Series, labels: list[str], balanced: bool = True):
    m = _lgbm(len(labels), balanced)
    m.fit(X, pd.Categorical(y, categories=labels).codes)
    return m


def predict(m, X: pd.DataFrame, labels: list[str]) -> tuple[np.ndarray, np.ndarray]:
    p = m.predict_proba(X)
    return np.asarray(labels)[p.argmax(1)], p


def greenup_lag(ua_summer: pd.DataFrame, rr: pd.DataFrame) -> int:
    """Median green-up dekad of Red River summer crops minus that of Ukrainian summer crops."""
    a = np.nanmedian(rr["greenup_dekad"])
    b = np.nanmedian(ua_summer["greenup_dekad"])
    return int(round(a - b))


def _mask_prev(X: pd.DataFrame, share: float = 0.15) -> pd.DataFrame:
    """Hide the previous-autumn features on a share of rows, so 2016 (no 2015 season) is not out of range."""
    rng = np.random.default_rng(SEED)
    X = X.copy()
    m = rng.random(len(X)) < share
    X.loc[m, ["prev_autumn", "prev_late"]] = np.nan
    return X


def run(work: Path, ua_test_tiles: set[str], rr_test_tiles: set[str]) -> dict:
    cur = pd.read_parquet(work / "curves.parquet")
    tiles = pd.read_parquet(work / "home_tile.parquet")["tile"]
    ua = features(cur)
    ua["tile"] = ua["id"].map(tiles)
    lab = pd.read_parquet(work / "labels_kpi.parquet")
    tr_ua = ua.merge(lab, on=["id", "y"])
    tr_ua = tr_ua[tr_ua["n_valid"] >= MIN_VALID]

    # group model: held-out tiles
    a, b = split_by_tile(tr_ua, ua_test_tiles)
    assert set(a["tile"]).isdisjoint(set(b["tile"]))
    mg = fit(_mask_prev(a[FEATS]), a["group"], GROUPS, balanced=False)
    pg, _ = predict(mg, b[FEATS], GROUPS)
    m_group = evaluate(b["group"], pg, GROUPS)
    m_group.update({"trainTiles": sorted(set(a["tile"])), "testTiles": sorted(ua_test_tiles),
                    "labelSource": "KPI winter/summer maps 2019–2024 (World Bank DDH 0066913)"})
    print("group model, held-out tiles:", json.dumps({k: m_group[k] for k in ("macroF1", "accuracy", "perClass", "n")}), flush=True)

    # crop model: Red River
    rr_cur = build_rr_curves(work)
    rr = features(rr_cur)
    rr = rr.merge(pd.read_parquet(work / "labels_csb.parquet"), on=["id", "y"])
    rr["tile"] = rr["id"].map(pd.read_parquet(work / "home_tile_rr.parquet")["tile"])
    rr = rr[rr["crop"].isin(CROPS) & (rr["n_valid"] >= MIN_VALID)]
    lag = greenup_lag(tr_ua[tr_ua["group"] == "summer"], rr)
    print("Red River green-up lag vs Cherkasy (dekads):", lag, flush=True)
    rr_x = crop_features(rr, year_ref(rr, pd.Series(True, index=rr.index)))
    c, d = split_by_tile(rr, rr_test_tiles)
    assert set(c["tile"]).isdisjoint(set(d["tile"]))
    mc = fit(rr_x.loc[c.index], c["crop"], CROPS)
    pc, _ = predict(mc, rr_x.loc[d.index], CROPS)
    m_crop = evaluate(d["crop"], pc, CROPS)
    m_crop.update({"trainTiles": sorted(set(c["tile"])), "testTiles": sorted(rr_test_tiles),
                   "labelSource": "USDA NASS Crop Sequence Boundaries 2023"})
    print("crop model, held-out Red River tile:", json.dumps({k: m_crop[k] for k in ("macroF1", "accuracy", "perClass", "n")}), flush=True)

    # final models on everything; the crop model reads curves relative to each year's summer green-up
    mg_all = fit(_mask_prev(tr_ua[FEATS]), tr_ua["group"], GROUPS, balanced=False)
    mc_all = fit(rr_x, rr["crop"], CROPS)
    save_models(work / "models.pkl", mg_all, mc_all)

    hist = predict_history(cur, mg_all, mc_all)
    hist.to_parquet(work / "history.parquet", index=False)
    print("predicted classes (all field-years):", hist["k"].value_counts().to_dict(), flush=True)

    metrics = {"group": m_group, "crop": m_crop, "greenupLagDekads": lag, "minValidDekads": MIN_VALID,
               "fieldYearsPredicted": int(len(hist))}
    return metrics


def save_models(path: Path, mg, mc) -> None:
    import pickle

    path.write_bytes(pickle.dumps({"group": mg, "crop": mc}))


def load_models(path: Path):
    import pickle

    m = pickle.loads(path.read_bytes())  # our own file, written by save_models
    return m["group"], m["crop"]


UA_SUMMER = ["maize", "sunflower", "other"]
UA_WINTER = ["wheat", "rapeseed"]


def tile_ref(df: pd.DataFrame, summer: np.ndarray) -> pd.Series:
    """Median green-up dekad of the summer rows per (tile, year); the year's median where a tile has none."""
    s = df[summer]
    by_ty = s.groupby(["tile", "y"])["greenup_dekad"].median()
    by_y = s.groupby("y")["greenup_dekad"].median()
    key = pd.MultiIndex.from_arrays([df["tile"], df["y"]])
    r = pd.Series(by_ty.reindex(key).to_numpy(), index=df.index)
    return r.fillna(df["y"].map(by_y)).astype(float)


def ua_crop_x(df: pd.DataFrame, ref: pd.Series) -> pd.DataFrame:
    """Features of the Ukrainian crop models: absolute curve and phenology + the season-relative curve."""
    x = crop_features(df, ref)
    return pd.concat([df[FEATS], x[[c for c in CROP_FEATS if c not in FEATS]]], axis=1)


def load_ua_crop_models(path: Path):
    """Models from jobs/train_ua_crops.py (labels: Ukraine crop type map 2020), or None."""
    import pickle

    return pickle.loads(path.read_bytes()) if path.exists() else None  # our own file


def predict_history(cur: pd.DataFrame, mg, mc, ua_crop=None, tiles: pd.Series | None = None) -> pd.DataFrame:
    """Curves (id, y, d…) → history rows (id, y, g, pg, crop, pc, n_valid, k, p).

    With `ua_crop` (Ukrainian crop models) and `tiles` (field → home tile), crop names come from models
    trained on Ukrainian labels: maize / sunflower / other inside the summer group, wheat / rapeseed inside
    the winter group. They stay hints (p ≤ HINT_CAP): trained on one year (2020), their yearly shares swing
    in drought years (VALIDATION.md). A wheat season keeps the group's confidence, as before.
    """
    ua = features(cur)
    g, pg_all = predict(mg, ua[FEATS], GROUPS)
    if ua_crop is not None and tiles is not None:
        return _predict_ua(ua, g, pg_all, ua_crop, tiles)
    ua_x = crop_features(ua, year_ref(ua, pd.Series(g == "summer", index=ua.index)))
    k, pc_all = predict(mc, ua_x, CROPS)
    p_group = pg_all.max(1)
    p_summer = pg_all[:, GROUPS.index("summer")]
    hist = pd.DataFrame({"id": ua["id"], "y": ua["y"], "g": g, "pg": p_group.round(3),
                         "crop": k, "pc": pc_all.max(1).round(3), "n_valid": ua["n_valid"]})
    hist["k"] = np.select([hist.g == "winter", hist.g == "uncultivated"], ["winter_cereal", "other"], hist.crop)
    # Crop names inside the summer group come from a model trained in the USA; in Ukraine they failed a
    # plausibility check against official statistics (DECISIONS.md, Sat 12:52), so they ship as hints
    # below the engine's confidence threshold: the farmer confirms them, the rules do not use them.
    hist["p"] = np.where(hist.g == "summer", np.minimum(p_summer * pc_all.max(1), HINT_CAP), p_group).round(3)
    unknown = hist["n_valid"] < MIN_VALID
    hist.loc[unknown, ["k", "p"]] = ["unknown", 0.0]
    return hist


def _predict_ua(ua: pd.DataFrame, g: np.ndarray, pg_all: np.ndarray, models: dict, tiles: pd.Series) -> pd.DataFrame:
    ua = ua.copy()
    ua["tile"] = ua["id"].map(tiles)
    summer, winter = g == "summer", g == "winter"
    x = ua_crop_x(ua, tile_ref(ua, summer))
    p_group = pg_all.max(1)
    crop = np.where(winter, "wheat", np.where(summer, "other", "other")).astype(object)
    pc = np.zeros(len(ua))
    for sel, m, labels in ((summer, models["summer"], UA_SUMMER), (winter, models["winter"], UA_WINTER)):
        if sel.any():
            k, p = predict(m, x[sel], labels)
            crop[sel] = k
            pc[sel] = p.max(1)
    hist = pd.DataFrame({"id": ua["id"], "y": ua["y"], "g": g, "pg": p_group.round(3), "crop": crop,
                         "pc": pc.round(3), "n_valid": ua["n_valid"]})
    rape = winter & (crop == "rapeseed")
    hist["k"] = np.select([winter & ~rape, rape, g == "uncultivated"], ["winter_cereal", "rapeseed", "other"], crop)
    hint = np.minimum(p_group * pc, HINT_CAP)
    hist["p"] = np.where(summer | rape, hint, p_group).round(3)
    unknown = hist["n_valid"] < MIN_VALID
    hist.loc[unknown, ["k", "p"]] = ["unknown", 0.0]
    return hist


def build_rr_curves(work: Path) -> pd.DataFrame:
    from lan.curves import build_curves, home_tile, load_obs

    obs = load_obs(work / "ndvi_rr")
    home_tile(obs).to_frame("tile").to_parquet(work / "home_tile_rr.parquet")
    cur = build_curves(obs)
    cur.columns = DEK
    return cur.reset_index()


if __name__ == "__main__":
    from lan.config import WORK_DIR

    m = run(WORK_DIR, ua_test_tiles={"T36UVA", "T35UQP"}, rr_test_tiles={"T14UPU"})
    (WORK_DIR / "metrics.json").write_text(json.dumps(m, indent=1), encoding="utf-8")
