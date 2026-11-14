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
