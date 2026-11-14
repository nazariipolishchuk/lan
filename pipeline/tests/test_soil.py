import numpy as np

from lan.soil import weighted


def test_depth_weighted_mean():
    v = weighted([np.array([10.0]), np.array([20.0]), np.array([30.0])], [5, 10, 15])
    assert abs(v[0] - (50 + 200 + 450) / 30) < 1e-9


def test_missing_layers_are_ignored_and_all_missing_is_nan():
    v = weighted([np.array([10.0, np.nan]), np.array([np.nan, np.nan]), np.array([30.0, np.nan])], [5, 10, 15])
    assert abs(v[0] - (50 + 450) / 20) < 1e-9
    assert np.isnan(v[1])
