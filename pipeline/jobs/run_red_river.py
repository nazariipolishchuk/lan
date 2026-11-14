"""HLS greenness for the Red River Valley validation tiles (USDA Crop Sequence Boundaries 2023).

python jobs/run_red_river.py T14TPT 2023 [--workers 4]

Fields come from `data/raw/csb/red_river.parquet` (fiboa CSB subset, EPSG:5070); fields under 2 ha are
dropped as in Ukraine. Observations go to `data/work/ndvi_rr/`.
"""

import argparse
import json
import logging
import sys
import time

from lan.config import LOGS_DIR, RAW_DIR, WORK_DIR, earthdata_login
from lan.hls import run_tile_year


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("tile")
    ap.add_argument("years", nargs="+", type=int)
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    logging.disable(logging.WARNING)
    import geopandas as gpd
    from shapely.geometry import box

    earthdata_login()
    csb = gpd.read_parquet(RAW_DIR / "csb" / "red_river.parquet", columns=["id", "geometry"])
    csb = csb[csb.area >= 2e4].to_crs(4326)
    cent = csb.to_crs(5070).geometry.centroid.to_crs(4326)

    def fields(bbox):
        return csb[cent.within(box(*bbox))]

    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    for y in a.years:
        t = time.time()
        st = run_tile_year(a.tile, y, fields, WORK_DIR / "ndvi_rr", workers=a.workers,
                           status_path=LOGS_DIR / f"status_rr_{a.tile}.json")
        print(json.dumps({**st, "wall": round(time.time() - t, 1)}, default=str), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
