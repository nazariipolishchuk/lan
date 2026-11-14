"""Terrain per field from NASA NASADEM (SRTM reprocessed, 1 arc-second): mean slope, 90th-percentile
slope (both in %), mean elevation (m). The DEM is mosaicked, reprojected to UTM at 30 m, and fields are
rasterised onto that grid."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


SMOOTH_PX = 5  # SRTM height noise (a few metres) alone makes ~3–5 % "slope" at 30 m; smooth first


def slope_percent(dem: np.ndarray, px: float, smooth: int = 1) -> np.ndarray:
    """Slope in % from a DEM on a square grid with pixel size `px` metres (central differences),
    after a `smooth` × `smooth` moving average."""
    d = dem.astype(np.float64)
    if smooth > 1:
        from scipy.ndimage import uniform_filter

        nan = ~np.isfinite(d)
        if nan.all():
            return np.full_like(d, np.nan)
        d = uniform_filter(np.where(nan, np.nanmean(d), d), size=smooth, mode="nearest")  # NaN would poison it
        d[nan] = np.nan
    gy, gx = np.gradient(d, px)
    return np.hypot(gx, gy) * 100.0


def zonal_terrain(labels: np.ndarray, slope: np.ndarray, elev: np.ndarray, n: int) -> pd.DataFrame:
    """Per label 1..n: slope mean, slope p90, elevation mean. Labels with no pixels are absent."""
    m = (labels > 0) & np.isfinite(slope) & np.isfinite(elev)
    df = pd.DataFrame({"lab": labels[m], "slope": slope[m], "elev": elev[m]})
    g = df.groupby("lab")
    out = pd.DataFrame({"slope": g["slope"].mean(), "slopeP90": g["slope"].quantile(0.9), "elev": g["elev"].mean()})
    return out[out.index <= n]


def dem_tiles(bbox: tuple[float, float, float, float], dest: Path) -> list[Path]:
    """Download NASADEM_HGT 1-degree zips covering bbox (cached)."""
    import earthaccess

    dest.mkdir(parents=True, exist_ok=True)
    res = earthaccess.search_data(short_name="NASADEM_HGT", bounding_box=bbox)
    want = [g for g in res if not (dest / g.data_links()[0].rsplit("/", 1)[-1]).exists()]
    if want:
        earthaccess.download(want, str(dest), threads=4)
    return sorted(dest.glob("*.zip"))


def build(fields, raw_dir: Path) -> pd.DataFrame:
    """`fields` GeoDataFrame (id, geometry, lon/lat). Returns DataFrame indexed by id."""
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.features import rasterize
    from rasterio.merge import merge
    from rasterio.warp import calculate_default_transform, reproject

    w, s, e, n = fields.total_bounds
    zips = dem_tiles((w - 0.05, s - 0.05, e + 0.05, n + 0.05), raw_dir)
    # NASADEM_HGT_n49e031.zip holds n49e031.hgt
    srcs = [rasterio.open(f"/vsizip/{z.as_posix()}/{z.stem.split('_')[-1]}.hgt") for z in zips]
    mosaic, transform = merge(srcs, bounds=(w - 0.01, s - 0.01, e + 0.01, n + 0.01))
    crs_src = srcs[0].crs
    for r in srcs:
        r.close()
    zone = int((((w + e) / 2) + 180) // 6) + 1
    dst_crs = f"EPSG:326{zone:02d}"
    dt, width, height = calculate_default_transform(crs_src, dst_crs, mosaic.shape[2], mosaic.shape[1],
                                                    *rasterio.transform.array_bounds(mosaic.shape[1], mosaic.shape[2], transform),
                                                    resolution=30)
    elev = np.full((height, width), np.nan, dtype=np.float32)  # NaN outside the mosaic
    reproject(mosaic[0].astype(np.float32), elev, src_transform=transform, src_crs=crs_src,
              dst_transform=dt, dst_crs=dst_crs, resampling=Resampling.bilinear, src_nodata=-32768, dst_nodata=np.nan)
    slope = slope_percent(elev, 30.0, SMOOTH_PX)
    proj = fields.to_crs(dst_crs)
    labels = rasterize(((g, i + 1) for i, g in enumerate(proj.geometry)), out_shape=elev.shape, transform=dt,
                       fill=0, dtype="int32", all_touched=True)
    z = zonal_terrain(labels, slope, elev, len(fields))
    ids = np.asarray(fields["id"])
    z.index = ids[z.index.to_numpy() - 1]
    out = z.reindex(ids)
    return out.astype("float64").round(1)


if __name__ == "__main__":
    import logging
    import sys


    from lan.config import RAW_DIR, WORK_DIR, earthdata_login

    logging.disable(logging.WARNING)
    earthdata_login()
    from lan.fields import load_fields

    f = load_fields(Path(sys.argv[1]) if len(sys.argv) > 1 else WORK_DIR / "cherkasy.parquet")
    t = build(f, RAW_DIR / "nasadem")
    t.to_parquet(WORK_DIR / "terrain_cherkasy.parquet")
    print(t.describe().round(2).to_string())
    print("missing:", int(t["slope"].isna().sum()), "of", len(t))
