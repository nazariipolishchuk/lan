# Validation

Every number here is measured. Where our data disagrees with an independent source, the gap is
stated and its consequence for the product is written next to it.

## Climate (NASA POWER) against published normals — task 1.2

Cell `49.5_31.875` (contains Cherkasy city). Station normals: Cherkasy, 1981–2010, NOAA NCEI as
cited by the English Wikipedia climate table (read 14 Nov 2026).

| Quantity | POWER, 1991–2010 | Station, 1981–2010 | Gap |
|---|---|---|---|
| July mean temperature | 22.4 °C | 20.6 °C | POWER **+1.8 °C** warmer |
| Annual precipitation | 576 mm | 544 mm | POWER +6 % |

Precipitation agrees well. Temperature runs warm: POWER's meteorology is a 0.5° × 0.625° MERRA-2
grid-cell average, not a point station, and reanalysis summer temperatures over the Forest-Steppe
are known to differ from station records by this order. The periods also differ by ten years
(the climate warmed in between; POWER itself shows July 21.7 °C in 1991–2000 and 23.0 °C in
2001–2010).

**Consequence for the product:** absolute temperature thresholds (sowing temperature, hot days
≥ 30 °C and ≥ 35 °C) evaluated on POWER will fire somewhat more often than at a station. Risks are
reported as "x of N years" from the same series, so the *trend* between periods is consistent, but
absolute hot-day counts are likely overstated. Stated as a limit in About; a station-based bias
correction is a possible later improvement.

Trend in the same cell (POWER):

| Period | July mean | GDD base 10 | Days ≥ 30 °C |
|---|---|---|---|
| 1991–2000 | 21.7 °C | 1,357 | 11.8 |
| 2001–2010 | 23.0 °C | 1,473 | 20.0 |
| 2011–2020 | 22.8 °C | 1,646 | 27.7 |
| 2016–2025 | 23.1 °C | 1,623 | 27.4 |

## Greenness pipeline spot check — task 1.3

Field `8a6ovcny14` (Cherkasy, tile T36UVV), scene `HLS-VI.S30.T36UVV.2025143T084559.v2.0` (23 May 2025).
Independent recomputation on the laptop with `rasterio.mask` over the field polygon (3,411 pixels,
all clear by Fmask): mean NDVI **0.7171**. Pipeline value (interior pixels, one-pixel edge removed):
**0.7183**. Difference 0.001, explained by the edge pixels.

The field's 2025 curve reads as a winter cereal: green-up in April, peak 0.72 in late May, senescence
in late June, harvest by early July, stubble ≈ 0.38, a new crop emerging in November (0.49).

## Terrain — task 1.4

NASADEM 30 m, smoothed 5 × 5 before slope (raw SRTM noise alone gives 3–5 % "slope" on flat land:
median field slope fell from 4.2 % to 3.2 % after smoothing). Cherkasy fields (29,214): median slope
3.2 %, 90th-percentile slope median 5.2 %. Flattest fields lie on the Dnipro floodplain (elevation
≈ 81 m, slope 0.2 %); the steepest (13–14 %) in the hills around 31.1° E, 49.1° N. Elevation 73–291 m.

## Soil — task 1.4

SoilGrids 2.0, 0–30 cm depth-weighted, at the field centroid. Cherkasy medians: clay 29.9 %, sand
21.9 %, organic carbon 2.69 %, pH 6.7: typical chernozem values. 3,642 of 29,214 fields (12 %) have no
value because the centroid falls on a SoilGrids no-data pixel; the card says "Soil unknown" for them.

## Crop history: group model in Ukraine (V1) — task 2.3

LightGBM on the 27-dekad HLS greenness curve (1 March – 30 November, gaps ≤ 4 dekads interpolated,
1-2-1 smoothing) plus phenology features and the previous season's autumn greenness. Labels: majority
class of the KPI winter/summer/uncultivated maps 2019–2024 inside each field (kept when ≥ 70 % of the
mapped pixels agree and ≥ 50 % of the field is mapped). **Whole MGRS tiles held out:** trained on
T35UPQ, T35UQQ, T36UUA, T36UUU, T36UUV, T36UVV; tested on T35UQP and T36UVA.

| | Winter | Summer | Uncultivated |
|---|---|---|---|
| F1 | **0.877** | **0.975** | 0.220 |
| Test field-years | 1,264 | 22,491 | 871 |

Overall agreement 95.3 %, macro-F1 0.691, n = 24,626 field-years. Confusion matrix (rows = map, columns = model):

| | → winter | → summer | → uncultivated |
|---|---|---|---|
| winter | 1,081 | 169 | 14 |
| summer | 116 | 22,259 | 116 |
| uncultivated | 4 | 743 | 124 |

This is **agreement with the KPI map**, which is itself a model (reported F1 above 90 % for most
classes), not ground truth. Uncultivated land is mostly missed (recall 14 %); with class re-weighting
recall rose but precision fell to 18 % (2,902 summer fields called "uncultivated"), so the shipped model
is unweighted: a false "fallow" would mislead the rules more than a missed one.

Label check (task 2.2): `docs/img/p2_labelled_curves.png`, 20 random labelled field-years. Winter fields
are green from March and harvested by early July; summer fields peak in July; one summer curve shows a
dip and a second green-up (resowing after crop damage, as N described). Class counts per tile are in
DECISIONS.md (Sat 12:50).

## Crop history: crop model, Red River Valley (V2) — task 2.3

Same features, expressed relative to the median green-up of the region's summer crops in that year
(the Red River season runs about one dekad later than Cherkasy's). Labels: USDA Crop Sequence
Boundaries 2023. Trained on tiles T14TPT and T14TPS (Cass, Clay, Richland, Wilkin counties and
neighbours), **tested on the held-out tile T14UPU** (Grand Forks, Polk and neighbours).

| | Maize | Soybean | Sugar beet | Sunflower | Spring cereal |
|---|---|---|---|---|---|
| F1 | 0.776 | 0.884 | 0.695 | 0.446 | 0.957 |
| Test fields | 2,516 | 4,753 | 1,259 | 412 | 4,128 |

Accuracy 85.5 %, macro-F1 0.751, n = 13,068 fields. Here the labels are official field-level records.

## Crop names in Ukraine: failed plausibility check — task 2.4

Applied to Cherkasy, the crop model's area shares jump from year to year in ways real farming does
not: soybean 20–55 %, maize 1–47 %, sunflower 1–12 % of the classified area. The official grain-maize
harvested area in Cherkasy oblast in 2021 was 347,801 ha (Ukrstat, `ukrstat_ck`), about a third of the
oblast's ≈ 1.1 M ha sown area, and maize is a third of the area every year. **The transfer from the USA
does not hold for crop names.** Consequence: the history strip shows a season's *group* (winter crop,
summer crop, fallow) as known and a summer crop's *name* only as "maybe …" below the confidence
threshold; the rules never use it; the farmer confirms it. Winter rapeseed cannot be told apart from
winter cereals yet (stated in every plan's information gaps). Next step: N's known fields (UT1) give the
first Ukrainian crop-level ground truth.

### Second attempt: crop model trained across the USA (Sun 15 Nov 08:30)

Trained on 1,068,389 labelled field-years: HLS greenness 2023–2025 on 160 US tiles in every state, labels
from USDA Crop Sequence Boundaries (CDL 2023–2025), sunflower and sugar-beet tiles over-sampled (55 of 160)
because both are rare in the USA. Season timing relative to the median summer green-up per tile and year.
Job `pipeline/jobs/train_us.py`, numbers in `data/work/metrics_us_crop.json`.

| Held-out US tiles (31 tiles, 102,641 field-years) | maize | soy | sugar beet | sunflower | spring cereal |
|---|---|---|---|---|---|
| F1 | 0.69 | 0.72 | 0.70 | 0.73 | 0.89 |

Macro-F1 0.74, accuracy 0.75. In Ukraine it is less wrong than the Red River model (which called most
summer fields soybean), but still not plausible. Share of the summer group, 2019–2026:

| Oblast | Crop | Red River model | USA-wide model | Reference |
|---|---|---|---|---|
| Cherkasy | maize | 4–50 % | 17–56 % | ≈ 45 %, steady (348 k ha harvested, 2021) |
| Cherkasy | soybean | 26–72 % | 12–58 % | ≈ 13 % |
| Cherkasy | sunflower | 4–15 % | 8–34 % | ≈ 30 % |
| Kharkiv | sunflower | 5–15 % | 17–34 % | the leading crop |
| Odesa | spring cereals | 29–59 % | 9–53 % | well below sunflower |

The shares swing two-fold between years while real areas move by a few per cent. **Decision: crop names in
Ukraine stay hints; the site is unchanged.** The likely cause is the label domain, not the model: every
crop-name label comes from another continent, while the published Ukrainian crop maps reach F1 > 0.9 with
local labels (Kussul et al. 2025).

### Third attempt: Ukrainian labels (Sun 15 Nov 08:46) — shipped as hints

Labels: the 10 m crop type map of Ukraine for 2020 (`ua_cropmap_2020`; the map scores 90 % on its authors'
954 validation points: maize 97 %, sunflower 89 % recall). One label per field-year by the KPI majority rules.
Sample: 8,000 fields in each of 14 oblasts across all zones (05 12 14 18 23 32 35 46 48 51 53 59 63 71).
Two models inside our group model: summer maize / sunflower / other, winter wheat / rapeseed. Features:
the absolute curve and phenology plus the curve relative to each tile-year's summer green-up. Job
`pipeline/jobs/train_ua_crops.py`, numbers in `data/work/metrics_ua_crop.json`.

| Held-out tiles, 2020 | F1 | Support |
|---|---|---|
| maize | 0.90 | 5,629 |
| sunflower | 0.77 | 2,214 |
| other summer crop | 0.83 | 595 |
| winter wheat | 0.99 | 1,688 |
| winter rapeseed | 0.71 | 77 |

Summer macro-F1 0.83 (accuracy 0.86); winter macro-F1 0.85. **The geography is right for the first time:**
sunflower leads the summer crops in Zaporizhzhia, Donetsk, Mykolaiv, Dnipropetrovsk and Kharkiv; maize
leads in Lviv, Zhytomyr and Sumy. **The years are not stable:** Cherkasy maize is 56–64 % of the summer
group in 2020–2023 but 23 % in 2024; Poltava, Sumy and Kyiv show the same 2024 jump to "sunflower". 2024 was
a drought summer: maize senesced early and its curve looked like sunflower; a model trained on one year
cannot know that. **Decision:** the new models replace the US-trained ones, crop names stay hints
(p ≤ 0.5), winter rapeseed appears as a hint. Next step: a second label year (JRC EU crop map 2022, which
covers Ukraine and adds soybean and sugar beet) and more bands (SWIR, red edge, Sentinel-1 radar).

## Engine on real fields — task 2.5

Card and the three strategies on the three showcase fields, real Cherkasy climate cells: card 2–7 ms,
strategies 76–159 ms (exhaustive search, ≤ 11³ plans). Engine unit tests: 64, all green.

## Crop history outside Cherkasy (V1b) — task 4.0

The group model (winter / summer / not cultivated) was trained only in Cherkasy oblast
(Forest-Steppe). After the all-Ukraine build it was checked against the KPI winter/summer maps
2019–2024 (World Bank DDH 0066913) on one whole HLS tile per zone, fields ≥ 2 ha, field-seasons with
a confident KPI label (`pipeline/jobs/build_ukraine.py validate`, `data/work/metrics_ua.json`).

| Zone | Oblast | Tile | Agreement | Macro-F1 | F1 winter | F1 summer | F1 not cultivated | Field-seasons |
|---|---|---|---|---|---|---|---|---|
| Steppe, centre | Dnipropetrovsk | T36UWU | **95.0 %** | 0.698 | 0.933 | 0.967 | 0.193 | 31,617 |
| Steppe / Forest-Steppe, east | Kharkiv | T36UXA | **94.2 %** | 0.669 | 0.841 | 0.966 | 0.199 | 22,717 |
| Polissia, north-west | Volyn | T35ULS | **88.6 %** | 0.650 | 0.818 | 0.929 | 0.201 | 21,044 |
| West | Lviv | T34UFA | **87.2 %** | 0.660 | 0.811 | 0.926 | 0.243 | 21,133 |
| Steppe, south | Odesa | T35TPL | **79.3 %** | 0.628 | 0.855 | 0.835 | 0.195 | 19,990 |

For reference, Cherkasy held-out tiles: 95.3 %.

**Reading:** the model transfers well across the central and eastern Steppe; it loses 7–8 points in
the wetter west and north-west and 16 points in the dry south, where summer crops are confused with
winter crops and bare land more often. "Not cultivated" stays weak everywhere (F1 ≈ 0.2), as in
Cherkasy. **Consequence for the product:** About shows this table; the card already marks every season
as an estimate with its confidence and lets the farmer correct it. A model retrained with labels from
several zones is the obvious next step (labels exist for all of Ukraine), not done tonight.
