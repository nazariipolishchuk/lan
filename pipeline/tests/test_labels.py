import numpy as np

from lan.labels import CSB_TO_CLASS, majority_label


def test_majority_label_needs_purity_and_coverage():
    assert majority_label(np.array([90, 5, 5]), 100) == "winter"
    assert majority_label(np.array([5, 80, 0]), 100) == "summer"
    assert majority_label(np.array([50, 45, 0]), 100) is None  # mixed field
    assert majority_label(np.array([30, 0, 0]), 100) is None  # mostly unmapped
    assert majority_label(np.array([0, 0, 0]), 0) is None


def test_csb_classes_are_history_classes_or_marked():
    allowed = {"winter_cereal", "spring_cereal", "rapeseed", "maize", "sunflower", "soy", "sugar_beet", "other",
               "spring_rapeseed"}
    assert set(CSB_TO_CLASS.values()) <= allowed
