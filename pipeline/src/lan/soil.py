"""Topsoil per field from ISRIC SoilGrids 2.0 (250 m): clay %, sand %, organic carbon %, pH (H2O).

Depth-weighted mean of 0–5, 5–15 and 15–30 cm, sampled at the field centroid. Raw units: clay and
sand g/kg, soc dg/kg, phh2o pH×10. Each layer is read once as a window over the fields' extent.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

BASE = "https://files.isric.org/soilgrids/latest/data"
DEPTHS = [("0-5cm", 5), ("5-15cm", 10), ("15-30cm", 15)]
# property → divisor turning raw units into the contract's units (%, %, %, pH)
PROPS = {"clay": 10.0, "sand": 10.0, "soc": 100.0, "phh2o": 10.0}
CONTRACT = {"clay": "clay", "sand": "sand", "soc": "soc", "phh2o": "ph"}


def weighted(values: list[np.ndarray], weights: list[float]) -> np.ndarray:
    """Depth-weighted mean ignoring missing layers; NaN where every layer is missing."""
    v = np.vstack(values).astype(np.float64)
    w = np.array(weights, dtype=np.float64)[:, None] * np.isfinite(v)
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(w.sum(0) > 0, np.nansum(v * w, 0) / w.sum(0), np.nan)


def sample_layer(url: str, lon: np.ndarray, lat: np.ndarray) -> np.ndarray:
    import rasterio
    from rasterio.warp import transform
    from rasterio.windows import from_bounds

    with rasterio.open(url) as ds:
        xs, ys = transform("EPSG:4326", ds.crs, lon.tolist(), lat.tolist())
        xs, ys = np.asarray(xs), np.asarray(ys)
        pad = 1000.0
        win = from_bounds(xs.min() - pad, ys.min() - pad, xs.max() + pad, ys.max() + pad, ds.transform).round_offsets().round_lengths()
        arr = ds.read(1, window=win).astype(np.float64)
        nod = ds.nodata
        t = ds.window_transform(win)
    if nod is not None:
        arr[arr == nod] = np.nan
    cols = np.floor((xs - t.c) / t.a).astype(int)
    rows = np.floor((ys - t.f) / t.e).astype(int)
    ok = (rows >= 0) & (rows < arr.shape[0]) & (cols >= 0) & (cols < arr.shape[1])
    out = np.full(len(xs), np.nan)
    out[ok] = arr[rows[ok], cols[ok]]
    return out


def build(fields: pd.DataFrame) -> pd.DataFrame:
    """`fields` with id, lon, lat. Returns DataFrame indexed by id with clay, sand, soc, ph."""
    lon, lat = fields["lon"].to_numpy(), fields["lat"].to_numpy()
    out = pd.DataFrame(index=fields["id"].to_numpy())
    for prop, div in PROPS.items():
        layers = [sample_layer(f"/vsicurl/{BASE}/{prop}/{prop}_{d}_mean.vrt", lon, lat) / div for d, _ in DEPTHS]
        out[CONTRACT[prop]] = weighted(layers, [w for _, w in DEPTHS])
    return out.round(2)


if __name__ == "__main__":
    import sys
    from pathlib import Path

    from lan.config import WORK_DIR
    from lan.fields import load_fields

    f = load_fields(Path(sys.argv[1]) if len(sys.argv) > 1 else WORK_DIR / "cherkasy.parquet", columns=["id", "lon", "lat"])
    s = build(f)
    s.to_parquet(WORK_DIR / "soil_cherkasy.parquet")
    print(s.describe().round(2).to_string())
    print("missing:", int(s["clay"].isna().sum()), "of", len(s))
