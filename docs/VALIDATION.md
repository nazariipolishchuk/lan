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
