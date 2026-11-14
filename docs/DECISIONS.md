# Decisions and gate results

Every fork taken during the build, with the measured numbers behind it. Newest at the bottom of each section.
Times are Europe/Kyiv.

## Timeline

| When | Event |
|---|---|
| Sat 14 Nov 10:35 | P0 started (planned 09:00). 95 min behind the §9 schedule from the start. |
| Sat 14 Nov 11:10 | HLS job started on the VPS for tiles 1–40 (Cherkasy first) |
| Sat 14 Nov 11:25 | CP0 reached (G1–G4 filled, fixtures load, VPS reads HLS). 55 min behind schedule, inside the 60-minute cut rule |

## Gates

| Gate | Result | Evidence |
|---|---|---|
| G1 Field polygons (FTW for Ukraine) | **PASS, own ids and own tiles needed.** GeoParquet has a string `id`, but it is **not unique** (see forks, 11:00); FTW's hosted PMTiles carry only `confidence` and `metrics:area`, no id, so we build our own tiles (tippecanoe) for processed areas and may show FTW's tiles as a context layer elsewhere | `Ukraine.parquet` 1,985 MB, 63 row groups, 4,116,875 rows (2024 + 2025). `Ukraine.pmtiles` 1,209 MB, z0–13, layers `2024`/`2025`. Range → 206, `Access-Control-Allow-Origin: *`, preflight 204 |
| G2 HLS throughput | **PASS: all of Ukraine fits by Sun 07:00 if the run continues overnight.** One tile-season ≈ 1 min on the VPS (3 download threads); 90 tiles × 11 seasons = 990 tile-seasons ≈ 16.5 h. Order: 9 Cherkasy tiles, then by distance (`logs/tiles.txt` on the VPS). Tiles 1–40 started Sat 11:10 as a daytime job; tiles 41–90 need N's yes for the night run | T36UVV 2025: 158 granules → 26 chosen (clearest per dekad), 454 MB, 57.9 s wall, peak RSS 1.55 GB; 13,171 fields, 234,644 field observations (median 18 per field), median valid share 1.0. Curves checked by eye: bare soil 0.22–0.27 in spring, summer crops peak in July–August, winter cereals peak in April–May |
| G3 Crop labels, Path A or B | **Path B+.** No crop-specific KPI maps are openly downloadable. The World Bank DDH dataset 0066913 (CC-BY-4.0) ships KPI-methodology rasters for all of Ukraine, 2019–2024, with three classes: winter crops (2), summer crops (9), uncultivated (20). They give a per-field winter/summer/uncultivated history (flag `map`) and training labels at group level. Crop-specific classes come from our HLS classifier trained on CSB (Red River: spring wheat, maize, soy, sugar beet, sunflower, canola) plus WorldCereal 2021, checked on N's fields | `RawData.zip` 1,937 MB, `CropCover/Maps/Winter_Summer_{2019..2024}_19022025_crops.tif` 280–311 MB each; legend from `style_winter_summer.qml`. WB package 329 (64 MB) has no rasters. KPI 2016–2024 crop-type maps: paper only (Kussul et al., JAG 2025), no download found |
| G4 HTTPS from the laptop | **PASS.** The earlier TLS error is gone; the laptop fetches directly. Heavy HLS work still runs on the VPS (laptop disk) | POWER daily point: Python 200 in 0.9 s, Node 200 in 0.7 s, curl 200 |
| G5 Pages serves byte ranges | pending (P3) | |

## Probes (task 0.4)

| Probe | Result |
|---|---|
| VPS | Ubuntu 24.04.3, kernel 6.8, 2 cores, **1.9 GiB RAM** (not 4), **29 GB disk, 24 GB free** (not 60). uv 0.13.8 and tippecanoe 2.49 installed; project folder created; `.env` mode 600 |
| Earthdata token | Login works on the laptop (`True`) |
| HLS VI v2.0 | Both `HLSL30_VI` and `HLSS30_VI` found for tile T36UVV (Cherkasy). Season Mar–Nov 2025: L30 30 granules (9 under 30 % cloud), S30 128 granules (47 under 30 % cloud). Assets per granule: NDVI, EVI, SAVI, MSAVI, NDMI, NBR, NBR2, TVI, NDWI and **Fmask** (quality mask included). One partial-coverage scene = NDVI 3.49 MB + Fmask 2.12 MB = 5.6 MB (full-coverage scenes average 17.5 MB, see G2); server accepts byte ranges. Laptop single-stream download ≈ 1 MB/s |
| FTW Ukraine | See G1. Per year 2025: Cherkasy (UA-71) 131,029 polygons; by size: < 1 ha 101,813 (17,645 ha), 1–2 ha 6,979, 2–5 ha 6,787, 5–20 ha 5,822, 20–100 ha 5,731, ≥ 100 ha 3,897. Fields ≥ 2 ha: 22,237 covering ≈ 1.23 M ha (oblast arable land ≈ 1.27 M ha). Median confidence 89 for < 1 ha, 99 for ≥ 100 ha. A few polygons carry Russian region codes along the border (e.g. BEL, ROS): dropped |
| POWER | Daily point request returns in < 1 s; fill value −999.0. No CORS header on a request without Origin (browser use untested) |
| Resolution No. 164 | In force (as amended 30.06.2010 No. 536). Minimum return intervals: rye, barley, oats ≥ 1 year; winter wheat ≥ 2; maize may be grown 2–3 years in a row; perennial legumes, grain legumes (incl. soy, peas, chickpea), sugar and fodder beet, winter and spring rapeseed ≥ 3; flax ≥ 5; lupin, cabbage ≥ 6; **sunflower ≥ 7**. Forest-Steppe maximum shares: grain + legumes 95 %, industrial crops 30 %, rapeseed 5 %, **sunflower 9 %**. Read through a summarising fetch; re-read the original before the rules review (2.7) |
| CSB (USA) | `source.coop/fiboa/us-usda-cropland/us_usda_cropland.parquet` + `.pmtiles`, licence file present; columns not read yet (P2) |
| SoilGrids | `files.isric.org/soilgrids/latest/data/clay/clay_0-5cm_mean.vrt` → 200, CORS `*`; CC-BY-4.0 |
| GeoNames | `download.geonames.org/export/dump/UA.zip` → 200, 2.4 MB; CC-BY-4.0 |
| Admin boundaries | geoBoundaries gbOpen UKR ADM1: 27 units (includes Crimea and Sevastopol), source OSM/Wambacher 2017, ODbL 1.0 |
| Basemap | EOX Sentinel-2 cloudless 2024 WMTS tile → 200, CORS reflects the origin. Licence of 2018+ editions is CC BY-NC-SA 4.0 (non-commercial; fine for the hackathon), attribution "Sentinel-2 cloudless by EOX IT Services GmbH (contains modified Copernicus Sentinel data)" |
| Terms and Conditions | **Not read yet.** spaceappschallenge.org serves an incomplete certificate chain: Python and WebFetch fail; to be read in Chrome |
| SMAP order (0.7) | Not placed yet; moved to P1 |

## Forks and cuts

| When | Fork | Why |
|---|---|---|
| Sat 10:45 | Field filter: polygons < 1 ha are dropped; 1–2 ha are kept with flag `small` | 102 k slivers and gardens in Cherkasy alone hold 1.4 % of the area; keeping them would multiply chunk size for nothing |
| Sat 10:45 | Field geometry year: FTW 2025 polygons; FTW ids are per year (the same field has different ids in 2024 and 2025) | Latest boundaries; id stability is within the 2025 release |
| Sat 10:45 | Pipeline uses uv's `src/lan/` layout instead of `pipeline/lan/` | uv default; no functional difference |
| Sat 10:45 | shadcn/ui is not installed at P0; Tailwind v4 only. Added later only if a component pays for itself | Fewer moving parts |
| Sat 11:00 | **Own field ids.** FTW ids repeat across its processing chunks (598,088 Ukrainian fields ≥ 1 ha, only 351,295 distinct FTW ids). Our id = 10 base36 characters from the centroid at ~1 m; FTW's id kept as `ftw_id`. 288 polygons sit in two FTW partitions on oblast borders; the loader keeps one | Unique, stable, short ids are required by the contract |
| Sat 11:00 | Fields are stored as 16 parquet parts in `work/fields/`, built in subprocesses; readers go row group by row group; zonal statistics touch only field pixels | The VPS has 1.9 GiB RAM; three earlier attempts were killed by the OOM killer at 1.75 GB |
| Sat 11:00 | Fields ≥ 1 ha in Ukraine (FTW 2025): 598,088, ≈ 31 M ha (Ukraine's arable land ≈ 32.7 M ha); Cherkasy 29,214 fields, 1.24 M ha | Measured |
| Sat 11:20 | HLS budget: a full run averages **17.5 MB per scene** (454 MB / 26 scenes on T36UVV; the 5.6 MB probe was a partial-coverage scene). 990 tile-seasons × ≈ 450 MB ≈ 450 GB of traffic, inside the 3 TiB monthly allowance; nothing large stays on disk | Measured in the G2 run |
