"""Greenness observations → dekadal curves per field-year, phenology features, bare days, autumn state.

A season is dekads 6..32 (1 March – 30 November): ND = 27 values. Several looks inside one dekad are
averaged; gaps of at most four dekads are interpolated linearly; longer gaps stay missing, and nothing
is extrapolated past the first or last look of a season. A light 1-2-1 smoothing follows.
"""

from __future__ import annotations

import base64
import datetime as dt
from pathlib import Path

import numpy as np
import pandas as pd

D0, D1 = 6, 32  # first and last season dekad (absolute, 0..35)
ND = D1 - D0 + 1
BARE_NDVI = 0.25  # §7.6: bare-soil threshold
MIN_VALID_BARE = 18  # season dekads with a value needed to count a year's bare days
AUTUMN = 27  # 1 October
BARE_AUTUMN = 0.40
SUMMER = (12, 24)  # May .. August, where the summer peak is searched


# ---------- curves ----------

def fill_gaps(c: np.ndarray, max_gap: int = 4) -> np.ndarray:
    """Linear interpolation over runs of at most `max_gap` missing values between two observations.

    Works on 1-D or 2-D arrays (along the last axis). Leading and trailing gaps stay missing.
    """
    a = np.array(c, dtype=np.float32, copy=True)
    two_d = a.ndim == 2
    if not two_d:
        a = a[None, :]
    n = a.shape[1]
    ok = ~np.isnan(a)
    idx = np.where(ok, np.arange(n), -1)
    prev = np.maximum.accumulate(idx, axis=1)
    idx2 = np.where(ok, np.arange(n), n)
    nxt = np.minimum.accumulate(idx2[:, ::-1], axis=1)[:, ::-1]
    gap = nxt - prev - 1
    fill = (~ok) & (prev >= 0) & (nxt < n) & (gap <= max_gap)
    r, col = np.nonzero(fill)
    p, q = prev[r, col], nxt[r, col]
    w = (col - p) / (q - p)
    a[r, col] = a[r, p] * (1 - w) + a[r, q] * w
    return a if two_d else a[0]


def smooth(c: np.ndarray) -> np.ndarray:
    """1-2-1 smoothing where both neighbours exist; other values unchanged."""
    a = np.array(c, dtype=np.float32, copy=True)
    two_d = a.ndim == 2
    if not two_d:
        a = a[None, :]
    out = a.copy()
    mid = 0.25 * a[:, :-2] + 0.5 * a[:, 1:-1] + 0.25 * a[:, 2:]
    good = ~np.isnan(mid)
    out[:, 1:-1][good] = mid[good]
    return out if two_d else out[0]


def dekad_index(dates: pd.Series) -> np.ndarray:
    d = pd.to_datetime(dates)
    return ((d.dt.month - 1) * 3 + np.minimum(2, (d.dt.day - 1) // 10)).to_numpy()


def build_curves(obs: pd.DataFrame, smooth: bool = True, max_gap: int = 4) -> pd.DataFrame:
    """Observations (id, date, ndvi) → DataFrame indexed by (id, y) with ND columns (season dekads)."""
    do_smooth = smooth
    d = pd.DataFrame({"id": obs["id"].to_numpy(), "y": pd.to_datetime(obs["date"]).dt.year.to_numpy(),
                      "k": dekad_index(obs["date"]), "v": obs["ndvi"].to_numpy(dtype=np.float32)})
    d = d[(d.k >= D0) & (d.k <= D1)]
    m = d.groupby(["id", "y", "k"], sort=True)["v"].mean().unstack("k")
    m = m.reindex(columns=range(D0, D1 + 1))
    a = m.to_numpy(dtype=np.float32)
    if max_gap > 0:
        a = fill_gaps(a, max_gap)
    if do_smooth:
        a = _smooth(a)
    return pd.DataFrame(a, index=m.index, columns=list(range(D0, D1 + 1)))


_smooth = smooth  # build_curves has a parameter of the same name


def encode_curve(c: np.ndarray) -> str:
    """Contract §7.6: uint8 = round(ndvi * 200), 255 = no data, base64."""
    v = np.where(np.isnan(c), 255, np.clip(np.round(np.nan_to_num(c) * 200), 0, 254)).astype(np.uint8)
    return base64.b64encode(v.tobytes()).decode("ascii")


# ---------- features ----------

def phenology(c: np.ndarray) -> dict:
    """Phenology of one season curve (ND values). Dekads are absolute (0..35); NaN where undefined."""
    ok = ~np.isnan(c)
    out = {"n_valid": int(ok.sum()), "peak": np.nan, "peak_dekad": np.nan, "greenup_dekad": np.nan,
           "senesc_dekad": np.nan, "season_len": np.nan, "auc": np.nan,
           "spring": _mean(c[: 12 - D0]), "early_summer": _mean(c[15 - D0: 19 - D0]),
           "late_summer": _mean(c[21 - D0: 26 - D0]), "autumn": _mean(c[AUTUMN - D0:])}
    if ok.sum() < 3:
        return out
    i = int(np.nanargmax(c))
    peak = float(c[i])
    out["peak"], out["peak_dekad"] = peak, i + D0
    out["auc"] = float(np.nansum(np.clip(c - 0.2, 0, None)))
    before, after = c[: i + 1], c[i:]
    base0 = np.nanmin(before) if np.any(~np.isnan(before)) else np.nan
    base1 = np.nanmin(after) if np.any(~np.isnan(after)) else np.nan
    if not np.isnan(base0) and peak - base0 > 0.1:
        thr = base0 + 0.5 * (peak - base0)
        j = np.nonzero(before >= thr)[0]
        out["greenup_dekad"] = int(j[0]) + D0 if j.size else np.nan
    if not np.isnan(base1) and peak - base1 > 0.1:
        thr = base1 + 0.5 * (peak - base1)
        j = np.nonzero(after < thr)[0]
        out["senesc_dekad"] = int(j[0]) + i + D0 if j.size else np.nan
    if not (np.isnan(out["greenup_dekad"]) or np.isnan(out["senesc_dekad"])):
        out["season_len"] = out["senesc_dekad"] - out["greenup_dekad"]
    return out


def _mean(x: np.ndarray) -> float:
    return float(np.nanmean(x)) if np.any(~np.isnan(x)) else np.nan


def bare_days(curves: list[np.ndarray]) -> int | None:
    """Mean days per season (March–November) with greenness below BARE_NDVI, over years with enough looks."""
    per_year = [int(np.sum(c[~np.isnan(c)] < BARE_NDVI)) * 10 for c in curves if np.sum(~np.isnan(c)) >= MIN_VALID_BARE]
    return int(round(float(np.mean(per_year)))) if per_year else None


def autumn_state(c: np.ndarray, as_of: dt.date) -> dict:
    """State of the field in the current autumn, from this season's curve.

    winter_crop: a new green-up after a summer low (crop emerged after harvest);
    bare: the last autumn look is below BARE_AUTUMN (bare soil or stubble; in Cherkasy the median
    post-harvest October greenness of summer-crop fields is 0.31–0.34); green_cover: green without a post-harvest low
    (a crop still standing, weeds, volunteers); unknown: no autumn look.
    """
    res = {"state": "unknown", "asOf": as_of.isoformat()}
    aut = c[AUTUMN - D0:]
    okv = np.nonzero(~np.isnan(aut))[0]
    if okv.size == 0:
        return res
    last = float(aut[okv[-1]])
    if last < BARE_AUTUMN:
        res["state"] = "bare"
        return res
    s0, s1 = SUMMER[0] - D0, SUMMER[1] - D0 + 1
    summer = c[s0:s1]
    if np.all(np.isnan(summer)):
        res["state"] = "green_cover"
        return res
    ipk = int(np.nanargmax(summer)) + s0
    end = AUTUMN - D0 + int(okv[-1])
    between = c[ipk:end]
    trough = float(np.nanmin(between)) if np.any(~np.isnan(between)) else np.nan
    if last >= 0.40 and not np.isnan(trough) and trough < 0.35 and last - trough >= 0.10:
        res["state"] = "winter_crop"
    else:
        res["state"] = "green_cover"
    return res


# ---------- I/O ----------

def load_obs(ndvi_dir: Path, ids: set[str] | None = None) -> pd.DataFrame:
    """All tile-year parquet files with a .ok marker; adds a `tile` column."""
    parts = []
    for ok in sorted(Path(ndvi_dir).glob("*.ok")):
        p = ok.with_suffix(".parquet")
        if not p.exists():
            continue
        d = pd.read_parquet(p, columns=["id", "date", "ndvi", "frac"])
        if ids is not None:
            d = d[d["id"].isin(ids)]
        d["tile"] = ok.stem.split("_")[0]
        parts.append(d)
    return pd.concat(parts, ignore_index=True) if parts else pd.DataFrame(columns=["id", "date", "ndvi", "frac", "tile"])


def home_tile(obs: pd.DataFrame) -> pd.Series:
    """The tile that gave a field most of its looks (used for spatial train/test splits)."""
    n = obs.groupby(["id", "tile"]).size().reset_index(name="n")
    return n.sort_values(["id", "n"], ascending=[True, False]).drop_duplicates("id").set_index("id")["tile"]


if __name__ == "__main__":
    import time

    import pyarrow.parquet as pq

    from lan.config import WORK_DIR

    t = time.time()
    ids = set(pq.read_table(WORK_DIR / "cherkasy.parquet", columns=["id"]).column("id").to_pylist())
    obs = load_obs(WORK_DIR / "ndvi", ids)
    print(f"observations: {len(obs):,} for {obs['id'].nunique():,} fields, {time.time() - t:.0f}s", flush=True)
    home_tile(obs).to_frame("tile").to_parquet(WORK_DIR / "home_tile.parquet")
    cur = build_curves(obs)
    cur.columns = [f"d{k}" for k in cur.columns]
    cur.reset_index().to_parquet(WORK_DIR / "curves.parquet", index=False)
    nv = cur.notna().sum(axis=1)
    print(f"field-years: {len(cur):,}; valid dekads per field-year: median {nv.median():.0f}, "
          f"p10 {nv.quantile(0.1):.0f}; < 12 valid: {(nv < 12).mean():.1%}; {time.time() - t:.0f}s")
    print(cur.groupby(level="y").size().to_string())
