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
| `kmu164` | Cabinet of Ministers of Ukraine Resolution No. 164 of 11.02.2010 (as amended 30.06.2010, No. 536): normatives of crop ratios in rotations | Minimum return intervals per crop; maximum crop shares by region | Public legal act | https://zakon.rada.gov.ua/laws/show/164-2010-п |

## Software

| Library or tool | Used for | Licence |
|---|---|---|

## Images and text

| Item | Origin | Licence / note |
|---|---|---|
| Lan logo (`logo/final-v3`) | Traced by our script `logo/build_logo.py` from an SI-generated grain image (Google Gemini) | Team-owned; carries a visible "SI-assisted" mark wherever shown |
