# Lan: a crop-rotation planner for any field, from NASA satellite data

**Live site: https://nazariipolishchuk.github.io/lan/** (phone or computer, nothing to install)

"Lan" is Ukrainian for a large farm field. Lan is our entry for the NASA Space Apps Challenge 2026,
challenge *Field Shift*.

## The idea in 30 seconds

A farmer has to decide what to sow next on each field. A crop sown on the same field too soon, or one
that does not suit a drier climate, causes problems for years. Advice usually comes from national
averages, not from that field's own history.

Lan takes the field's own history and its local weather from NASA Earth observations and turns them
into a plan:

1. **Its past.** For every field in Ukraine it shows eleven harvest years (2016–2026), read from NASA
   HLS satellite greenness. For each year it says whether the field had a winter crop, a summer crop or
   lay bare. Lan also covers the 48 contiguous US states (about 16 million fields); there the
   2018–2025 history is the real crop record from USDA's Cropland Data Layer, not our model.
2. **Its next season.** It shows what to sow next, scored 0–100 on water, heat, soil and disease. It
   shows what to avoid and until which year, for example under Ukraine's minimum return intervals
   (Resolution No. 164). US fields use a separate rule set with fewer sources (91 of 191 values have
   none yet and are marked as unverified).
   Weather risks come as "in x of the last N years", counted from 35 years of NASA POWER weather.
3. **Its plan.** Three ready rotations and the farmer's own plan sit side by side on one calendar. Each
   is scored, with good and bad crop sequences ("combos") and the reason and source for each.

The farmer has the final say. Any satellite estimate can be corrected, and the plan recalculates at
once. Nothing the farmer enters leaves the browser.

## Try it in 2 minutes

1. Open **https://nazariipolishchuk.github.io/lan/**. Use a private window if you want to see the
   first-visit screen again.
2. On the welcome screen press **"Show me how · 1 min"**. A 9-step guide highlights each part of the
   app in turn: search, map layers, a field's card, its history, what to sow, what to avoid, risks,
   the rotation comparison and your own plan. Skip or go back at any step. You can start it again at any
   time with the **? Guide** button in the top bar.
3. Or explore on your own:
   - Type the name of a place in the search box (Ukrainian or Latin letters, for example `Dubova`,
     `Умань`, `Poltava`), or press ◎ to go to where you are.
   - While zoomed out, the chips **Latest season / Drought / Rotation** colour the whole country. The
     legend explains the colours.
   - Zoom in until field outlines appear and **tap a field**. Its card opens.
   - At the bottom of the card press **Compare rotations**.

Direct links:

| What | Link |
|---|---|
| The demo field with the guide | https://nazariipolishchuk.github.io/lan/?demo=1 |
| The demo field's card | https://nazariipolishchuk.github.io/lan/#/f/8a9alcg08c |
| Its rotation comparison | https://nazariipolishchuk.github.io/lan/#/f/8a9alcg08c/compare |
| Ukrainian interface | https://nazariipolishchuk.github.io/lan/?lang=uk |
| About, sources and validation | https://nazariipolishchuk.github.io/lan/#/about |

**Testing?** The step-by-step UI/UX check (about 40 minutes) is in
[`docs/TEAMMATE_TESTS.md`](docs/TEAMMATE_TESTS.md). Write each problem as one row in
[`docs/BUGS.md`](docs/BUGS.md): device, steps, what happened, what you expected.

## What is on each screen

| Screen | What you see | Where it comes from |
|---|---|---|
| **Map** | Field outlines over Ukraine and the 48 contiguous US states; country-wide layers for the latest season, drought exposure and how well rotations are kept | Ukraine: Fields of The World outlines and our classifier over NASA HLS. USA: USDA Crop Sequence Boundaries with their CDL crop history |
| **Field card** | Size, region, slope, soil; the eleven-season history strip ("?" marks an uncertain year; **Edit** corrects it); **Sow next** with 0–100 scores; **Avoid** with the year each crop is allowed again; weather **risks** as "x of N years"; a watch calendar | HLS, NASA POWER, SoilGrids, terrain, Ukrainian rotation rules |
| **Why?** | Eight evidence charts: greenness against the field's own range, bare-soil months, rain in the critical window, heat and frost, root-zone moisture, then and now, terrain, soil | Each chart names its source and resolution |
| **Compare rotations** | "As now", "Balanced", "Drought-proof" and **My plan** on one month scale; scores for water, heat, soil and disease; combos and anti-combos; a climate switch (all years / last 10 / dry years only) | The rule engine, which runs in your browser |
| **Priorities** | What matters most to you, missing machinery, crops you cannot sell, irrigation. Banned crops are never suggested and are shown greyed out with the reason | Your inputs, stored only in your browser |

## How it works

```
NASA HLS (Landsat + Sentinel-2, 30 m, 2016–2026) ─┐
Fields of The World field outlines ────────────────┼─► greenness curve per field, per 10 days
                                                   │
                                                   ▼
                       classifier (gradient boosting) ─► winter / summer / bare for each season
                                                   │
NASA POWER daily weather (35 years) ───────────────┤
SoilGrids, terrain, Ukrainian rotation rules ──────┘
                                                   ▼
                     transparent rule engine (in the browser) ─► scores, risks, combos, plans
```

- `pipeline/` (Python) downloads and processes the satellite and weather data and exports compact
  files per area.
- `web/` (React + TypeScript + MapLibre) is a static site on GitHub Pages. All scoring runs in the
  browser, with no server.

## How accurate it is, including what did not work

- **Winter / summer / bare:** 95.3 % agreement with independent Ukrainian crop maps (KPI / World Bank,
  2019–2024) on 24,626 held-out field-seasons. In other regions it ranges from 79 % (Odesa, dry south)
  to 95 % (Dnipropetrovsk). Bare fields are the weak class.
- **Crop names in Ukraine** (maize, sunflower, …) are shown only as "maybe …" hints and never feed the
  rules. They come from models trained on the 2020 crop type map of Ukraine (summer macro-F1 0.83 on
  held-out tiles), but their yearly shares are not stable yet (the 2024 drought). Models trained on US
  data gave implausible shares in Ukraine and were dropped.
- **USA:** the 2018–2025 history is USDA CDL, a published crop map, so it is not our estimate. The 2026
  season is our model's and shows only winter / summer / not cultivated; that model has not been
  checked against a US map yet.
- **Weather** is about 50 km per cell, **soil** 250 m. Lan cannot see soil nitrogen, weeds, pests or
  prices. It supports an agronomist's judgement and does not replace it.

Details: [`docs/VALIDATION.md`](docs/VALIDATION.md). Every source is listed in
[`docs/REFERENCES.md`](docs/REFERENCES.md).

## Run it locally

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests: engine, rules, translations, guide layout
npm run build      # static site in web/dist
```

The map reads its data from `web/public/data`, a link to `data/out` produced by `pipeline/`. Without
running the pipeline, use the published data instead:

```bash
VITE_DATA_BASE=https://nazariipolishchuk.github.io/lan-data npm run dev
```

## Repository map

| Path | What is there |
|---|---|
| `web/` | The site: `src/screens` (intro and guide, field card, comparison, charts), `src/engine` (scoring rules), `src/map`, `src/i18n` (English and Ukrainian) |
| `pipeline/` | Data processing: HLS download, greenness curves, classifier, climate, soil, export |
| `docs/PLAN.md` | The full plan and the specification of the product |
| `docs/DECISIONS.md` | Every decision with its date and reason |
| `docs/VALIDATION.md` | Accuracy checks and their numbers |
| `docs/TEAMMATE_TESTS.md`, `docs/BUGS.md` | The UI test pass and the bug list |
| `docs/SI_USE.md` | Where AI tools were used |

## Team, AI use and licence

Team Lan, two people. The idea and every product decision are the team's. The code was written with
the help of Claude Code (Anthropic). The logo started from an AI image. Details are in
[`docs/SI_USE.md`](docs/SI_USE.md). Licence: MIT ([`LICENSE`](LICENSE)) for our own code and texts. Not covered by
it: the fonts in `docs/deck/fonts` (SIL Open Font License 1.1, licence files next to them), the logo (SI-assisted, based
on a Google Gemini image) and all data, whose licences are listed in [`docs/REFERENCES.md`](docs/REFERENCES.md) and on
the app's About screen.
