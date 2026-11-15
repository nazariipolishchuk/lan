# References ledger

Every dataset, library, image and text source used by Lan, with its licence. A line is added in the
same commit that introduces the thing (hackathon rule: list all data, resources and tools, even open source).

## Data

| Id | Source | Used for | Licence / terms | Link |
|---|---|---|---|---|
| `hls_vi` | NASA HLS Vegetation Indices v2.0 (HLSL30_VI, HLSS30_VI), LP DAAC | Greenness curves per field: crop history, current state, bare-soil days | NASA open data | https://www.earthdata.nasa.gov/data/catalog/lpcloud-hlsl30-vi-2.0 |
| `ftw` | Fields of The World, global field boundaries 2024–2025 (Taylor Geospatial et al.; Robinson et al. 2026, arXiv:2605.11055) | Field polygons and ids | CC-BY-4.0 | https://source.coop/ftw/global-data |
| `kpi_wb` | Winter/summer crop maps of Ukraine 2019–2024 (KPI methodology, Kussul et al. 2025), World Bank Development Data Hub dataset 0066913 | Winter / summer / uncultivated history per field; training labels at group level | CC-BY-4.0 | https://datacatalog.worldbank.org/int/search/dataset/0066913/ |
| `power` | NASA POWER daily, agroclimatology community | Climate indicators per cell | NASA open data | https://power.larc.nasa.gov/ |
| `nasadem` | NASA NASADEM_HGT v001 (SRTM reprocessed), LP DAAC | Field slope and elevation | NASA open data | https://www.earthdata.nasa.gov/data/catalog/lpcloud-nasadem-hgt-001 |
| `soilgrids` | ISRIC SoilGrids 2.0 | Clay, sand, organic carbon, pH per field | CC-BY-4.0 | https://soilgrids.org |
| `gibs` | NASA GIBS Blue Marble Next Generation | Basemap imagery at small scales | NASA open data | https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api |
| `openfreemap` | OpenFreeMap vector tiles (OpenStreetMap data) | Dark basemap: water, roads, places, borders | OSM data ODbL 1.0; OpenFreeMap free, no key | https://openfreemap.org |
| `cherkasy_normals` | Cherkasy climate normals 1981–2010 (NOAA NCEI, as tabulated on English Wikipedia) | Validation of POWER only | Facts cited | https://en.wikipedia.org/wiki/Cherkasy |
| `kmu164` | Cabinet of Ministers of Ukraine Resolution No. 164 of 11.02.2010 (as amended 30.06.2010, No. 536): normatives of crop ratios in rotations | Minimum return intervals per crop; maximum crop shares by region | Public legal act | https://zakon.rada.gov.ua/laws/show/164-2010-п |
| `local_n` | Local practice in Cherkasy oblast, confirmed by the team's domain expert (N) in the rules review on 14 Nov 2026 (`docs/LOCAL_KNOWLEDGE.md`) | Predecessor effects, combos and anti-combos, shared-host groups | Team knowledge, no third-party material | `docs/LOCAL_KNOWLEDGE.md` |
| `csb` | USDA NASS Crop Sequence Boundaries 2023, fiboa edition on Source Cooperative (Red River Valley subset: Fargo – Grand Forks, both banks) | Crop labels for the crop model and its validation on a held-out MGRS tile | Public domain (U.S. Government work) | https://source.coop/fiboa/us-usda-cropland |
| `ukrstat_ck` | Main Department of Statistics in Cherkasy oblast: grain maize harvest 2021 (harvested area 347,801 ha) | Plausibility check of predicted crop shares only | Official statistics, facts cited | https://www.ck.ukrstat.gov.ua/source/arch/2022/vurobsg_kuk_21.pdf |
| `ua_cropmap_2020` | Chen B., Tu Y., An J., Wu S., Lin C., Gong P. (2024) Quantification of losses in agriculture production in eastern Ukraine due to the Russia-Ukraine war, Communications Earth & Environment; 10 m crop type map of Ukraine 2020 (wheat, sunflower, rapeseed, other, maize) | Training labels of the Ukrainian crop-name hints (one label per field-year, KPI majority rules) | CC-BY-4.0 | https://zenodo.org/records/11065080 |
| `kussul2025` | Kussul N., Shelestov A. et al. (2025) Ukrainian land use 2016–2024 from Sentinel-1/2, IJAEOG 140:104551 | Benchmark: crop types with local labels reach F1 > 0.9 | Article, cited | https://ela.kpi.ua/bitstreams/a8cb06b4-3563-4f52-99b3-6171937ea746/download |
| `csb_nass` | USDA NASS Crop Sequence Boundaries 2018–2025 (national, rev23) | USA field outlines and real crop history 2018–2025 per field (CDL codes) | Public domain (U.S. Government work) | https://www.nass.usda.gov/Research_and_Science/Crop-Sequence-Boundaries/ |
| `ndsu_sunflower` | NDSU Extension, sunflower production (H. Kandel: at least four years between sunflower crops) | USA rule: sunflower return interval | Facts cited | https://www.ndsu.edu/agriculture/sites/default/files/2023-12/a1995.pdf |
| `ndsu_blackleg` | NDSU Extension PP1988, Blackleg of canola (three-year rotation helps; four recommended) | USA rule: canola return interval | Facts cited | https://info.ext.nodak.edu/agriculture/sites/default/files/2022-11/pp1988.pdf |
| `umn_rhizoctonia` | University of Minnesota / NDSU, Rhizoctonia of sugarbeet (minimum three-year rotation; cereals are non-hosts) | USA rules: sugar beet return interval, cereals before beet | Facts cited | https://www.crystalsugar.com/wp-content/uploads/2025/03/AG-N-538_5-12-2010_MO.pdf |
| `sdsu_pulses` | SDSU Extension, field pea production (three years between pea crops and related pulses) | USA rule: pea return interval | Facts cited | https://extension.sdstate.edu/sites/default/files/2019-05/03-2003-2018.pdf |
| `ndsu_ascochyta` | NDSU Carrington REC, Ascochyta of chickpea: fundamentals of management (residue infective for at least four years) | USA rule: chickpea return interval | Facts cited | https://info.ext.nodak.edu/agriculture/sites/default/files/2025-04/2025%20CHICKPEA%20Ascochyta%20fundamentals%20of%20management.pdf |
| `isu_corn_rotation` | Iowa State University Extension, increasing the frequency of corn in crop sequences (corn after soybean +16 bu/acre on average; continuous-corn drag) | USA rules: soybean before corn, corn after corn | Facts cited | https://crops.extension.iastate.edu/increasing-frequency-corn-crop-sequences-grain-yield-and-response-nitrogen-research-update |
| `isu_soy_after_corn` | Iowa State University Extension, how does soybean yield fare following corn | USA rule: corn before soybean | Facts cited | https://crops.extension.iastate.edu/cropnews/2011/02/how-does-soybean-yield-fare-following-corn |
| `okstate_fhb` | Oklahoma State University Extension, considerations when rotating wheat behind corn (Fusarium head blight risk) | USA rule and anti-combo: wheat after corn | Facts cited | https://extension.okstate.edu/fact-sheets/considerations-when-rotating-wheat-behind-corn.html |
| `ncsu_fhb` | NC State Extension, planting to reduce head scab risk (lower Fusarium after soybean) | USA rule: soybean before wheat | Facts cited | https://smallgrains.ces.ncsu.edu/2024/08/planting-to-reduce-head-scab-risk/ |
| `ndsu_sclerotinia` | NDSU Extension: a minimum three-year rotation for fields with heavy sclerotinia (white mold) history | USA rules: white-mold hosts in sequence | Facts cited | https://www.ndsu.edu/agriculture/node/8182 |
| `geoboundaries` | geoBoundaries gbOpen UKR ADM1, simplified (Runfola et al. 2020; OpenStreetMap / Wambacher 2017) | Oblast outlines for the small-scale map layer and the coverage map | ODbL 1.0 | https://www.geoboundaries.org |
| `geonames` | GeoNames Ukraine dump (UA.zip) and admin1 codes | Village and town search in English and Ukrainian | CC-BY-4.0 | https://download.geonames.org/export/dump/ |

## Software

| Library or tool | Used for | Licence |
|---|---|---|
| React, Vite, TypeScript | Web app | MIT, MIT, Apache-2.0 |
| MapLibre GL JS | Map rendering | BSD-3-Clause |
| PMTiles (protomaps) | Field tiles in one file | BSD-3-Clause |
| Zustand, Recharts, Tailwind CSS, Vitest | State, charts, styles, tests | MIT |
| Unbounded, Onest (Fontsource) | Typefaces | SIL Open Font License 1.1 |
| earthaccess, rasterio, GeoPandas, Shapely, pandas, NumPy, SciPy, DuckDB, PyArrow, scikit-learn, LightGBM, pytest | Pipeline | MIT / BSD / Apache-2.0 |
| tippecanoe | Building vector tiles | BSD-2-Clause |

## Images and text

| Item | Origin | Licence / note |
|---|---|---|
| Lan logo (`logo/final-v3`) | Traced by our script `logo/build_logo.py` from an SI-generated grain image (Google Gemini) | Team-owned; carries a visible "SI-assisted" mark wherever shown |
