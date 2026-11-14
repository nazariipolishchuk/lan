import datetime as dt

import numpy as np

from lan.hls import (
    choose_scenes,
    dekad_of,
    erode_labels,
    is_done,
    mark_done,
    valid_mask,
    zonal_means,
)


def test_dekad_of():
    assert dekad_of(dt.date(2025, 1, 1)) == 0
    assert dekad_of(dt.date(2025, 3, 10)) == 6
    assert dekad_of(dt.date(2025, 3, 11)) == 7
    assert dekad_of(dt.date(2025, 3, 31)) == 8
    assert dekad_of(dt.date(2025, 11, 30)) == 32


def test_zonal_mean_on_synthetic_raster():
    labels = np.zeros((6, 9), dtype=np.int32)
    labels[:, 0:3] = 1
    labels[:, 3:6] = 2
    labels[:, 6:9] = 3
    ndvi = np.zeros((6, 9), dtype=np.float32)
    ndvi[:, 0:3] = 0.2
    ndvi[:, 3:6] = 0.5
    ndvi[:, 6:9] = 0.8
    valid = np.ones_like(labels, dtype=bool)
    mean, nvalid, ntotal = zonal_means(labels, labels, ndvi, valid, 3)
    np.testing.assert_allclose(mean[1:], [0.2, 0.5, 0.8], atol=1e-6)
    assert list(ntotal[1:]) == [18, 18, 18]
    assert list(nvalid[1:]) == [18, 18, 18]


def test_masked_pixels_are_excluded():
    labels = np.ones((4, 4), dtype=np.int32)
    ndvi = np.full((4, 4), 0.6, dtype=np.float32)
    ndvi[0, :] = -0.9  # cloud-covered row with a bogus value
    valid = np.ones_like(labels, dtype=bool)
    valid[0, :] = False
    mean, nvalid, ntotal = zonal_means(labels, labels, ndvi, valid, 1)
    assert abs(mean[1] - 0.6) < 1e-6
    assert nvalid[1] == 12 and ntotal[1] == 16


def test_valid_mask_reads_fmask_bits():
    fmask = np.array([0b00000000, 0b00000010, 0b00000100, 0b00001000, 0b00010000, 0b00100000,
                      0b01000000, 0b11000000, 255], dtype=np.uint8)
    ndvi = np.zeros(fmask.shape, dtype=np.int16)
    got = valid_mask(fmask, ndvi, nodata=-19999)
    # clear, cloud, adjacent, shadow, snow, water, low aerosol, high aerosol, fill
    assert list(got) == [True, False, False, False, False, False, True, True, False]


def test_valid_mask_excludes_ndvi_nodata():
    fmask = np.zeros(2, dtype=np.uint8)
    ndvi = np.array([5000, -19999], dtype=np.int16)
    assert list(valid_mask(fmask, ndvi, nodata=-19999)) == [True, False]


def test_erode_labels_drops_edge_pixels():
    labels = np.zeros((5, 10), dtype=np.int32)
    labels[:, :5] = 1
    labels[:, 5:] = 2
    inner = erode_labels(labels)
    # pixels next to the 1|2 boundary and the raster border are removed
    assert inner[2, 2] == 1 and inner[2, 7] == 2
    assert inner[2, 4] == 0 and inner[2, 5] == 0
    assert inner[0, 2] == 0


def test_small_field_falls_back_to_all_pixels():
    labels = np.zeros((5, 5), dtype=np.int32)
    labels[2, 2] = 1  # one-pixel field disappears after erosion
    inner = erode_labels(labels)
    ndvi = np.full((5, 5), 0.4, dtype=np.float32)
    valid = np.ones_like(labels, dtype=bool)
    mean, nvalid, ntotal = zonal_means(inner, labels, ndvi, valid, 1)
    assert abs(mean[1] - 0.4) < 1e-6 and ntotal[1] == 1


def _scene(day, cloud, cover=100, sensor="S30"):
    d = dt.date(2025, 1, 1) + dt.timedelta(days=day - 1)
    return {"date": d, "cloud": cloud, "cover": cover, "sensor": sensor, "ur": f"x{day}"}


def test_clearest_scene_per_dekad_is_chosen():
    scenes = [
        _scene(182, 60),  # 1 Jul, dekad 18
        _scene(185, 5),  # 4 Jul, dekad 18 — clearest
        _scene(188, 30),  # 7 Jul, dekad 18
        _scene(193, 90),  # 12 Jul, dekad 19 — only option but too cloudy
        _scene(203, 10, cover=40),  # 22 Jul, dekad 20 — partial tile coverage
        _scene(204, 25, cover=100),  # 23 Jul, dekad 20 — more usable pixels
    ]
    chosen = choose_scenes(scenes, per_dekad=1, min_clear=20)
    assert [s["ur"] for s in chosen] == ["x185", "x204"]


def test_done_marker_skips_tile_year(tmp_path):
    assert not is_done(tmp_path, "T36UVV", 2025)
    mark_done(tmp_path, "T36UVV", 2025, {"scenes": 3})
    assert is_done(tmp_path, "T36UVV", 2025)
    assert not is_done(tmp_path, "T36UVV", 2024)
