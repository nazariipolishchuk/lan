# Decisions and gate results

Every fork taken during the build, with the measured numbers behind it. Newest at the bottom of each section.
Times are Europe/Kyiv.

## Timeline

| When | Event |
|---|---|
| Sat 14 Nov 10:35 | P0 started (planned 09:00). 95 min behind the §9 schedule from the start. |

## Gates

| Gate | Result | Evidence |
|---|---|---|
| G1 Field polygons (FTW for Ukraine) | **PASS, own tiles needed.** GeoParquet has a unique string `id`; FTW's hosted PMTiles carry only `confidence` and `metrics:area`, no id, so we build our own tiles (tippecanoe) for processed areas and may show FTW's tiles as a context layer elsewhere | `Ukraine.parquet` 1,985 MB, 63 row groups, 4,116,875 rows (2024 + 2025). `Ukraine.pmtiles` 1,209 MB, z0–13, layers `2024`/`2025`. Range → 206, `Access-Control-Allow-Origin: *`, preflight 204 |
| G2 HLS throughput | pending | |
| G3 Crop labels, Path A or B | **Path B+.** No crop-specific KPI maps are openly downloadable. The World Bank DDH dataset 0066913 (CC-BY-4.0) ships KPI-methodology rasters for all of Ukraine, 2019–2024, with three classes: winter crops (2), summer crops (9), uncultivated (20). They give a per-field winter/summer/uncultivated history (flag `map`) and training labels at group level. Crop-specific classes come from our HLS classifier trained on CSB (Red River: spring wheat, maize, soy, sugar beet, sunflower, canola) plus WorldCereal 2021, checked on N's fields | `RawData.zip` 1,937 MB, `CropCover/Maps/Winter_Summer_{2019..2024}_19022025_crops.tif` 280–311 MB each; legend from `style_winter_summer.qml`. WB package 329 (64 MB) has no rasters. KPI 2016–2024 crop-type maps: paper only (Kussul et al., JAG 2025), no download found |
| G4 HTTPS from the laptop | **PASS.** The earlier TLS error is gone; the laptop fetches directly. Heavy HLS work still runs on the VPS (laptop disk) | POWER daily point: Python 200 in 0.9 s, Node 200 in 0.7 s, curl 200 |
| G5 Pages serves byte ranges | pending (P3) | |

## Probes (task 0.4)

| Probe | Result |
|---|---|
| VPS | Ubuntu 24.04.3, kernel 6.8, 2 cores, **1.9 GiB RAM** (not 4), **29 GB disk, 24 GB free** (not 60). uv 0.13.8 and tippecanoe 2.49 installed; project folder created; `.env` mode 600 |
| Earthdata token | Login works on the laptop (`True`) |
| HLS VI v2.0 | Both `HLSL30_VI` and `HLSS30_VI` found for tile T36UVV (Cherkasy). Season Mar–Nov 2025: L30 30 granules (9 under 30 % cloud), S30 128 granules (47 under 30 % cloud). Assets per granule: NDVI, EVI, SAVI, MSAVI, NDMI, NBR, NBR2, TVI, NDWI and **Fmask** (quality mask included). One scene = NDVI 3.49 MB + Fmask 2.12 MB = **5.6 MB**; server accepts byte ranges. Laptop single-stream download ≈ 1 MB/s |
| FTW Ukraine | See G1. Per year 2025: Cherkasy (UA-71) 131,029 polygons; by size: < 1 ha 101,813 (17,645 ha), 1–2 ha 6,979, 2–5 ha 6,787, 5–20 ha 5,822, 20–100 ha 5,731, ≥ 100 ha 3,897. Fields ≥ 2 ha: 22,237 covering ≈ 1.23 M ha (oblast arable land ≈ 1.27 M ha). Median confidence 89 for < 1 ha, 99 for ≥ 100 ha. A few polygons carry Russian region codes along the border (e.g. BEL, ROS): dropped |
| POWER | Daily point request returns in < 1 s; fill value −999.0 |

## Forks and cuts

| When | Fork | Why |
|---|---|---|
| Sat 10:45 | Field filter: polygons < 1 ha are dropped; 1–2 ha are kept with flag `small` | 102 k slivers and gardens in Cherkasy alone hold 1.4 % of the area; keeping them would multiply chunk size for nothing |
| Sat 10:45 | Field geometry year: FTW 2025 polygons; FTW ids are per year (the same field has different ids in 2024 and 2025) | Latest boundaries; id stability is within the 2025 release |
| Sat 10:45 | Pipeline uses uv's `src/lan/` layout instead of `pipeline/lan/` | uv default; no functional difference |
| Sat 10:45 | shadcn/ui is not installed at P0; Tailwind v4 only. Added later only if a component pays for itself | Fewer moving parts |
| Sat 10:45 | HLS budget re-estimated: 5.6 MB per scene (plan assumed 15–20 MB) → full Ukraine 2016–2026 ≈ 22,000 scenes ≈ 125 GB | Measured, see probes |
