from lan.export import dedupe_fields


def rec(i, oblast, known=11, c=(32.0, 46.6)):
    hist = [{"y": 2016 + k, "k": "winter_cereal" if k < known else "unknown"} for k in range(11)]
    return {"id": i, "c": list(c), "adm": {"oblast": oblast, "raion": ""}, "hist": hist}


def test_keeps_the_copy_whose_oblast_holds_the_centre():
    recs = [rec("a", "Mykolaiv"), rec("b", "Kherson"), rec("a", "Kherson")]
    out, dropped = dedupe_fields(recs, lambda name, lon, lat: name == "Kherson")
    assert dropped == 1
    assert [(r["id"], r["adm"]["oblast"]) for r in out] == [("b", "Kherson"), ("a", "Kherson")]


def test_without_outlines_keeps_more_known_seasons_then_the_first():
    out, dropped = dedupe_fields([rec("a", "X", known=3), rec("a", "Y", known=9)])
    assert dropped == 1 and out[0]["adm"]["oblast"] == "Y"
    out, _ = dedupe_fields([rec("a", "X"), rec("a", "Y")])
    assert out[0]["adm"]["oblast"] == "X"


def test_unique_ids_untouched():
    recs = [rec("a", "X"), rec("b", "Y")]
    assert dedupe_fields(recs) == (recs, 0)
