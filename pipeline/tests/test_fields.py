import geopandas as gpd
import pandas as pd
from shapely.geometry import box

from lan.fields import MIN_HA, SMALL_HA, chunk_key, climate_cell, field_id, prepare_fields


def _square_ha(lon, lat, ha):
    # ~ degrees for a square of the given hectares at this latitude (good enough for tests)
    import math

    side_m = math.sqrt(ha * 1e4)
    dlat = side_m / 111_320
    dlon = side_m / (111_320 * math.cos(math.radians(lat)))
    return box(lon, lat, lon + dlon, lat + dlat)


def _frame(rows):
    df = pd.DataFrame(rows)
    return gpd.GeoDataFrame(df, geometry="geometry", crs="EPSG:4326")


def test_chunk_key_formula():
    assert chunk_key(49.44, 32.06) == "557_848"


def test_climate_cell_snaps_to_power_grid():
    # POWER/MERRA-2 grid: 0.5 deg latitude, 0.625 deg longitude, centres on multiples
    assert climate_cell(49.44, 32.06) == "49.5_31.875"
    assert climate_cell(49.2, 32.2) == "49.0_32.500"


def test_small_fields_get_flag_and_slivers_are_dropped():
    rows = [
        {"id": "a", "metrics:area": 1.5e4, "confidence": 90.0, "admin:subdivision_code": "71",
         "geometry": _square_ha(32.0, 49.4, 1.5)},
        {"id": "b", "metrics:area": 30e4, "confidence": 99.0, "admin:subdivision_code": "71",
         "geometry": _square_ha(32.1, 49.4, 30)},
        {"id": "c", "metrics:area": 0.4e4, "confidence": 80.0, "admin:subdivision_code": "71",
         "geometry": _square_ha(32.2, 49.4, 0.4)},
    ]
    out = prepare_fields(_frame(rows)).set_index("ftw_id")
    assert MIN_HA <= 1.5 < SMALL_HA
    assert bool(out.loc["a", "small"]) is True
    assert bool(out.loc["b", "small"]) is False
    assert "c" not in out.index


def test_non_ukrainian_subdivisions_are_dropped():
    rows = [
        {"id": "a", "metrics:area": 30e4, "confidence": 99.0, "admin:subdivision_code": "BEL",
         "geometry": _square_ha(36.5, 50.5, 30)},
        {"id": "b", "metrics:area": 30e4, "confidence": 99.0, "admin:subdivision_code": "71",
         "geometry": _square_ha(32.1, 49.4, 30)},
    ]
    out = prepare_fields(_frame(rows))
    assert list(out["ftw_id"]) == ["b"]
    assert out.iloc[0]["oblast"] == "Cherkasy"


def test_ids_unique():
    rows = [
        {"id": "a", "metrics:area": 30e4, "confidence": 99.0, "admin:subdivision_code": "71",
         "geometry": _square_ha(32.1, 49.4, 30)},
        {"id": "a", "metrics:area": 30e4, "confidence": 99.0, "admin:subdivision_code": "71",
         "geometry": _square_ha(32.3, 49.4, 30)},
    ]
    out = prepare_fields(_frame(rows))
    assert len(out) == 2  # FTW ids repeat; ours come from the centroid
    assert out["id"].is_unique


def test_field_id_is_stable_and_short():
    assert field_id(49.44, 32.06) == field_id(49.44, 32.06)
    assert len(field_id(49.44, 32.06)) == 10
    assert field_id(49.44, 32.06) != field_id(49.44001, 32.06)


def test_build_streams_and_load_fields_filters_by_bbox(tmp_path):
    from lan.fields import build, load_fields

    rows = [
        {"id": "a", "metrics:area": 30e4, "confidence": 99.0, "admin:subdivision_code": "71",
         "geometry": _square_ha(32.1, 49.4, 30)},
        {"id": "b", "metrics:area": 30e4, "confidence": 99.0, "admin:subdivision_code": "71",
         "geometry": _square_ha(30.1, 48.6, 30)},
        {"id": "old", "metrics:area": 30e4, "confidence": 99.0, "admin:subdivision_code": "71",
         "geometry": _square_ha(31.1, 49.0, 30)},
    ]
    raw = _frame(rows)
    raw["determination:datetime"] = pd.to_datetime(["2025-01-01", "2025-01-01", "2024-01-01"], utc=True)
    src = tmp_path / "ftw.parquet"
    raw.to_parquet(src)
    summary = build(src, tmp_path / "fields.parquet")
    assert len(summary) == 2
    got = load_fields(tmp_path / "fields.parquet", bbox=(32.0, 49.3, 32.3, 49.6), columns=["id", "ftw_id"])
    assert list(got["ftw_id"]) == ["a"]
    assert got.geometry.iloc[0].area > 0
