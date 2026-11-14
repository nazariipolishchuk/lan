"""Order HLS tiles for processing: Cherkasy oblast first, then rings outward. Writes logs/tiles.txt.

A tile is kept if at least MIN_FIELDS field centroids fall inside its footprint.
"""

import logging
import math

import numpy as np
import pyarrow.parquet as pq
from shapely import contains_xy
from shapely.geometry import Polygon

from lan.config import LOGS_DIR, WORK_DIR, earthdata_login

UKRAINE_BBOX = (22.1, 44.3, 40.3, 52.4)
HOME = (31.9, 49.4)  # Cherkasy oblast centre (lon, lat)
MIN_FIELDS = 300


def footprints() -> dict[str, Polygon]:
    import earthaccess

    polys: dict[str, Polygon] = {}
    for t0, t1 in [("2025-07-01", "2025-07-10"), ("2025-07-11", "2025-07-20"), ("2025-07-21", "2025-07-31")]:
        for g in earthaccess.search_data(short_name="HLSS30_VI", bounding_box=UKRAINE_BBOX, temporal=(t0, t1), count=5000):
            tile = g["umm"]["GranuleUR"].split(".")[2]
            for gp in g["umm"]["SpatialExtent"]["HorizontalSpatialDomain"]["Geometry"].get("GPolygons", []):
                pts = [(p["Longitude"], p["Latitude"]) for p in gp["Boundary"]["Points"]]
                poly = Polygon(pts)
                if tile not in polys or poly.area > polys[tile].area:
                    polys[tile] = poly
    return polys


def main() -> None:
    logging.disable(logging.WARNING)
    earthdata_login()
    t = pq.read_table(WORK_DIR / "fields", columns=["lon", "lat", "oblast"]).to_pandas()
    lon, lat = t["lon"].to_numpy(), t["lat"].to_numpy()
    cherk = (t["oblast"] == "Cherkasy").to_numpy()
    rows = []
    for tile, poly in footprints().items():
        inside = contains_xy(poly, lon, lat)
        n = int(inside.sum())
        if n < MIN_FIELDS:
            continue
        c = poly.centroid
        dist = math.hypot((c.x - HOME[0]) * math.cos(math.radians(HOME[1])), c.y - HOME[1])
        rows.append((tile, n, int((inside & cherk).sum()), round(dist, 2)))
    # Cherkasy tiles (most Cherkasy fields first), then everything else by distance from Cherkasy
    home = sorted([r for r in rows if r[2] >= MIN_FIELDS], key=lambda r: -r[2])
    rest = sorted([r for r in rows if r[2] < MIN_FIELDS], key=lambda r: r[3])
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    with open(LOGS_DIR / "tiles.txt", "w", encoding="utf-8") as f:
        for r in home + rest:
            f.write(f"{r[0]} {r[1]} {r[2]} {r[3]}\n")
    print(f"tiles kept: {len(rows)} (Cherkasy: {len(home)}); fields covered: {np.sum([r[1] for r in rows])}")


if __name__ == "__main__":
    main()
