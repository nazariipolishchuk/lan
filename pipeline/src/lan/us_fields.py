"""USA fields: USDA NASS Crop Sequence Boundaries 2018–2025 (public domain) → work/fields_us/part-NNN.parquet
(same columns as the Ukrainian store, so the HLS and export code reads both) and work/crops_us/part-NNN.parquet
(id, CDL crop code per year 2018–2025).

`oblast` holds the US state name: the first-level region, as the oblast is in Ukraine.
Usage: uv run python -m lan.us_fields [--workers 6] [--chunk 500000]
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

from lan.fields import SIMPLIFY_DEG, SMALL_HA, chunk_key, climate_cell, field_id

STATES = {
    "01": "Alabama", "04": "Arizona", "05": "Arkansas", "06": "California", "08": "Colorado", "09": "Connecticut",
    "10": "Delaware", "11": "District of Columbia", "12": "Florida", "13": "Georgia", "16": "Idaho", "17": "Illinois",
    "18": "Indiana", "19": "Iowa", "20": "Kansas", "21": "Kentucky", "22": "Louisiana", "23": "Maine", "24": "Maryland",
    "25": "Massachusetts", "26": "Michigan", "27": "Minnesota", "28": "Mississippi", "29": "Missouri", "30": "Montana",
    "31": "Nebraska", "32": "Nevada", "33": "New Hampshire", "34": "New Jersey", "35": "New Mexico", "36": "New York",
    "37": "North Carolina", "38": "North Dakota", "39": "Ohio", "40": "Oklahoma", "41": "Oregon", "42": "Pennsylvania",
    "44": "Rhode Island", "45": "South Carolina", "46": "South Dakota", "47": "Tennessee", "48": "Texas", "49": "Utah",
    "50": "Vermont", "51": "Virginia", "53": "Washington", "54": "West Virginia", "55": "Wisconsin", "56": "Wyoming",
}
YEARS = list(range(2018, 2026))
GDB = "csb_nass/CSB1825.gdb"


def build_chunk(gdb: Path, skip: int, n: int, fields_dst: Path, crops_dst: Path) -> int:
    import geopandas as gpd
    import pyogrio
    from pyproj import Transformer

    cols = ["CSBID", "CSBACRES", *[f"CDL{y}" for y in YEARS], "STATEFIPS", "INSIDE_X", "INSIDE_Y", "Shape_Area"]
    df = pyogrio.read_dataframe(gdb, columns=cols, skip_features=skip, max_features=n)
    if df.empty:
        return 0
    tr = Transformer.from_crs(df.crs, "EPSG:4326", always_xy=True)
    lon, lat = tr.transform(df["INSIDE_X"].to_numpy(), df["INSIDE_Y"].to_numpy())
    df["lon"] = np.round(lon, 5)
    df["lat"] = np.round(lat, 5)
    df["ha"] = (df["Shape_Area"].astype("float64") / 1e4).round(2)
    df["id"] = [field_id(la, lo) for la, lo in zip(df["lat"], df["lon"])]
    df = df.drop_duplicates(subset="id", keep="first")
    df["ftw_id"] = df["CSBID"].astype(str)  # the source's own id, kept for traceability
    df["ck"] = [chunk_key(la, lo) for la, lo in zip(df["lat"], df["lon"])]
    df["cell"] = [climate_cell(la, lo) for la, lo in zip(df["lat"], df["lon"])]
    df["oblast"] = df["STATEFIPS"].astype(str).str.zfill(2).map(STATES).fillna("")
    df["small"] = df["ha"] < SMALL_HA
    df["conf"] = np.float32(100)
    geom = df.geometry.to_crs("EPSG:4326").simplify(SIMPLIFY_DEG, preserve_topology=True)
    out = gpd.GeoDataFrame(df[["id", "ftw_id", "ha", "conf", "lon", "lat", "ck", "cell", "oblast", "small"]].reset_index(drop=True),
                           geometry=geom.reset_index(drop=True), crs="EPSG:4326")
    out = out.sort_values(["lat", "lon"]).reset_index(drop=True)  # spatial order: bbox reads skip row groups
    out.to_wkb().to_parquet(fields_dst, index=False, row_group_size=20_000)
    crops = df[["id", *[f"CDL{y}" for y in YEARS]]].copy()
    for y in YEARS:
        crops[f"CDL{y}"] = crops[f"CDL{y}"].astype("int16")
    crops.to_parquet(crops_dst, index=False)
    return len(out)


def main() -> int:
    import argparse
    import subprocess
    from concurrent.futures import ThreadPoolExecutor

    import pyogrio

    from lan.config import RAW_DIR, WORK_DIR

    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--chunk", type=int, default=500_000)
    ap.add_argument("--part", nargs=3)  # internal: skip n index
    a = ap.parse_args()
    gdb = RAW_DIR / GDB
    fd, cd = WORK_DIR / "fields_us", WORK_DIR / "crops_us"
    if a.part:
        skip, n, i = map(int, a.part)
        k = build_chunk(gdb, skip, n, fd / f"part-{i:03d}.parquet", cd / f"part-{i:03d}.parquet")
        print(f"part {i}: {k} fields", flush=True)
        return 0
    fd.mkdir(parents=True, exist_ok=True)
    cd.mkdir(parents=True, exist_ok=True)
    total = pyogrio.read_info(gdb)["features"]
    jobs = [(s, a.chunk, i) for i, s in enumerate(range(0, total, a.chunk)) if not (fd / f"part-{i:03d}.parquet").exists()]
    t = time.time()
    print(f"{total:,} features, {len(jobs)} parts to build, {a.workers} workers", flush=True)

    def run(j):
        r = subprocess.run([sys.executable, "-m", "lan.us_fields", "--part", *map(str, j)], capture_output=True, text=True)
        print((r.stdout or r.stderr).strip().splitlines()[-1] if (r.stdout or r.stderr) else f"part {j[2]}: ?", f"({time.time() - t:.0f}s)", flush=True)

    with ThreadPoolExecutor(a.workers) as pool:
        list(pool.map(run, jobs))
    return 0


if __name__ == "__main__":
    sys.exit(main())
