"""Training labels (Path B+, gate G3).

Ukraine: per field-year majority class of the KPI winter/summer/uncultivated maps 2019–2024 (World Bank
DDH 0066913, CC-BY-4.0): 2 winter crops, 9 summer crops, 20 uncultivated. A label is kept only when the
majority class covers at least MIN_PURITY of the field's mapped pixels and the field is mostly mapped.

Red River (USA): USDA Crop Sequence Boundaries 2023 crop names mapped to our history classes.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

KPI_CLASSES = {2: "winter", 9: "summer", 20: "uncultivated"}
MIN_PURITY = 0.7
MIN_MAPPED = 0.5

CSB_TO_CLASS = {
    "Corn": "maize", "Soybeans": "soy", "Sugarbeets": "sugar_beet", "Sunflower": "sunflower",
    "Spring Wheat": "spring_cereal", "Barley": "spring_cereal", "Oats": "spring_cereal",
    "Durum Wheat": "spring_cereal",
    "Winter Wheat": "winter_cereal", "Rye": "winter_cereal",
    "Canola": "spring_rapeseed",  # spring-sown in the USA: not comparable with Ukrainian winter rapeseed
    "Dry Beans": "other", "Alfalfa": "other", "Grass/Pasture": "other", "Fallow/Idle Cropland": "other",
    "Other Hay/Non Alfalfa": "other", "Potatoes": "other",
}


def majority_label(counts: np.ndarray, total: int) -> str | None:
    """counts = pixels of classes (2, 9, 20) inside the field; total = all field pixels."""
    mapped = int(counts.sum())
    if total <= 0 or mapped < MIN_MAPPED * total or mapped == 0:
        return None
    i = int(np.argmax(counts))
    if counts[i] < MIN_PURITY * mapped:
        return None
    return list(KPI_CLASSES.values())[i]


def kpi_counts(raster: Path, fields, band_rows: int = 2048) -> pd.DataFrame:
    """Pixel counts of each KPI class inside each field. `fields`: GeoDataFrame with `id` (any CRS)."""
    return class_counts(raster, fields, KPI_CLASSES, band_rows)


# Ukraine crop type map 2020, 10 m (Chen, Tu et al. 2024, Commun. Earth Environ.; Zenodo 11065080, CC-BY-4.0)
UA2020_CLASSES = {1: "wheat", 2: "sunflower", 3: "rapeseed", 4: "other", 5: "maize"}


def class_counts(raster: Path, fields, classes: dict[int, str], band_rows: int = 2048) -> pd.DataFrame:
    """Pixel counts of each class (raster code → name) inside each field, plus `total` field pixels."""
    import rasterio
    from rasterio.features import rasterize
    from rasterio.windows import Window, from_bounds

    k = len(classes) + 1
    with rasterio.open(raster) as ds:
        f = fields.to_crs(ds.crs)
        win = from_bounds(*f.total_bounds, transform=ds.transform).round_offsets().round_lengths()
        col0, row0 = max(0, int(win.col_off)), max(0, int(win.row_off))
        width = int(win.width)
        row_end = min(ds.height, int(win.row_off + win.height) + 1)
        n = len(f)
        lut = np.zeros(256, dtype=np.int64)
        for j, code in enumerate(classes):
            lut[code] = j + 1  # 0 = none of the classes
        acc = np.zeros((n + 1) * k, dtype=np.int64)
        bounds = f.geometry.bounds
        for r in range(row0, row_end, band_rows):
            h = min(band_rows, row_end - r)
            w = Window(col0, r, width, h)
            tr = ds.window_transform(w)
            top, bottom = tr.f, tr.f + tr.e * h
            sel = np.nonzero((bounds.maxy.to_numpy() >= bottom) & (bounds.miny.to_numpy() <= top))[0]
            if sel.size == 0:
                continue
            lab = rasterize(((f.geometry.iloc[i], i + 1) for i in sel), out_shape=(h, width), transform=tr,
                            fill=0, dtype="int32")
            m = lab > 0
            if not m.any():
                continue
            v = ds.read(1, window=w, boundless=True, fill_value=0)
            acc += np.bincount(lab[m].astype(np.int64) * k + lut[v[m]], minlength=(n + 1) * k)
        acc = acc.reshape(n + 1, k)[1:]
    out = pd.DataFrame({"id": f["id"].to_numpy(), "total": acc.sum(1)})
    for j, name in enumerate(classes.values()):
        out[name] = acc[:, j + 1]
    return out


def crop_majority(c: pd.DataFrame, names: list[str]) -> pd.Series:
    """Majority class per field with the KPI rules (≥ 50 % of the field mapped, ≥ 70 % purity); None otherwise."""
    arr = c[names].to_numpy()
    return pd.Series([majority_of(arr[i], int(c["total"].iat[i]), names) for i in range(len(c))], index=c.index)


def majority_of(counts: np.ndarray, total: int, names: list[str]) -> str | None:
    mapped = int(counts.sum())
    if total <= 0 or mapped == 0 or mapped < MIN_MAPPED * total:
        return None
    i = int(np.argmax(counts))
    return names[i] if counts[i] >= MIN_PURITY * mapped else None


def kpi_labels(raw_dir: Path, fields, years=range(2019, 2025)) -> pd.DataFrame:
    rows = []
    for y in years:
        c = kpi_counts(raw_dir / f"Winter_Summer_{y}_19022025_crops.tif", fields)
        arr = c[["winter", "summer", "uncultivated"]].to_numpy()
        lab = [majority_label(arr[i], int(c.total.iat[i])) for i in range(len(c))]
        rows.append(pd.DataFrame({"id": c["id"], "y": y, "group": lab}))
        print(y, pd.Series(lab).value_counts(dropna=False).to_dict(), flush=True)
    return pd.concat(rows, ignore_index=True)


def csb_labels(csb: pd.DataFrame, year: int = 2023) -> pd.DataFrame:
    out = pd.DataFrame({"id": csb["id"].to_numpy(), "y": year, "crop": csb["crop:name"].map(CSB_TO_CLASS).to_numpy()})
    return out.dropna()


if __name__ == "__main__":
    import geopandas as gpd

    from lan.config import RAW_DIR, WORK_DIR

    from lan.fields import load_fields

    fields = load_fields(WORK_DIR / "cherkasy.parquet", columns=["id"])
    lab = kpi_labels(RAW_DIR / "kpi", fields)
    lab.dropna().to_parquet(WORK_DIR / "labels_kpi.parquet", index=False)
    csb = gpd.read_parquet(RAW_DIR / "csb" / "red_river.parquet", columns=["id", "crop:name", "geometry"])
    csb = csb[csb.area >= 2e4]
    cl = csb_labels(csb)
    cl.to_parquet(WORK_DIR / "labels_csb.parquet", index=False)
    print("csb", cl["crop"].value_counts().to_dict())
