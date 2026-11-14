# Project page draft (task 3.7)

Draft text for the Space Apps project page, in English. N reviews and rewrites it in his own words;
`[LINK …]` placeholders are filled at P7/P8; numbers marked *(P5)* change after the all-Ukraine ingest.
Every number below is measured (sources: `docs/VALIDATION.md`, `data/out/meta.json`); none is invented.

---

## Project Name

Lan

## High-Level Project Summary

Lan is a web app that turns NASA Earth observations into a crop-rotation plan for any field. You tap a
field on the map and get its card: what grew there in each of the last eleven seasons, what to sow next,
what to avoid and why, the climate risks for each crop counted as "in 6 of the last 20 years", and what
to watch during the season. A comparison screen lays out at least three rotations side by side, on a
month scale, scores them on water, heat, soil and disease, and shows "combos": good and bad crop
sequences, each with its reason and source.

It answers Field Shift by giving a farmer a second opinion grounded in their own field's past and their
district's changing climate, not in national averages. Crop history comes from NASA HLS greenness
(30 m, Landsat + Sentinel-2, 2016–2026) for 29,214 fields in Cherkasy oblast, Ukraine *(P5: all
Ukraine)*; NASA POWER gives 35 years of daily climate per cell. Winter/summer/fallow history agrees with
independent Ukrainian crop maps for 95 % of field-seasons on areas the model never saw.

It matters because rotation mistakes are made once and paid for years: a crop returned too soon, a
winter crop sown after a late harvest, a dry profile left behind. Every recommendation names its
evidence, its information gaps and what to check on the ground; the farmer can correct any season and
the plan recalculates at once. Nothing the farmer enters leaves the browser.

## Link to Project Demo

[LINK video ≤ 30 s]

## Link to Final Project

[LINK live site] · code: [LINK repository]

## Detailed Project Description

**What it does**
- Map of field outlines (Fields of The World) over Ukraine; tap a field to open its card.
- History strip: eleven seasons per field, each a satellite estimate with its confidence; "?" where
  clouds left too few clear looks. The farmer can correct any year.
- "Sow next": crops grown nearby, each with a 0–100 season score (water, heat, soil, disease — not a
  yield forecast); the farmer chooses. "Avoid": rules such as Ukraine's minimum return intervals
  (Cabinet of Ministers Resolution No. 164), with the year a crop becomes allowed again.
- Risks per crop as "x of N years" from NASA POWER; a watch calendar with dates for this field's cell.
- Compare rotations: "As now", "Balanced", "Drought-proof" and an editable "My plan"; combos and
  anti-combos between seasons; a climate switch (all years / last 10 / dry years only); five
  explanation items per plan: why suggested, evidence, benefits, information gaps, check locally.
- "Why?": eight evidence charts (greenness against the field's own range, bare-soil months, rain in the
  critical window, heat and frost, root-zone moisture, then and now, terrain, soil), each with its
  source and resolution.
- Priorities and constraints: what matters most, missing machinery, crops the farmer cannot sell,
  irrigation; banned crops are never suggested and are shown greyed with the reason.
- A private "unsafe" flag for fields the farmer cannot work (for example debris), stored only locally.

**How it works**
NASA HLS greenness per field and ten-day period → seasonal curves → a classifier (gradient boosting)
assigns each field-season to winter crop, summer crop or fallow → a transparent rule engine (crop
calendars derived from the cell's own temperatures, return intervals, predecessor effects, hazards)
scores every candidate plan. The site is static (GitHub Pages); all scoring runs in the browser.

**Validation, including what failed**
- Winter/summer/fallow: accuracy 95.3 % against the KPI / World Bank crop maps (2019–2024) on
  held-out tiles (24,626 field-seasons); fallow is the weak class (F1 0.22).
- Crop names: a model trained on USDA Crop Sequence Boundaries reached accuracy 85.5 % (macro-F1 0.751,
  13,068 fields) on a held-out tile in the Red River Valley, USA, but its crop shares were implausible
  in Ukraine. We therefore show crop names only as "maybe …" hints and never use them in rules.
- POWER climate checked against published Cherkasy normals (`docs/VALIDATION.md`).
- *(P5: results of the team's checks on known fields.)*

**Who it is for and limits**
Farmers and agronomists planning the next seasons; it supports, and does not replace, an agronomist.
It cannot see soil nitrogen, weeds, pests or prices; weather is at about 50 km, soil at 250 m; history
is an estimate and says so.

**Tools**: Python (pipeline), TypeScript, React, MapLibre GL, PMTiles, Vitest; GitHub Pages.

## Use of SI

- The solution idea and every product decision came from the team.
- An SI coding assistant (Claude, through Claude Code, Anthropic) was used for research on data
  sources, planning support, writing the pipeline and web code, and drafting English texts, which the
  team reviewed and edited. The plan document was written with it before the 09:00 start; code and
  data work began on 14 Nov.
- The logo is based on an image generated with Google Gemini, redrawn as vector by our code, and
  carries a visible "SI-assisted" mark.
- The product contains one machine-learning model (the crop-type classifier) trained by us on open
  labels, with its accuracy reported. Recommendations come from transparent rules, not from a
  language model.

## NASA Data

| Dataset | What it drives in Lan | Link |
|---|---|---|
| HLS Vegetation Indices v2.0 (HLSL30_VI, HLSS30_VI) | Greenness curves per field: crop history, current state, bare-soil months | https://www.earthdata.nasa.gov/data/catalog/lpcloud-hlsl30-vi-2.0 |
| NASA POWER daily (agroclimatology) | Crop calendars, hazards "x of N years", climate scenarios, evidence charts | https://power.larc.nasa.gov/ |
| NASADEM (SRTM reprocessed) | Field slope and elevation | https://www.earthdata.nasa.gov/data/catalog/lpcloud-nasadem-hgt-001 |
| GIBS Blue Marble | Basemap at small scales | https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api |

## Space Agency Partner Data and Other References

Fields of The World (CC-BY-4.0) · KPI winter/summer crop maps of Ukraine 2019–2024, World Bank DDH
0066913 (CC-BY-4.0) · ISRIC SoilGrids 2.0 (CC-BY-4.0) · USDA NASS Crop Sequence Boundaries (public
domain) · OpenFreeMap / OpenStreetMap (ODbL) · Resolution No. 164 of the Cabinet of Ministers of
Ukraine · software and fonts as listed in `docs/REFERENCES.md` (MIT, BSD, Apache-2.0, OFL).
