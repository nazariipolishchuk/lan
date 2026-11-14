"""Process HLS greenness for MGRS tiles and seasons: python jobs/run_tile.py T36UVV 2025 [2024 ...]."""

import argparse
import json
import logging
import sys
import time

from lan.config import LOGS_DIR, WORK_DIR, earthdata_login
from lan.hls import run_tile_year


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("tile")
    ap.add_argument("years", nargs="+", type=int)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--per-dekad", type=int, default=1)
    ap.add_argument("--fields", default=None, help="fields store (default work/fields; USA: work/fields_us)")
    ap.add_argument("--out", default=None, help="output folder (default work/ndvi; USA: work/ndvi_us)")
    a = ap.parse_args()
    logging.disable(logging.WARNING)
    from lan.fields import load_fields

    earthdata_login()

    from pathlib import Path

    fields_dir = Path(a.fields) if a.fields else WORK_DIR / "fields"
    out_dir = Path(a.out) if a.out else WORK_DIR / "ndvi"

    def fields(bbox):
        return load_fields(fields_dir, bbox=bbox, columns=["id"])

    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    for y in a.years:
        t = time.time()
        st = run_tile_year(a.tile, y, fields, out_dir, workers=a.workers, per_dekad=a.per_dekad,
                           status_path=LOGS_DIR / f"status_{a.tile}.json")
        print(json.dumps({**st, "wall": round(time.time() - t, 1)}, default=str), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
