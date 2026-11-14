"""Settlement index for the map search (PLAN 4.3): GeoNames Ukraine dump (CC-BY-4.0) → out/places.json.gz.

Each row: [English name, Ukrainian name, lon, lat, oblast code, population]. GeoNames' main name is a
Latin transliteration of the Ukrainian name; the Ukrainian spelling is the Cyrillic alternate name whose
transliteration (KMU 2010 table) is closest to it, so Russian spellings in the alternates are not picked.
"""

from __future__ import annotations

import csv
import gzip
import json
import sys
from difflib import SequenceMatcher
from pathlib import Path

from lan.fields import OBLASTS

SKIP_CODES = {"PPLH", "PPLQ", "PPLW", "PPLX"}  # historical, abandoned, destroyed, section of a place

# Ukrainian → Latin, Cabinet of Ministers resolution No. 55 (2010), simplified (no position rules)
_T = {"а": "a", "б": "b", "в": "v", "г": "h", "ґ": "g", "д": "d", "е": "e", "є": "ie", "ж": "zh", "з": "z",
      "и": "y", "і": "i", "ї": "i", "й": "i", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p",
      "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh",
      "щ": "shch", "ь": "", "ю": "iu", "я": "ia", "'": "", "’": "", "ʼ": "", "-": "-", " ": " "}


def translit(s: str) -> str:
    return "".join(_T.get(c, c) for c in s.lower())


def is_cyrillic(s: str) -> bool:
    return any("Ѐ" <= c <= "ӿ" for c in s)


def ukrainian_name(latin: str, alternates: list[str]) -> str:
    cands = [a for a in alternates if is_cyrillic(a) and not any(c in a.lower() for c in "ыэъё")]
    if not cands:
        return latin
    target = latin.lower().replace("'", "").replace("’", "")
    return max(cands, key=lambda a: (SequenceMatcher(None, translit(a), target).ratio(), any(c in a.lower() for c in "іїєґ")))


def admin1_to_code(admin1_file: Path) -> dict[str, str]:
    """GeoNames admin1 code (UA.01) → our ISO oblast code (71), matched by English name."""
    by_name = {v: k for k, v in OBLASTS.items()}
    out = {}
    for row in csv.reader(admin1_file.open(encoding="utf-8"), delimiter="\t"):
        if not row[0].startswith("UA."):
            continue
        name = row[1].replace(" Oblast", "")
        name = {"Sevastopol City": "Sevastopol"}.get(name, name)
        if name in by_name:
            out[row[0].split(".")[1]] = by_name[name]
    return out


def build(ua_txt: Path, admin1_file: Path) -> list[list]:
    codes = admin1_to_code(admin1_file)
    rows = []
    for r in csv.reader(ua_txt.open(encoding="utf-8"), delimiter="\t", quoting=csv.QUOTE_NONE):
        if r[6] != "P" or r[7] in SKIP_CODES:
            continue
        uk = ukrainian_name(r[1], r[3].split(",") if r[3] else [])
        rows.append([r[1], uk, round(float(r[5]), 4), round(float(r[4]), 4), codes.get(r[10], ""), int(r[14] or 0)])
    rows.sort(key=lambda x: -x[5])
    return rows


def build_us(cities: Path) -> list[list]:
    """GeoNames cities5000 (CC-BY-4.0), USA rows: [name, name, lon, lat, state FIPS, population]."""
    from lan.us_fields import POSTAL

    rows = []
    for r in csv.reader(cities.open(encoding="utf-8"), delimiter="	", quoting=csv.QUOTE_NONE):
        if r[8] != "US" or r[10] not in POSTAL:
            continue
        rows.append([r[1], r[1], round(float(r[5]), 4), round(float(r[4]), 4), POSTAL[r[10]], int(r[14] or 0)])
    rows.sort(key=lambda x: -x[5])
    return rows


if __name__ == "__main__":
    from lan.config import OUT_DIR, RAW_DIR

    src = RAW_DIR / "geonames"
    if len(sys.argv) > 1 and sys.argv[1] == "us":
        from lan.config import DATA_DIR

        OUT_DIR = DATA_DIR / "out_us"
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        rows = build_us(src / "cities5000.txt")
    else:
        rows = build(src / "UA.txt", src / "admin1CodesASCII.txt")
    raw = json.dumps({"v": 1, "source": "GeoNames (CC-BY-4.0)", "places": rows}, separators=(",", ":"), ensure_ascii=False)
    (OUT_DIR / "places.json.gz").write_bytes(gzip.compress(raw.encode("utf-8"), compresslevel=9, mtime=0))
    print(f"places: {len(rows)}, {(OUT_DIR / 'places.json.gz').stat().st_size / 1e3:.0f} KB gzip; no oblast: "
          f"{sum(1 for r in rows if not r[4])}", file=sys.stderr)
    for r in rows[:5]:
        print(r)
