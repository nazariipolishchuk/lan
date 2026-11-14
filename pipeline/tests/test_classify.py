import numpy as np
import pandas as pd

from lan.classify import DEK, evaluate, shift_curves, split_by_tile


def test_train_and_test_tiles_are_disjoint():
    df = pd.DataFrame({"tile": ["A", "A", "B", "C", "C", "D"], "x": range(6)})
    tr, te = split_by_tile(df, {"B", "D"})
    assert set(tr["tile"]).isdisjoint(set(te["tile"]))
    assert len(tr) + len(te) == len(df)
    assert set(te["tile"]) == {"B", "D"}


def test_shift_moves_curve_earlier():
    row = {d: float(i) for i, d in enumerate(DEK)}
    df = pd.DataFrame([{"id": "a", "y": 2023, **row}])
    s = shift_curves(df, 2)
    assert s[DEK[0]].iat[0] == 2.0 and np.isnan(s[DEK[-1]].iat[0])
    assert df[DEK[0]].iat[0] == 0.0  # input untouched


def test_evaluate_reports_macro_f1():
    m = evaluate(["a", "a", "b", "b"], ["a", "b", "b", "b"], ["a", "b"])
    assert m["n"] == 4 and m["confusion"] == [[1, 1], [0, 2]]
    assert 0 < m["macroF1"] < 1
