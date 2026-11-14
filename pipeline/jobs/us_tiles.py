"""HLS tile list for the USA (all-US build): 100 km cells holding SHARE of the CSB fields → MGRS tiles from
NASA CMR → data/logs/tiles_us.txt ("TILE n_fields", most fields first, so a partial run covers the most fields).

Usage: uv run python jobs/us_tiles.py [share=0.95]
"""

from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

from lan.config import LOGS_DIR, earthdata_login

CSB = "https://data.source.coop/fiboa/us-usda-cropland/us_usda_cropland.parquet"


def cells(share: float) -> list[tuple[float, float, float, float, int]]:
    """(west, south, east, north, n_fields) in lon/lat of the 100 km Albers cells covering `share` of fields."""
    import duckdb
    from pyproj import Transformer

    c = duckdb.connect()
    c.execute("INSTALL httpfs; LOAD httpfs;")
    rows = c.execute(f"""SELECT floor((bbox.xmin+bbox.xmax)/2/100000) gx, floor((bbox.ymin+bbox.ymax)/2/100000) gy, count(*) n
                         FROM read_parquet('{CSB}') GROUP BY 1, 2 ORDER BY n DESC""").fetchall()
    n = np.array([r[2] for r in rows])
    keep = int(np.searchsorted(np.cumsum(n) / n.sum(), share)) + 1
    tr = Transformer.from_crs("EPSG:5070", "EPSG:4326", always_xy=True)
    out = []
    for gx, gy, k in rows[:keep]:
        xs = [gx * 1e5, (gx + 1) * 1e5]
        ys = [gy * 1e5, (gy + 1) * 1e5]
        lon, lat = tr.transform([xs[0], xs[1], xs[0], xs[1]], [ys[0], ys[0], ys[1], ys[1]])
        out.append((min(lon), min(lat), max(lon), max(lat), int(k)))
    return out


def tiles_of(bbox) -> set[str]:
    import earthaccess

    for attempt in range(4):
        try:
            res = earthaccess.search_data(short_name="HLSS30_VI", bounding_box=bbox, temporal=("2025-07-01", "2025-07-20"), count=200)
            return {g["umm"]["GranuleUR"].split(".")[2] for g in res}
        except Exception:
            time.sleep(2 + attempt * 3)
    return set()


def main() -> int:
    share = float(sys.argv[1]) if len(sys.argv) > 1 else 0.95
    t = time.time()
    cs = cells(share)
    print(f"cells: {len(cs)} covering {share:.0%} of fields, {sum(c[4] for c in cs):,} fields, {time.time() - t:.0f}s", flush=True)
    earthdata_login()
    weight: dict[str, float] = {}
    with ThreadPoolExecutor(8) as pool:
        for c, ts in zip(cs, pool.map(lambda c: tiles_of(c[:4]), cs)):
            for tile in ts:  # a cell's fields are shared among the tiles that touch it
                weight[tile] = weight.get(tile, 0) + c[4] / max(1, len(ts))
    order = sorted(weight.items(), key=lambda kv: -kv[1])
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    (LOGS_DIR / "tiles_us.txt").write_text("".join(f"{k} {int(v)}\n" for k, v in order), encoding="utf-8")
    (LOGS_DIR / "tiles_us_cells.json").write_text(json.dumps(cs), encoding="utf-8")
    print(f"tiles: {len(order)}, {time.time() - t:.0f}s", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
