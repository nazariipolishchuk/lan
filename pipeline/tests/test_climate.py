import numpy as np
import pandas as pd

from lan.climate import et0_hargreaves, frost_dates, gdd, parse_power, year_indicators


def _payload(days: dict[str, dict[str, float]]) -> dict:
    params = {}
    for date, vals in days.items():
        for k, v in vals.items():
            params.setdefault(k, {})[date] = v
    return {"properties": {"parameter": params}}


def _year(seed=0, year=2021):
    d = pd.date_range(f"{year}-01-01", f"{year}-12-31", freq="D")
    rng = np.random.default_rng(seed)
    t = 8 - 12 * np.cos(2 * np.pi * (d.dayofyear.to_numpy() - 15) / 365)
    return pd.DataFrame({
        "T2M": t, "T2M_MAX": t + 6, "T2M_MIN": t - 6,
        "PRECTOTCORR": rng.gamma(0.6, 3, len(d)), "GWETROOT": np.full(len(d), 0.6),
    }, index=d)


def test_fill_value_becomes_nan():
    df = parse_power(_payload({"20250101": {"T2M": -999.0, "PRECTOTCORR": 1.0},
                               "20250102": {"T2M": 2.5, "PRECTOTCORR": -999.0}}))
    assert np.isnan(df.loc["2025-01-01", "T2M"]) and df.loc["2025-01-02", "T2M"] == 2.5
    assert np.isnan(df.loc["2025-01-02", "PRECTOTCORR"])


def test_gdd_on_known_series():
    assert gdd(np.array([4.0, 6.0, 15.0, np.nan]), 5) == 1 + 10
    assert gdd(np.array([4.0, 6.0, 15.0]), 10) == 5


def test_frost_dates_on_known_series():
    d = pd.date_range("2021-01-01", "2021-12-31", freq="D")
    tmin = np.full(len(d), 5.0)
    tmin[d.get_loc(pd.Timestamp("2021-04-20"))] = -1.0  # last spring frost: doy 110
    tmin[d.get_loc(pd.Timestamp("2021-02-01"))] = -8.0
    tmin[d.get_loc(pd.Timestamp("2021-10-15"))] = -0.5  # first autumn frost: doy 288
    tmin[d.get_loc(pd.Timestamp("2021-11-20"))] = -4.0
    assert frost_dates(d, tmin) == (110, 288)


def test_frost_dates_none_when_no_frost():
    d = pd.date_range("2021-01-01", "2021-12-31", freq="D")
    assert frost_dates(d, np.full(len(d), 3.0)) == (None, None)


def test_dekad_sums_equal_month_sum():
    df = _year(1)
    ind = year_indicators(df, 49.5)
    for m in range(12):
        month = df["PRECTOTCORR"][df.index.month == m + 1].sum()
        assert abs(sum(ind["rain"][m * 3:m * 3 + 3]) - month) < 0.05 * 3 + 1e-6


def test_indicator_shapes_and_hot_days():
    df = _year(2)
    df.loc["2021-07-01":"2021-07-05", "T2M_MAX"] = 36.0
    ind = year_indicators(df, 49.5)
    for k in ["rain", "et0", "hot30", "hot35", "tmin", "wet"]:
        assert len(ind[k]) == 36
    assert ind["hot35"][18] == 5  # 1–5 July are in dekad 18
    assert ind["heavyRainDays"] >= 0


def test_et0_is_plausible_for_july_in_ukraine():
    # FAO-56 Hargreaves: mid-July, 49.5 N, Tmean 21, Tmax 27, Tmin 15 → roughly 4–6 mm/day
    v = float(et0_hargreaves(21.0, 27.0, 15.0, 49.5, 196))
    assert 4.0 < v < 6.0
