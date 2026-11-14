"""Greenness per field from NASA HLS Vegetation Indices v2.0 (HLSL30_VI + HLSS30_VI).

For one MGRS tile and one season: search granules, keep the clearest scene per dekad (March–November),
stream NDVI + Fmask into memory, take the mean NDVI of each field's interior pixels with
numpy.bincount, append observations to a parquet file, write a .ok marker. Nothing is kept on disk
except the per-field results.
"""

from __future__ import annotations

import datetime as dt
import io
import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

COLLECTIONS = ("HLSL30_VI", "HLSS30_VI")
SEASON = ((3, 1), (11, 30))  # March 1 .. November 30 → dekads 6..32 (27 dekads)
NDVI_SCALE = 1e-4
MIN_VALID_FRAC = 0.6  # a field observation counts only if this share of its pixels is clear
MIN_INNER_PIXELS = 3  # below this many interior pixels, use all of the field's pixels
# Fmask v2 bits: 1 cloud, 2 adjacent to cloud/shadow, 3 cloud shadow, 4 snow/ice, 5 water
FMASK_BAD = (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5)


# ---------- pure helpers ----------

def dekad_of(d: dt.date) -> int:
    """0..35: three dekads per month (days 1–10, 11–20, 21–end)."""
    return (d.month - 1) * 3 + min(2, (d.day - 1) // 10)


def choose_scenes(scenes: list[dict], per_dekad: int = 1, min_clear: float = 20) -> list[dict]:
    """Keep the `per_dekad` scenes with the most expected clear area in each dekad.

    Expected clear share = tile coverage % × (100 − cloud %) / 100. Scenes below `min_clear` are skipped.
    """
    by_dekad: dict[int, list[tuple[float, dict]]] = {}
    for s in scenes:
        clear = s["cover"] * (100 - s["cloud"]) / 100
        if clear < min_clear:
            continue
        by_dekad.setdefault(dekad_of(s["date"]), []).append((clear, s))
    chosen = []
    for k in sorted(by_dekad):
        ranked = sorted(by_dekad[k], key=lambda t: (-t[0], t[1]["date"]))
        chosen += [s for _, s in ranked[:per_dekad]]
    return chosen


def valid_mask(fmask: np.ndarray, ndvi: np.ndarray, nodata: float | None) -> np.ndarray:
    ok = (fmask & FMASK_BAD) == 0
    ok &= fmask != 255
    if nodata is not None:
        ok &= ndvi != nodata
    return ok


def erode_labels(labels: np.ndarray) -> np.ndarray:
    """Zero every pixel whose 4-neighbour has a different label (or lies outside the raster)."""
    inner = labels.copy()
    inner[0, :] = 0
    inner[-1, :] = 0
    inner[:, 0] = 0
    inner[:, -1] = 0
    inner[1:, :][labels[1:, :] != labels[:-1, :]] = 0
    inner[:-1, :][labels[:-1, :] != labels[1:, :]] = 0
    inner[:, 1:][labels[:, 1:] != labels[:, :-1]] = 0
    inner[:, :-1][labels[:, :-1] != labels[:, 1:]] = 0
    return inner


class ZonalIndex:
    """Pixel positions of all fields in a tile, computed once; each scene then touches only those pixels."""

    def __init__(self, inner: np.ndarray, labels: np.ndarray, n: int):
        self.shape = labels.shape
        self.n = n
        self.sel = np.flatnonzero(labels.ravel() > 0)
        self.lab_all = labels.ravel()[self.sel]
        self.lab_in = inner.ravel()[self.sel]
        self.total_all = np.bincount(self.lab_all, minlength=n + 1)[: n + 1]
        self.total_in = np.bincount(self.lab_in, minlength=n + 1)[: n + 1]
        self.small = self.total_in < MIN_INNER_PIXELS  # these fields use all of their pixels

    def take(self, raster: np.ndarray) -> np.ndarray:
        return raster.ravel()[self.sel]

    def means(self, values: np.ndarray, valid: np.ndarray):
        """`values` and `valid` are already restricted with `take`. Returns mean, valid count, total count."""
        n = self.n
        w = np.where(valid, values, 0).astype(np.float64)
        lab_in = np.where(valid, self.lab_in, 0)
        lab_all = np.where(valid, self.lab_all, 0)
        s_in = np.bincount(lab_in, weights=w, minlength=n + 1)[: n + 1]
        c_in = np.bincount(lab_in, minlength=n + 1)[: n + 1]
        s, c, t = s_in, c_in, self.total_in
        if self.small.any():
            s_all = np.bincount(lab_all, weights=w, minlength=n + 1)[: n + 1]
            c_all = np.bincount(lab_all, minlength=n + 1)[: n + 1]
            s = np.where(self.small, s_all, s_in)
            c = np.where(self.small, c_all, c_in)
            t = np.where(self.small, self.total_all, self.total_in)
        with np.errstate(invalid="ignore", divide="ignore"):
            mean = np.where(c > 0, s / np.maximum(c, 1), np.nan)
        mean[0] = np.nan
        return mean, c, t


def zonal_means(inner: np.ndarray, labels: np.ndarray, ndvi: np.ndarray, valid: np.ndarray, n: int):
    """Mean NDVI, valid pixel count and total pixel count per label 1..n (index 0 = background).

    Interior pixels are used; fields with fewer than MIN_INNER_PIXELS interior pixels use all pixels.
    """
    z = ZonalIndex(inner, labels, n)
    return z.means(z.take(ndvi), z.take(valid))


def _marker(out_dir: Path, tile: str, year: int) -> Path:
    return Path(out_dir) / f"{tile}_{year}.ok"


def is_done(out_dir: Path, tile: str, year: int) -> bool:
    return _marker(out_dir, tile, year).exists()


def mark_done(out_dir: Path, tile: str, year: int, stats: dict) -> None:
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    _marker(out_dir, tile, year).write_text(json.dumps(stats), encoding="utf-8")


# ---------- I/O ----------

def _attr(umm: dict, name: str, default: float) -> float:
    for a in umm.get("AdditionalAttributes", []):
        if a.get("Name") == name:
            try:
                return float(a["Values"][0])
            except (KeyError, IndexError, ValueError):
                return default
    return default


def search_scenes(tile: str, year: int) -> list[dict]:
    import earthaccess

    (m0, d0), (m1, d1) = SEASON
    scenes = []
    for short_name in COLLECTIONS:
        res = earthaccess.search_data(
            short_name=short_name,
            granule_name=f"HLS-VI.*.{tile}.{year}*",
            temporal=(f"{year}-{m0:02d}-{d0:02d}", f"{year}-{m1:02d}-{d1:02d}T23:59:59"),
        )
        for g in res:
            umm = g["umm"]
            ur = umm["GranuleUR"]  # HLS-VI.S30.T36UVV.2025183T084559.v2.0
            parts = ur.split(".")
            stamp = parts[3][:7]
            date = dt.datetime.strptime(stamp, "%Y%j").date()
            links = g.data_links()
            ndvi = next((u for u in links if u.endswith(".NDVI.tif")), None)
            fmask = next((u for u in links if u.endswith(".Fmask.tif")), None)
            if not ndvi or not fmask:
                continue
            scenes.append({
                "ur": ur, "sensor": parts[1], "date": date,
                "cloud": _attr(umm, "CLOUD_COVERAGE", 100), "cover": _attr(umm, "SPATIAL_COVERAGE", 100),
                "ndvi": ndvi, "fmask": fmask,
            })
    return scenes


def _get(session, url: str, tries: int = 4) -> bytes:
    last = None
    for i in range(tries):
        try:
            r = session.get(url, timeout=120)
            r.raise_for_status()
            return r.content
        except Exception as e:  # network hiccups: retry with backoff
            last = e
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"download failed after {tries} tries: {url.rsplit('/', 1)[-1]}: {last}")


def _read(blob: bytes):
    import rasterio

    with rasterio.MemoryFile(io.BytesIO(blob)) as mf, mf.open() as ds:
        return ds.read(1), ds.profile, ds.nodata


def build_labels(fields, profile) -> tuple[np.ndarray, list[str]]:
    """Rasterise the fields lying fully inside the scene grid. Returns labels (1..n) and their ids."""
    from rasterio.features import rasterize
    from rasterio.transform import array_bounds
    from shapely.geometry import box

    h, w = profile["height"], profile["width"]
    t = profile["transform"]
    west, south, east, north = array_bounds(h, w, t)
    px = abs(t.a)
    frame = box(west + px, south + px, east - px, north - px)
    proj = fields.to_crs(profile["crs"])
    inside = proj[proj.geometry.within(frame)]
    ids = list(inside["id"])
    shapes = ((geom, i + 1) for i, geom in enumerate(inside.geometry))
    labels = rasterize(shapes, out_shape=(h, w), transform=t, fill=0, dtype="int32", all_touched=False)
    return labels, ids


def run_tile_year(tile: str, year: int, fields_loader, out_dir: Path, workers: int = 4,
                  per_dekad: int = 1, status_path: Path | None = None) -> dict:
    """Process one MGRS tile for one season.

    `fields_loader(bbox)` returns a GeoDataFrame (`id`, geometry) of fields whose centroid lies in the
    lon/lat bbox (west, south, east, north).
    """
    import earthaccess
    import pandas as pd

    out_dir = Path(out_dir)
    if is_done(out_dir, tile, year):
        return {"tile": tile, "year": year, "skipped": True}
    t0 = time.time()
    scenes = choose_scenes(search_scenes(tile, year), per_dekad=per_dekad)
    session = earthaccess.get_requests_https_session()
    stats = {"tile": tile, "year": year, "scenes_found": 0, "scenes": 0, "mb": 0.0, "obs": 0, "errors": []}
    stats["scenes_found"] = len(scenes)
    if not scenes:
        mark_done(out_dir, tile, year, {**stats, "seconds": round(time.time() - t0, 1)})
        return stats

    # the label raster comes from the first scene's grid (all scenes of a tile share it)
    first = _get(session, scenes[0]["ndvi"])
    _, profile, _ = _read(first)
    from rasterio.transform import array_bounds
    from rasterio.warp import transform_bounds

    bounds = array_bounds(profile["height"], profile["width"], profile["transform"])
    fields = fields_loader(transform_bounds(profile["crs"], "EPSG:4326", *bounds))
    labels, ids = build_labels(fields, profile)
    n = len(ids)
    zi = ZonalIndex(erode_labels(labels), labels, n)
    del labels, fields
    stats["fields"] = n

    def work(s):
        a = _get(session, s["ndvi"])
        b = _get(session, s["fmask"])
        ndvi, _, nodata = _read(a)
        nd = zi.take(ndvi)
        del ndvi
        fmask, _, _ = _read(b)
        fm = zi.take(fmask)
        del fmask
        valid = valid_mask(fm, nd, nodata)
        mean, nvalid, ntotal = zi.means(nd.astype(np.float32) * NDVI_SCALE, valid)
        frac = np.where(ntotal > 0, nvalid / np.maximum(ntotal, 1), 0.0)
        keep = np.nonzero(frac[1:] >= MIN_VALID_FRAC)[0] + 1
        return s, len(a) + len(b), keep, mean[keep], frac[keep]

    rows = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for s, nbytes, keep, mean, frac in pool.map(_safe(work), scenes):
            if s is None:
                stats["errors"].append(str(nbytes))
                continue
            stats["scenes"] += 1
            stats["mb"] += nbytes / 1e6
            rows.append(pd.DataFrame({
                "id": [ids[i - 1] for i in keep],
                "date": s["date"], "sensor": s["sensor"],
                "ndvi": mean.astype("float32"), "frac": frac.astype("float32"),
            }))
            if status_path:
                _write_status(status_path, {**stats, "elapsed": round(time.time() - t0, 1)})
    obs = pd.concat(rows, ignore_index=True) if rows else pd.DataFrame(
        columns=["id", "date", "sensor", "ndvi", "frac"])
    obs["date"] = pd.to_datetime(obs["date"])
    out_dir.mkdir(parents=True, exist_ok=True)
    obs.to_parquet(out_dir / f"{tile}_{year}.parquet", index=False)
    stats["obs"] = len(obs)
    stats["mb"] = round(stats["mb"], 1)
    stats["seconds"] = round(time.time() - t0, 1)
    if not stats["errors"] or stats["scenes"] >= 0.8 * len(scenes):
        mark_done(out_dir, tile, year, stats)
    return stats


def _safe(fn):
    def wrapped(s):
        try:
            return fn(s)
        except Exception as e:
            return None, f"{s['ur']}: {e}", None, None, None
    return wrapped


def _write_status(path: Path, data: dict) -> None:
    tmp = Path(path).with_suffix(".tmp")
    tmp.write_text(json.dumps(data, default=str), encoding="utf-8")
    tmp.replace(path)
