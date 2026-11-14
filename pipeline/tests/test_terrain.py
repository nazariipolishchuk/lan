import numpy as np

from lan.terrain import slope_percent, zonal_terrain


def test_slope_of_a_plane():
    # rises 3 m per 30 m pixel eastward → 10 %
    dem = np.tile(np.arange(10) * 3.0, (8, 1))
    s = slope_percent(dem, 30.0)
    assert np.allclose(s, 10.0)


def test_steep_valley_beats_plateau():
    plateau = np.full((10, 10), 150.0)
    valley = np.tile(np.abs(np.arange(10) - 5) * 6.0 + 100, (10, 1))  # 20 % sides
    dem = np.hstack([plateau, valley])
    labels = np.zeros_like(dem, dtype=np.int32)
    labels[:, :10] = 1
    labels[:, 10:] = 2
    z = zonal_terrain(labels, slope_percent(dem, 30.0), dem, 2)
    assert z.loc[2, "slope"] > z.loc[1, "slope"] + 5
    assert z.loc[2, "slopeP90"] >= z.loc[2, "slope"]
    assert abs(z.loc[1, "elev"] - 150) < 1e-6


def test_smoothing_keeps_values_next_to_nodata():
    dem = np.tile(np.arange(20) * 3.0, (20, 1))
    dem[0, :] = np.nan
    s = slope_percent(dem, 30.0, smooth=5)
    assert np.isfinite(s[10, 10]) and abs(s[10, 10] - 10) < 0.5
