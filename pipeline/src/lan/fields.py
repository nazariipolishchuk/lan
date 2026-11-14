"""Field polygons: Fields of The World (FTW) Ukraine 2025 → work/fields.parquet.

Keeps polygons of at least MIN_HA inside Ukrainian oblasts; flags those under SMALL_HA as `small`.
Adds centroid, chunk key (0.25 deg grid) and POWER climate cell id.
"""

from __future__ import annotations

import math
from pathlib import Path

import geopandas as gpd
import pandas as pd

MIN_HA = 1.0
SMALL_HA = 2.0
FTW_YEAR = 2025

# ISO 3166-2:UA subdivision code → English oblast name (FTW stores only the part after "UA-").
OBLASTS: dict[str, str] = {
    "05": "Vinnytsia", "07": "Volyn", "09": "Luhansk", "12": "Dnipropetrovsk", "14": "Donetsk",
    "18": "Zhytomyr", "21": "Zakarpattia", "23": "Zaporizhzhia", "26": "Ivano-Frankivsk",
    "30": "Kyiv City", "32": "Kyiv", "35": "Kirovohrad", "40": "Sevastopol", "43": "Crimea",
    "46": "Lviv", "48": "Mykolaiv", "51": "Odesa", "53": "Poltava", "56": "Rivne", "59": "Sumy",
    "61": "Ternopil", "63": "Kharkiv", "65": "Kherson", "68": "Khmelnytskyi", "71": "Cherkasy",
    "74": "Chernihiv", "77": "Chernivtsi",
}


def chunk_key(lat: float, lon: float) -> str:
    """0.25 deg grid cell of a point, as in PLAN §7.6."""
    return f"{math.floor((lat + 90) / 0.25)}_{math.floor((lon + 180) / 0.25)}"


def climate_cell(lat: float, lon: float) -> str:
    """Id of the NASA POWER (MERRA-2) cell containing the point: centre lat (0.5 deg), lon (0.625 deg)."""
    clat = round(lat / 0.5) * 0.5
    clon = round((lon + 180) / 0.625) * 0.625 - 180
    return f"{clat:.1f}_{clon:.3f}"


def _b36(n: int, width: int) -> str:
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = ""
    while n:
        n, r = divmod(n, 36)
        out = digits[r] + out
    return out.rjust(width, "0")


def field_id(lat: float, lon: float) -> str:
    """Stable 10-character id from the centroid at ~1 m precision. FTW's own ids repeat across its
    processing chunks (584,893 Ukrainian fields carry only 351,295 distinct FTW ids)."""
    return _b36(round((lat + 90) * 1e5), 5) + _b36(round((lon + 180) * 1e5), 5)


def prepare_fields(raw: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Filter and enrich raw FTW rows (columns as in the FTW GeoParquet)."""
    df = raw[raw["admin:subdivision_code"].isin(list(OBLASTS))].copy()
    df["ha"] = df["metrics:area"].astype("float64") / 1e4
    df = df[df["ha"] >= MIN_HA]
    # centroids in an equal-area projection, then back to lon/lat
    cent = df.geometry.to_crs("EPSG:6933").centroid.to_crs("EPSG:4326")
    df["lon"] = cent.x.round(5)
    df["lat"] = cent.y.round(5)
    df["ftw_id"] = df["id"].astype(str)
    df["id"] = [field_id(la, lo) for la, lo in zip(df["lat"], df["lon"])]
    df = df.drop_duplicates(subset="id", keep="first")
    df["ck"] = [chunk_key(la, lo) for la, lo in zip(df["lat"], df["lon"])]
    df["cell"] = [climate_cell(la, lo) for la, lo in zip(df["lat"], df["lon"])]
    df["oblast"] = df["admin:subdivision_code"].map(OBLASTS)
    df["small"] = df["ha"] < SMALL_HA
    df["conf"] = df["confidence"].astype("float32")
    df["ha"] = df["ha"].round(2)
    out = df[["id", "ftw_id", "ha", "conf", "lon", "lat", "ck", "cell", "oblast", "small", "geometry"]]
    return gpd.GeoDataFrame(out.reset_index(drop=True), geometry="geometry", crs="EPSG:4326")


SIMPLIFY_DEG = 0.00003  # ≈ 2–3 m; FTW outlines are 10 m pixel staircases


def iter_ftw(path: Path, year: int = FTW_YEAR, batch_size: int = 20_000, row_groups=None):
    """Yield raw FTW rows of one year and at least MIN_HA, batch by batch (the VPS has 2 GB of RAM)."""
    import pyarrow.parquet as pq

    pf = pq.ParquetFile(path)
    cols = ["id", "metrics:area", "confidence", "admin:subdivision_code", "determination:datetime", "geometry"]
    for batch in pf.iter_batches(batch_size=batch_size, columns=cols, row_groups=row_groups):
        t = batch.to_pandas()
        t = t[(t["metrics:area"] >= MIN_HA * 1e4) & (t["determination:datetime"].dt.year == year)]
        if not len(t):
            continue
        t = t.drop(columns=["determination:datetime"])
        geom = gpd.GeoSeries.from_wkb(t.pop("geometry").values, crs="EPSG:4326")
        yield gpd.GeoDataFrame(t.reset_index(drop=True), geometry=geom.values, crs="EPSG:4326")


def build(src: Path, dst: Path, row_groups=None) -> pd.DataFrame:
    """Stream FTW → one parquet file (geometry as WKB, simplified). Returns a summary without geometry."""
    import pyarrow as pa
    import pyarrow.parquet as pq

    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_suffix(".tmp")
    writer = None
    seen: set[str] = set()
    summary = []
    try:
        for raw in iter_ftw(src, row_groups=row_groups):
            f = prepare_fields(raw)
            f = f[~f["id"].isin(seen)]
            seen.update(f["id"])
            if not len(f):
                continue
            f["geometry"] = f.geometry.simplify(SIMPLIFY_DEG, preserve_topology=True)
            table = pa.Table.from_pandas(f.to_wkb(), preserve_index=False)
            if writer is None:
                writer = pq.ParquetWriter(tmp, table.schema, compression="zstd")
            writer.write_table(table.cast(writer.schema))
            summary.append(f[["oblast", "ha", "small"]].copy())
    finally:
        if writer is not None:
            writer.close()
    if writer is None:
        return pd.DataFrame(columns=["oblast", "ha", "small"])
    tmp.replace(dst)
    return pd.concat(summary, ignore_index=True)


def load_fields(path: Path, bbox: tuple[float, float, float, float] | None = None,
                columns: list[str] | None = None) -> gpd.GeoDataFrame:
    """Read a fields parquet file or directory, optionally only fields whose centroid is in bbox (lon/lat)."""
    import pyarrow.parquet as pq

    path = Path(path)
    files = sorted(path.glob("*.parquet")) if path.is_dir() else [path]
    cols = None if columns is None else list(dict.fromkeys([*columns, "id", "geometry"]))
    parts = []
    # Row group by row group: coordinates first, geometry only where the bbox matches (2 GB RAM on the VPS).
    for f in files:
        pf = pq.ParquetFile(f)
        for i in range(pf.num_row_groups):
            if bbox:
                w, s, e, n = bbox
                xy = pf.read_row_group(i, columns=["lon", "lat"]).to_pandas()
                mask = ((xy["lon"] >= w) & (xy["lon"] <= e) & (xy["lat"] >= s) & (xy["lat"] <= n)).to_numpy()
                if not mask.any():
                    continue
                parts.append(pf.read_row_group(i, columns=cols).to_pandas()[mask])
            else:
                parts.append(pf.read_row_group(i, columns=cols).to_pandas())
    if parts:
        df = pd.concat(parts, ignore_index=True)
    else:
        df = pq.read_schema(files[0]).empty_table().to_pandas()
        if cols:
            df = df[cols]
    # border fields can sit in two FTW partitions (288 of 598,088 in Ukraine): keep one
    keep = ~df["id"].duplicated() if "id" in df.columns else slice(None)
    df = df[keep].reset_index(drop=True)
    geom = gpd.GeoSeries.from_wkb(df.pop("geometry").values, crs="EPSG:4326")
    return gpd.GeoDataFrame(df, geometry=geom.values, crs="EPSG:4326")


def build_parts(src: Path, out_dir: Path, groups_per_part: int = 4) -> None:
    """Run `build` in a fresh subprocess per few row groups, so memory is returned between parts."""
    import subprocess
    import sys

    import pyarrow.parquet as pq

    n = pq.ParquetFile(src).num_row_groups
    out_dir.mkdir(parents=True, exist_ok=True)
    for start in range(0, n, groups_per_part):
        stop = min(n, start + groups_per_part)
        dst = out_dir / f"part-{start:03d}.parquet"
        if dst.exists():
            continue
        subprocess.run([sys.executable, "-m", "lan.fields", "--part", str(src), str(dst), str(start), str(stop)],
                       check=True)
        print(f"row groups {start}-{stop - 1} of {n} done", flush=True)


if __name__ == "__main__":
    import sys

    from lan.config import RAW_DIR, WORK_DIR

    if len(sys.argv) > 1 and sys.argv[1] == "--part":
        _, _, src_s, dst_s, a, b = sys.argv
        build(Path(src_s), Path(dst_s), row_groups=list(range(int(a), int(b))))
        sys.exit(0)
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else RAW_DIR / "ftw" / "Ukraine.parquet"
    out = WORK_DIR / "fields"
    build_parts(src, out)
    import pyarrow.parquet as pq

    t = pq.read_table(out, columns=["id", "oblast", "ha", "small"]).to_pandas()
    print(f"fields: {len(t)} unique ids: {t['id'].is_unique} small: {int(t['small'].sum())}")
    print(t.groupby("oblast").agg(n=("ha", "size"), ha=("ha", "sum")).round(0).to_string())
