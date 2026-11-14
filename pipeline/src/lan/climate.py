"""Climate cells from NASA POWER daily data → out/climate/{cell}.json (contract §7.6 ClimateCell).

One request per POWER (MERRA-2) cell, 1991 → yesterday. Indicators per calendar year:
36 dekadal values of mean temperature, rain, reference evapotranspiration (FAO-56 Hargreaves), days with Tmax ≥ 30 °C
and ≥ 35 °C, minimum temperature, root-zone soil wetness; yearly GDD (base 5 and 10 °C), last spring
and first autumn frost (Tmin ≤ 0 °C), days with ≥ 20 mm of rain.
"""

from __future__ import annotations

import datetime as dt
import json
import math
import time
from pathlib import Path

import numpy as np
import pandas as pd

POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMS = ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "GWETROOT"]
FILL = -999.0
START_YEAR = 1991
FROST_C = 0.0
HEAVY_RAIN_MM = 20.0


def dekad_index(dates: pd.DatetimeIndex) -> np.ndarray:
    return (dates.month.to_numpy() - 1) * 3 + np.minimum(2, (dates.day.to_numpy() - 1) // 10)


def parse_power(payload: dict) -> pd.DataFrame:
    """POWER JSON → daily DataFrame indexed by date; the fill value becomes NaN."""
    p = payload["properties"]["parameter"]
    df = pd.DataFrame({k: pd.Series(v) for k, v in p.items()})
    df.index = pd.to_datetime(df.index, format="%Y%m%d")
    df = df.astype("float64").replace(FILL, np.nan)
    return df.sort_index()


def ra_mj(lat_deg: float, doy: np.ndarray) -> np.ndarray:
    """Extraterrestrial radiation Ra, MJ m-2 day-1 (FAO-56 eq. 21)."""
    phi = math.radians(lat_deg)
    dr = 1 + 0.033 * np.cos(2 * np.pi / 365 * doy)
    delta = 0.409 * np.sin(2 * np.pi / 365 * doy - 1.39)
    ws = np.arccos(np.clip(-np.tan(phi) * np.tan(delta), -1, 1))
    return 24 * 60 / np.pi * 0.0820 * dr * (ws * np.sin(phi) * np.sin(delta) + np.cos(phi) * np.cos(delta) * np.sin(ws))


def et0_hargreaves(tmean, tmax, tmin, lat_deg: float, doy) -> np.ndarray:
    """Reference evapotranspiration, mm/day (FAO-56 eq. 52; 0.408 converts MJ to mm)."""
    ra = ra_mj(lat_deg, np.asarray(doy))
    return 0.0023 * (np.asarray(tmean) + 17.8) * np.sqrt(np.clip(np.asarray(tmax) - np.asarray(tmin), 0, None)) * ra * 0.408


def gdd(tmean: np.ndarray, base: float) -> float:
    return float(np.nansum(np.clip(tmean - base, 0, None)))


def frost_dates(dates: pd.DatetimeIndex, tmin: np.ndarray) -> tuple[int | None, int | None]:
    """Last frost day before 1 July and first frost day from 1 July on (day of year), or None."""
    frost = tmin <= FROST_C
    doy = dates.dayofyear.to_numpy()
    spring = frost & (dates.month.to_numpy() < 7)
    autumn = frost & (dates.month.to_numpy() >= 7)
    last = int(doy[spring].max()) if spring.any() else None
    first = int(doy[autumn].min()) if autumn.any() else None
    return last, first


def _r(x: np.ndarray, nd: int = 1) -> list:
    return [None if not np.isfinite(v) else round(float(v), nd) for v in x]


def year_indicators(df: pd.DataFrame, lat: float) -> dict:
    """Indicators for one calendar year of daily data (index = dates of that year)."""
    d = df.index
    k = dekad_index(d)
    tmean, tmax, tmin = df["T2M"].to_numpy(), df["T2M_MAX"].to_numpy(), df["T2M_MIN"].to_numpy()
    rain = df["PRECTOTCORR"].to_numpy()
    et0 = et0_hargreaves(tmean, tmax, tmin, lat, d.dayofyear.to_numpy())

    def per_dekad(values: np.ndarray, how: str) -> np.ndarray:
        out = np.full(36, np.nan)
        for i in range(36):
            v = values[k == i]
            v = v[np.isfinite(v)]
            if v.size:
                out[i] = {"sum": v.sum, "min": v.min, "mean": v.mean}[how]()
        return out

    hot30 = per_dekad((tmax >= 30).astype(float) * np.where(np.isfinite(tmax), 1, np.nan), "sum")
    hot35 = per_dekad((tmax >= 35).astype(float) * np.where(np.isfinite(tmax), 1, np.nan), "sum")
    last, first = frost_dates(d, np.where(np.isfinite(tmin), tmin, 99))
    return {
        "y": int(d[0].year),
        "gdd5": round(gdd(tmean, 5)),
        "gdd10": round(gdd(tmean, 10)),
        "lastSpringFrostDoy": last,
        "firstAutumnFrostDoy": first,
        "heavyRainDays": int(np.nansum(rain >= HEAVY_RAIN_MM)),
        "tmean": _r(per_dekad(tmean, "mean")),
        "rain": _r(per_dekad(rain, "sum")),
        "et0": _r(per_dekad(et0, "sum")),
        "hot30": _r(hot30, 0),
        "hot35": _r(hot35, 0),
        "tmin": _r(per_dekad(tmin, "min")),
        "wet": _r(per_dekad(df["GWETROOT"].to_numpy(), "mean"), 2),
    }


def cell_center(cell: str) -> tuple[float, float]:
    lat, lon = cell.split("_")
    return float(lat), float(lon)


def build_cell(df: pd.DataFrame, cell: str) -> dict:
    lat, lon = cell_center(cell)
    years = []
    for y, part in df.groupby(df.index.year):
        if len(part) < 300 and y != df.index[-1].year:
            continue
        years.append(year_indicators(part, lat))
    return {"v": 1, "id": cell, "lat": lat, "lon": lon, "years": years}


def fetch_power(lat: float, lon: float, end: dt.date, session=None, tries: int = 7) -> dict:
    import requests

    s = session or requests.Session()
    params = {
        "parameters": ",".join(PARAMS), "community": "AG", "latitude": lat, "longitude": lon,
        "start": f"{START_YEAR}0101", "end": end.strftime("%Y%m%d"), "format": "JSON",
    }
    last = None
    for i in range(tries):
        try:
            r = s.get(POWER_URL, params=params, timeout=180)
            if r.status_code == 429:
                last = "429 Too Many Requests"
                time.sleep(20 * (i + 1))
                continue
            r.raise_for_status()
            return r.json()
        except Exception as e:  # retry network errors
            last = e
            time.sleep(5 * (i + 1))
    raise RuntimeError(f"POWER failed for {lat},{lon}: {last}")


def run(cells: list[str], out_dir: Path, raw_dir: Path, workers: int = 3) -> None:
    """Fetch and build every cell; raw JSON is cached so a rerun only rebuilds."""
    from concurrent.futures import ThreadPoolExecutor

    import requests

    out_dir.mkdir(parents=True, exist_ok=True)
    raw_dir.mkdir(parents=True, exist_ok=True)
    end = dt.date.today() - dt.timedelta(days=1)
    session = requests.Session()

    def one(cell: str) -> str | None:
        # a failed cell is reported and skipped; a rerun fetches only what is missing
        if (out_dir / f"{cell}.json").exists():
            return cell
        try:
            raw = raw_dir / f"{cell}.json"
            if not raw.exists():
                lat, lon = cell_center(cell)
                raw.write_text(json.dumps(fetch_power(lat, lon, end, session)), encoding="utf-8")
            df = parse_power(json.loads(raw.read_text(encoding="utf-8")))
            (out_dir / f"{cell}.json").write_text(json.dumps(build_cell(df, cell), separators=(",", ":")), encoding="utf-8")
            return cell
        except Exception as e:
            print(f"climate cell {cell} failed: {e}", flush=True)
            return None

    done = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for _ in pool.map(one, cells):
            done += 1
            if done % 20 == 0 or done == len(cells):
                print(f"climate cells {done}/{len(cells)}", flush=True)


if __name__ == "__main__":
    import sys

    from lan.config import OUT_DIR, RAW_DIR

    cells = Path(sys.argv[1]).read_text(encoding="utf-8").split()
    run(cells, OUT_DIR / "climate", RAW_DIR / "power")
