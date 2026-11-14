import datetime as dt

import numpy as np
import pandas as pd

from lan.curves import (
    D0,
    ND,
    autumn_state,
    bare_days,
    build_curves,
    encode_curve,
    fill_gaps,
    phenology,
)


def _curve(values: dict[int, float]) -> np.ndarray:
    """values keyed by absolute dekad (0..35); everything else missing."""
    c = np.full(ND, np.nan, dtype=np.float32)
    for k, v in values.items():
        c[k - D0] = v
    return c


def test_gap_longer_than_four_dekads_stays_missing():
    c = _curve({6: 0.2, 8: 0.4, 14: 0.8, 15: 0.8})  # gap of 1 (dekad 7) and gap of 5 (9..13)
    f = fill_gaps(c, max_gap=4)
    assert np.isclose(f[7 - D0], 0.3)  # short gap interpolated
    assert np.isnan(f[9 - D0:14 - D0]).all()  # long gap untouched
    assert np.isnan(f[16 - D0:]).all()  # never extrapolated past the last observation


def test_gap_of_exactly_four_is_filled():
    c = _curve({10: 0.2, 15: 0.7})  # dekads 11..14 missing (4)
    f = fill_gaps(c, max_gap=4)
    assert np.allclose(f[11 - D0:15 - D0], [0.3, 0.4, 0.5, 0.6])


def test_bare_days_on_known_curve():
    # 27 season dekads: 10 of them below 0.25, the rest green
    c = np.full(ND, 0.6, dtype=np.float32)
    c[:6] = 0.2
    c[-4:] = 0.15
    assert bare_days([c]) == 100
    # missing dekads are not counted as bare, and years with too few looks are ignored
    sparse = np.full(ND, np.nan, dtype=np.float32)
    sparse[:3] = 0.1
    assert bare_days([c, sparse]) == 100
    assert bare_days([sparse]) is None


def test_autumn_state_rules():
    day = dt.date(2026, 10, 25)
    # winter cereal harvested in July, new crop emerged in October
    winter = _curve({12: 0.6, 15: 0.8, 18: 0.6, 20: 0.3, 22: 0.25, 25: 0.28, 27: 0.38, 29: 0.52})
    assert autumn_state(winter, day)["state"] == "winter_crop"
    # bare after harvest
    bare = _curve({15: 0.8, 21: 0.7, 24: 0.4, 26: 0.2, 28: 0.18})
    assert autumn_state(bare, day)["state"] == "bare"
    # still green and never dipped since the summer peak (e.g. sugar beet standing) → green cover, not a new crop
    standing = _curve({18: 0.8, 21: 0.82, 24: 0.78, 27: 0.7, 29: 0.65})
    assert autumn_state(standing, day)["state"] == "green_cover"
    # no autumn looks at all
    assert autumn_state(_curve({15: 0.8, 18: 0.7}), day)["state"] == "unknown"
    s = autumn_state(winter, day)
    assert s["asOf"] == "2026-10-25"


def test_phenology_features():
    c = _curve({d: v for d, v in zip(range(6, 33), np.interp(range(6, 33), [6, 12, 18, 24, 32], [0.2, 0.3, 0.85, 0.3, 0.2]))})
    p = phenology(c)
    assert p["peak_dekad"] == 18
    assert np.isclose(p["peak"], 0.85, atol=1e-3)
    assert 12 <= p["greenup_dekad"] < 18 < p["senesc_dekad"] <= 24
    assert p["n_valid"] == ND


def test_build_curves_dekad_means_and_encoding():
    obs = pd.DataFrame({
        "id": ["a", "a", "a", "b"],
        "date": pd.to_datetime(["2025-05-02", "2025-05-08", "2025-05-15", "2025-05-02"]),
        "ndvi": [0.5, 0.7, 0.8, 0.3],
        "frac": [1.0, 1.0, 1.0, 1.0],
    })
    cur = build_curves(obs, smooth=False, max_gap=0)
    a = cur.loc[("a", 2025)].to_numpy()
    assert np.isclose(a[12 - D0], 0.6)  # 2 May and 8 May fall into the first May dekad
    assert np.isclose(a[13 - D0], 0.8)
    s = encode_curve(a)
    raw = np.frombuffer(__import__("base64").b64decode(s), dtype=np.uint8)
    assert raw.size == ND and raw[12 - D0] == 120 and raw[0] == 255
