# Project page draft (task 3.7)

Draft text for the Space Apps project page, in English. N reviews and rewrites it in his own words;
the one `[LINK …]` left is the demo deck, filled when the PDF is on Google Drive (D14).
Every number below is measured (sources: `docs/VALIDATION.md`, `data/out/meta.json`, `data/out_us/meta.json`);
none is invented.

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
(30 m, Landsat + Sentinel-2, 2016–2026) for 597,203 fields across all of Ukraine; NASA POWER gives
35 years of daily climate per cell. Winter/summer/fallow history agrees with independent Ukrainian crop
maps for 95 % of field-seasons on held-out areas of the training region and for 79–95 % in five other
zones (weakest in the dry south). The same app covers the 48 contiguous US states (15,973,095 fields):
there the 2018–2025 history is the USDA Cropland Data Layer, a published crop map, and only the 2026
season is our estimate.

It matters because rotation mistakes are made once and paid for years: a crop returned too soon, a
winter crop sown after a late harvest, a dry profile left behind. Every recommendation names its
evidence, its information gaps and what to check on the ground; the farmer can correct any season and
the plan recalculates at once. Nothing the farmer enters leaves the browser.

## Link to Project Demo

[LINK demo: 7-slide PDF deck on Google Drive]

## Link to Final Project

Live site: https://nazariipolishchuk.github.io/lan/ · code: https://github.com/nazariipolishchuk/lan

## Detailed Project Description

**What it does**
- Map of field outlines over Ukraine (Fields of The World) and the 48 contiguous US states (USDA Crop
  Sequence Boundaries); tap a field to open its card.
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
  held-out tiles (24,626 field-seasons); fallow is the weak class (F1 0.22). Outside the training
  oblast: Dnipropetrovsk 95.0 %, Kharkiv 94.2 %, Volyn 88.6 %, Lviv 87.2 %, Odesa 79.3 %.
- Crop names in Ukraine: two models trained on the 2020 crop type map of Ukraine (Zenodo 11065080)
  reach summer macro-F1 0.83 (maize 0.90, sunflower 0.77) and winter macro-F1 0.85 on held-out tiles,
  and the geography is right (sunflower leads in the south and east, maize in the west and north). But
  trained on one year, their yearly shares swing in the 2024 drought, so crop names are shown only as
  "maybe …" hints and the rules never use them. Two earlier models trained on US labels (Red River
  Valley, then 160 tiles across the USA; macro-F1 0.75 and 0.74 on held-out US tiles) gave implausible
  crop shares in Ukraine and were dropped.
- USA: field history 2018–2025 is USDA CDL, not our model. The rule set for US crops has fewer sources:
  91 of its 191 values have none yet and are shown as "not yet verified". The 2026 US season shows only
  winter / summer / not cultivated; it has not been checked against a US map.
- POWER climate checked against published Cherkasy normals (`docs/VALIDATION.md`).

**Who it is for and limits**
Farmers and agronomists planning the next seasons; it supports, and does not replace, an agronomist.
It cannot see soil nitrogen, weeds, pests or prices; weather is at about 50 km, soil at 250 m; history
is an estimate and says so.

**Tools**: Python (pipeline), TypeScript, React, MapLibre GL, PMTiles, Vitest; GitHub Pages.

## Use of SI

- The product idea came from the team: a map where tapping a field opens a game-like card with what to
  sow, what not to sow, the risks and what to watch; rotations as combos; date-aware planning; sunflower
  overuse as the core local problem. Every product decision was the team's.
- Suggested by SI in discussion and adopted by the team: reconstructing crop history from yearly
  greenness curves with a classifier, the timeline-lanes layout of the comparison, the climate-scenario
  switch and the "x of N years" risk wording, and the choice of datasets, stack and validation design
  (the full split is in `docs/PLAN.md` §3).
- An SI coding assistant (Claude, through Claude Code, Anthropic) was used for research on data
  sources, planning support, writing the pipeline and web code, and drafting English texts, which the
  team reviewed and edited. The plan document was written with it before the 09:00 start; code and
  data work began on 14 Nov.
- The logo is based on an image generated with Google Gemini, redrawn as vector by our code, and
  carries a visible "SI-assisted" mark.
- The product contains three machine-learning models trained by us on open labels, each with its
  accuracy reported: the season-group classifier (winter / summer / not cultivated) and two crop-name
  classifiers (summer and winter crops) whose output is shown only as hints. Recommendations come from
  transparent rules, not from a language model.

## NASA Data

| Dataset | What it drives in Lan | Link |
|---|---|---|
| HLS Vegetation Indices v2.0 (HLSL30_VI, HLSS30_VI) | Greenness curves per field: crop history, current state, bare-soil months | https://www.earthdata.nasa.gov/data/catalog/lpcloud-hlsl30-vi-2.0 |
| NASA POWER daily (agroclimatology) | Crop calendars, hazards "x of N years", climate scenarios, evidence charts | https://power.larc.nasa.gov/ |
| NASADEM (SRTM reprocessed) | Field slope and elevation | https://www.earthdata.nasa.gov/data/catalog/lpcloud-nasadem-hgt-001 |
| GIBS Blue Marble | Basemap at small scales | https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api |

## Space Agency Partner Data and Other References

Fields of The World (CC-BY-4.0) · KPI winter/summer crop maps of Ukraine 2019–2024, World Bank DDH
0066913 (CC-BY-4.0) · 10 m crop type map of Ukraine 2020, Chen, Tu et al. 2024, Zenodo 11065080
(CC-BY-4.0) · USDA NASS Crop Sequence Boundaries 2018–2025 with Cropland Data Layer crop codes (public
domain) · ISRIC SoilGrids 2.0 (CC-BY-4.0) · GeoNames (CC-BY-4.0) · geoBoundaries gbOpen UKR ADM1
(ODbL 1.0) · OpenFreeMap / OpenStreetMap (ODbL) · Resolution No. 164 of the Cabinet of Ministers of
Ukraine · software and fonts as listed in `docs/REFERENCES.md` (MIT, BSD, Apache-2.0, OFL).
