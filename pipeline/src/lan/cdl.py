"""USDA Cropland Data Layer codes (as carried by Crop Sequence Boundaries) → our history classes and groups.

Only the class and the group are kept: the engine's catalogue has eleven crops, so cotton, rice, alfalfa,
dry beans and the like become `other` with their season group. Double crops count as their first
(main-season) harvest: "winter wheat / soybeans" is a winter cereal season. Non-crop land is `other`,
group "uncultivated". CDL is a satellite classification itself (USDA states 85–95 % accuracy for the
major crops), so seasons from it carry p = 0.95 and src = "map", not 1.0.
"""

from __future__ import annotations

P_CDL = 0.95

_WINTER = {24, 26, 27, 225, 236, 238, 205}  # winter wheat, double crops starting with it, rye, triticale
_SPRING_CEREAL = {21, 22, 23, 25, 28, 29, 30, 237, 254, 226}  # barley, durum, spring wheat, oats, millet...
_CLASS = {
    1: "maize", 12: "maize", 13: "maize", 241: "maize", 228: "maize",
    5: "soy", 239: "soy", 240: "soy",
    6: "sunflower",
    41: "sugar_beet",
    31: "rapeseed", 34: "rapeseed",
}
_SUMMER_OTHER = {2, 3, 4, 10, 32, 33, 35, 38, 39, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 206, 207,
                 208, 209, 213, 214, 216, 219, 221, 222, 224, 227, 229, 230, 231, 232, 233, 234, 235, 242, 243, 244, 245,
                 246, 247, 248, 249, 250}
_PERENNIAL = {36, 37, 58, 59, 60, 66, 67, 68, 69, 70, 71, 72, 74, 75, 76, 77, 204, 210, 211, 212, 215, 217, 218, 220, 223}
_FALLOW = {61}


def cdl_class(code: int) -> tuple[str, str | None]:
    """(history class, group) for one CDL code."""
    if code in _WINTER:
        return "winter_cereal", "winter"
    if code in _SPRING_CEREAL:
        return "spring_cereal", "summer"
    if code in _CLASS:
        return _CLASS[code], "summer"
    if code in _SUMMER_OTHER:
        return "other", "summer"
    if code in _PERENNIAL:
        return "other", None  # hay, alfalfa, orchards: a crop, but neither a winter nor a summer annual
    if code in _FALLOW:
        return "other", "uncultivated"
    return "other", "uncultivated"  # grass, forest, water, developed land inside a field outline


def cdl_items(codes: dict[int, int]) -> list[dict]:
    """{year: code} → contract HistoryItems (y, k, p, src, g)."""
    out = []
    for y in sorted(codes):
        k, g = cdl_class(int(codes[y]))
        item = {"y": int(y), "k": k, "p": P_CDL, "src": "map"}
        if g:
            item["g"] = g
        out.append(item)
    return out
