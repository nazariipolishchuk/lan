# Lan — Field Shift: Implementation Plan

> **For agentic workers:** execute phase by phase (P0 → P9, §10). Every task has a checkbox and a
> verification line. Start every working session by reading §0 and `docs/DECISIONS.md`.
> Execution mode: native, in the main session; one phase fits one `/goal`.

**Goal:** a public web app where a farmer finds a field on a satellite map, taps it and gets a
game-like field card: what grew there for 11 seasons (reconstructed from NASA HLS), what to sow next
and what to avoid, climate risks as "x of N years", what to watch during the season, and a
side-by-side comparison of at least three rotation strategies scored with combos. Everything is
explainable and every gap is stated.

**Architecture:** a Python pipeline on the VPS precomputes per-field and per-climate-cell JSON plus
vector tiles from NASA and open data. A static React + MapLibre app on GitHub Pages loads them and
runs a transparent TypeScript rule engine in the browser. There is no backend. Machine learning does
one job only: reconstructing crop history, with measured accuracy.

**Tech stack:** Python 3.12 (uv, earthaccess, rasterio, numpy, pandas, geopandas, duckdb, lightgbm,
scikit-learn, pytest) · Vite + React + TypeScript, MapLibre GL, pmtiles, Tailwind, shadcn/ui,
Recharts, zustand, vitest · tippecanoe · GitHub Pages · OBS + ffmpeg for the demo.

**Spec:** §3–§7 of this file. Source material: the Field Shift challenge statement, the Project
Submission Guide and the Judging & Awards Guide (both dated 13 Nov 2026), and the team decisions in §3.

**Provenance note:** drafted on 14 Nov 2026 between 02:40 and 03:00 EET, before the official 09:00
start, by the team's decision. It contains no code and no data. Nothing was downloaded, installed or
committed while writing it. Every item marked **VERIFY** is deliberately left for phase P0.

All times are Europe/Kyiv (EET, UTC+2). People: **N** = Nazarii (team owner, domain expert),
**T** = teammate (tester, design feedback, video), **C** = Claude (code, data, model, drafts).

---

## 0. Status board

Update this table at every checkpoint. It is the single source of truth after a context reset.

| Phase | Window | Outcome | Status |
|---|---|---|---|
| P0 Bootstrap and gates | Sat 09:00–10:30 | Repo, environments, measured facts, frozen data contract | ☑ 11:17 (SMAP order open; T&C read; team confirmed) |
| P1 Data foundation + app shell | Sat 10:30–14:00 | Real fields on the map, climate for Ukraine, card on fixtures | ☑ 11:55 (Cherkasy only for soil/terrain/tiles; local-knowledge sheet done) |
| P2 Engine + history | Sat 14:00–18:00 | Card is real end to end in the deep zone | ☑ 16:19 (history at group level, crop names as hints; rules reviewed by N) |
| P3 Compare + evidence + first deploy | Sat 18:00–22:00 | Live link, scope level L0 complete | ☐ |
| P4 Expansion + polish I | Sat 22:00–02:00 | Night run started, layers, search, About, mobile | ☐ |
| Night | Sun 02:00–08:00 | VPS processes the rest of Ukraine; people sleep | ☐ |
| P5 Ingest + human validation | Sun 08:00–11:00 | Wider coverage live; validation numbers; bug list | ☐ |
| P6 Fix and freeze | Sun 11:00–15:00 | Insurance submission at 12:00; feature freeze 14:00 | ☐ |
| P7 Presentation | Sun 15:00–18:30 | Video ≤ 30 s, project page text and images, README | ☐ |
| P8 Submit | Sun 18:30–20:30 | "Submit for Judging" done and verified | ☐ |
| P9 Buffer + wrap | Sun 20:30–23:00 | Only critical fixes; final freeze 23:00 | ☐ |

| Gate | Decided at | Question | Result |
|---|---|---|---|
| G1 | P0 | Field polygons: is FTW usable for Ukraine, is there a stable id, can the browser read its tiles? | ☑ usable; own ids; own tiles (FTW tiles have no id) |
| G2 | P0 | HLS throughput: how many tiles can the night run finish by Sun 07:00? | ☑ ~1 min per tile-season; all 90 tiles by morning if run overnight |
| G3 | P0 | Crop labels for Ukraine: Path A (KPI crop maps) or Path B (no local labels)? | ☑ Path B+ (KPI winter/summer maps 2019–2024 + CSB-trained classifier) |
| G4 | P0 | Can the laptop fetch over HTTPS from Python and Node, or does all fetching go through the VPS? | ☑ yes (except sites with broken chains) |
| G5 | P3 | Does GitHub Pages serve PMTiles with HTTP Range requests? | ☐ |

**How N drives the work:** one message per phase, for example
`/goal Execute phase P1 of docs/PLAN.md`. Approvals needed are listed in §15.
C reports after each phase in Ukrainian: done / verified (with evidence) / only written / left for N.

---

## 1. Mission and how we are judged

One sentence: **Lan gives every field a second opinion with evidence — its past from NASA satellites,
its next three seasons as rotation options a farmer can compare.**

The challenge asks for a decision-support tool that combines NASA Earth observations with local soil
information, crop characteristics and farmer priorities, compares at least three rotation strategies
including the existing one, and for each explains why it was suggested, what evidence supports it,
what benefits it may offer, where information gaps exist, and which risks need local review. It must
support farmer judgment, not replace it.

Each criterion is scored 1–5. The project page is the main thing judges read; the demo feeds the
Presentation score.

| Criterion | What the guide rewards | What we show |
|---|---|---|
| Impact | A significant problem, wide reach | Rotation discipline under a shifting climate; works on any pre-mapped field; plain-language card usable on a phone in the field |
| Creativity | A novel concept or a meaningful improvement | Field history reconstructed from space, rotation as a combo game, the card format; existing farm apps monitor the current season instead |
| Validity | Sound science, feasible, usable | Measured accuracy on held-out areas, sourced agronomy rules, unit-tested engine, stated limits, real user test numbers |
| Relevance | NASA data as a core component | HLS drives history and current field state; POWER, IMERG and SMAP drive every risk number; SRTM drives erosion |
| Presentation | Clear, engaging storytelling | 30 s video with a real field, a guided demo field on the live site, a project page with screenshots |

Global awards this project could plausibly fit: Local Impact, Best Use of Data, Best Use of Science,
Galactic Impact. That is a direction for emphasis, not a promise.

**Definition of done for the hackathon:** the project is submitted before Sun 20:00 with (1) a live
public site where the demo field works on a phone, (2) a public video of at most 30 s with English
subtitles, (3) a public repository with a README covering method, data, measured accuracy, limits
and SI use, and (4) all required form fields completed in English.

---

## 2. Hard constraints

### 2.1 Official rules (Project Submission Guide, Judging & Awards Guide, FAQ)

| # | Rule | Exact value |
|---|---|---|
| C1 | Work window | Sat 14 Nov 09:00 to Sun 15 Nov 23:59, local time of the event (Universal Event: Team Owner's local time). No project work before 09:00 |
| C2 | Demo | Video of 30 seconds or less, **or** a slide deck of up to 7 slides including title and intro. Exceeding either limit makes the project ineligible for Global Judging |
| C3 | Language | English on the project page and in all linked materials. A video may be spoken in another language but must have English subtitles |
| C4 | Links | Publicly accessible, no password, permission or registration. Test in a private window |
| C5 | NASA data | At least one NASA dataset or resource is required for a Global Award |
| C6 | SI use | State where and how SI tools were used. SI-generated images and videos need a visible watermark. Code and data must acknowledge SI generation in descriptive text and metadata. Generated content must not use NASA branding. SI must not be used to come up with the idea of how to solve the challenge |
| C7 | People in media | No images, video, audio or other likeness of persons under 18 |
| C8 | References | List all data, resources and tools, including code, text and images, even if open source. Use only materials we have permission to use |
| C9 | Team | All members confirmed on the same event (not waitlisted) and shown on the Members tab. Universal Event teams need at least 2 members. Maximum 6 |
| C10 | Submitting | All required fields complete; tick "Terms and Conditions" and "Confirm All Work is Original"; press "Submit for Judging". Resubmission is allowed until the deadline; only the last saved submission is judged |
| C11 | Project page media | Images only: JPG, PNG, GIF up to 10 MB each. No video or document upload |
| C12 | Third-party data | For non-U.S.-Government sites, comply with each site's data-use terms |

Form fields: Project Name · High-Level Project Summary · Link to Project Demo · Link to Final Project ·
Detailed Project Description · Use of Super Intelligence (SI) · NASA Data · Space Agency Partner Data
and Other References. ESA is a 2026 Space Agency Partner, so Sentinel-based products count as partner data.

Result dates: Global Nominees 3 Dec 2026 · Finalists and Honorable Mentions 17 Dec 2026 · Winners 26 Jan 2027.
The site must stay online until at least the end of January 2027.

### 2.2 Team rules (N's standing instructions)

| # | Rule |
|---|---|
| U1 | Outward actions (push, publishing, registrations, forms, uploads) happen only after N's explicit yes for that specific action |
| U2 | Nothing is deleted without an exact list and permission. This plan deletes nothing |
| U3 | Package installs, background processes and long runs need approval. §15 bundles them into one approval |
| U4 | Secrets are never printed. `.env` is git-ignored before the first commit; code reads the token from the environment only |
| U5 | Everything in the repo is in English; commits are short. Chat is in Ukrainian |
| U6 | Never report unverified work as verified. Measure instead of assuming |
| U7 | No public layer of drone or ordnance locations. Only a private per-farmer "unsafe plot" flag stored in the browser |
| U8 | No server addresses, key names or personal data in the repo |

### 2.3 Infrastructure limits (measured 14 Nov unless marked)

| Resource | Limit |
|---|---|
| Laptop (Windows 11) | 51 GB free on C:. Node 22.22, npm 10.9, uv 0.11, Python 3.13, git 2.51, ffmpeg 8.1, gh 2.89, OBS and rclone installed. curl and WebFetch fail with a TLS error (SEC_E_UNTRUSTED_ROOT), so heavy fetching runs on the VPS (gate G4) |
| VPS (Germany, Ubuntu) | 2 cores, 4 GB RAM, about 60 GB disk, 1 Gbit port, 3 TiB traffic per month (N's figures). Used for downloads and processing only |
| GitHub Pages | Site up to 1 GB; files pushed through git up to 100 MB each; static files only, no server code |
| Earthdata token | In `.env` on the laptop; valid for roughly 60 days |

---

## 3. Decisions already made

| # | Decision | Source |
|---|---|---|
| D1 | Challenge: Field Shift. Team: Lan, two people. "Lan" is Ukrainian for a large farm field | N, 3 Nov |
| D2 | Product concept: an interactive map; tap a pre-mapped field; a game-like card shows its stats, what can be sown, what is lacking, field specifics and recommendations | N, 3 Nov and 13 Nov |
| D3 | Coverage: the design works anywhere; the target is all of Ukraine; processing starts with Cherkasy oblast and spreads outward. The US Red River Valley is a validation region with official field-level crop records | N, 14 Nov |
| D4 | Stack: Python precompute, static React + MapLibre front end. No Rust, no backend | N, 14 Nov (2A) |
| D5 | Hosting: GitHub Pages for the site. The VPS is a compute box only. Google Drive is at most a backup | N, 14 Nov |
| D6 | Recommendations come from transparent rules. ML is used only for crop-history reconstruction. No LLM inside the product; texts come from templates | N, 14 Nov (3A) |
| D7 | Rotation is shown as timeline lanes for comparison, with combos and anti-combos between neighbouring crops | N, 14 Nov |
| D8 | Rotation is date-aware: a sowing window that has passed is not offered; a crop already in the ground is detected and locked | N, 14 Nov |
| D9 | A web app, installable to the home screen. No native desktop or mobile app | N, 14 Nov |
| D10 | No farmer interviews. N's own knowledge of local fields is the ground truth | N, 14 Nov (5B) |
| D11 | Crops: winter wheat, winter barley, spring barley, grain maize, sunflower, soybean, sugar beet, winter rapeseed; drought alternatives peas, chickpea, sorghum; slots fallow and cover crop | N, 14 Nov |
| D12 | Third-party open data is allowed and cited; NASA data stays at the core | N, 14 Nov |
| D13 | Field boundaries come from Fields of The World (CC-BY-4.0), not drawn by hand | N, 13 Nov |
| D14 | Demo format: a video of at most 30 s. Final project link: the live site. Repository public | N, 14 Nov |
| D15 | Unattended overnight processing on the VPS is allowed | N, 14 Nov (2A) |
| D16 | Roles: C builds; N decides, labels known fields, writes and voices, submits; T tests, gives design feedback, edits the video | N, 14 Nov |
| D17 | Logo: `logo/final-v3`. It derives from a Gemini image, so it carries a visible "SI-assisted" mark wherever it appears | N, 3 Nov; rule C6 |
| D18 | Farmer inputs (history edits, priorities, unsafe flags) stay in the browser | C proposed, N accepted 14 Nov |
| D19 | UI is bilingual: English by default (judges), Ukrainian by switch (farmers) | proposed here, **N to confirm** |
| D20 | Our own map (MapLibre with satellite imagery), not a Google Maps extension: an extension is brittle and judges would have to install it | C proposed, N accepted 14 Nov |
| D21 | Validation uses bad seasons N remembers and crop history, never absolute yields (local yield figures are unreliable) | N, 3 Nov |

Open decisions for N are listed in §15.

### Idea provenance (for the SI field of the form)

Rule C6 says SI must not come up with the idea of how to solve the challenge, so this is recorded honestly.

| Came from the team (N) | Suggested by SI in discussion and adopted by the team |
|---|---|
| Interactive map where tapping a field opens a game-like card | Timeline-lanes layout for comparing rotations |
| Fields already mapped; choose a region or use geolocation; tap; see what to sow, what not to sow, risks, what to watch during ripening | Reconstructing crop history from yearly greenness curves with a classifier |
| Rotation chains as combos | Choice of datasets, stack and validation design |
| Date-aware rotation (a passed season does not count as the future) | Climate-scenario switch, "x of N years" risk wording |
| Sunflower overuse and its drying effect as the core local problem | Code, data pipeline, text drafts |
| Drones and unsafe plots as part of field reality | Logo base image (Gemini), vectorised by code |

---

## 4. Product, users and usefulness

### 4.1 Who it is for

| User | Situation | What they get |
|---|---|---|
| Small or mid-size farmer without a staff agronomist | Decides by experience, neighbours and this year's price; sunflower wins too often | A rule check on their own field, alternatives next to the current rotation, risks in plain numbers |
| New leaseholder or buyer of a plot | Does not know what grew there | 11 seasons of crop history without paperwork |
| Agronomist or adviser | Knows the rules, needs evidence for the owner | A second opinion with charts to show |
| Landowner, bank, insurer (secondary) | Wants to know whether a field is being exhausted | A visible rotation record |

Not the target: large agroholdings. They already have season-monitoring platforms, staff agronomists
and private soil tests.

### 4.2 What it adds, and what it cannot do

Adds: (1) crop history of any mapped field; (2) automatic checks of return intervals and bad
predecessors; (3) climate risk as frequencies over about 40 years, with the last decade compared to
the baseline; (4) at least three rotations side by side, including the current one, with combos;
(5) a watch calendar for the chosen crop; (6) honest gaps next to every claim.

Cannot do, and says so in the UI: nutrient status (satellites do not measure N, P, K) · prices and
margins · pest scouting · legal parcel boundaries · reliable history for fields under about 2 ha ·
next season's weather · field-scale weather (the climate grid is district scale, roughly 10–50 km).

### 4.3 Honest usefulness verdict

- **Useful** as a second opinion and a memory aid. The most defensible feature is history
  reconstruction plus the rule check: it is objective and anyone can verify it against a field they know.
- **Risk:** an experienced agronomist learns little from textbook advice. The card must therefore show
  field-specific evidence (this field's history, this cell's bad years), not generic lines.
- **Risk:** the advice is only as good as the rules table. N reviews it (task 2.7) and every number
  in it has a source.
- **Not useful** as an autopilot, and it is not presented as one.

### 4.4 Usefulness tests (Sun 08:30–11:00, results published whatever they are)

| # | Test | Who | Pass mark |
|---|---|---|---|
| UT1 | History: compare reconstructed crops with what N remembers on fields he knows | N | Report hits/total; aim for at least 80 % at crop-group level |
| UT2 | Advice sanity: for at least 10 known fields N marks each top-3 suggestion sensible / debatable / wrong | N | No "wrong" in first place; every "wrong" becomes a rule fix or a documented gap |
| UT3 | Bad years: do the risk charts flag the bad seasons N remembers (at least 3 year + crop pairs)? | N | Report hits and misses |
| UT4 | Five-second test: after 5 s on the card, can a person say what to sow and what to avoid? | T and any adult nearby | They can |
| UT5 | Phone task: find a village, tap a field, open the comparison, change one crop in "My plan" | T | Under 2 minutes, no help |

Numbers, including failures, go to `docs/VALIDATION.md`, the README and the project page.

---

## 5. UX specification

### 5.1 Principles

1. The answer first, the reasons one tap away.
2. Plain words: "greenness (NDVI)", not "NDVI". Every term has a one-line explanation (§5.9).
3. Risk as "in 6 of the last 20 years", never as a bare percentage or sigma.
4. Every estimate is labelled as an estimate and can be corrected by the farmer.
5. Each recommendation carries the five items the challenge names: why · evidence · benefits · gaps · check locally.
6. Colour is never the only signal: icons and words accompany traffic-light colours.
7. Phone first. Desktop: map plus a 420 px right panel. Phone: map plus a bottom sheet with three heights (peek, half, full).
8. Visual direction: dark "night field" UI built on the logo palette (background `#030D0F`, gold `#E1BC64`, pale blue `#9BC2D7`), satellite imagery as the hero. Game feel comes from stat bars, combo links and instant feedback, not from cartoons.

All numbers inside the wireframes below are illustrative.

### 5.2 Screen inventory

| # | Screen | Reached from | Purpose |
|---|---|---|---|
| S0 | Intro | First visit, `#/` | Three-second globe-to-Ukraine fly-in, one line of value, "Find my field" and "Try a demo field" |
| S1 | Map | Always present | Find and pick a field |
| S2 | Field card | Tap a field | The answer: was / sow / avoid / risks / watch |
| S3 | History editor | "Edit" on the history strip | Correct what the satellite guessed |
| S4 | Priorities and constraints | Chip on the card and on S5 | Tell the tool what matters and what is impossible |
| S5 | Compare rotations | Button on the card | At least three lanes side by side, combos, scores, the five explanation items |
| S6 | Crop tile detail | Tap a tile in S5 or a crop in S2 | Why this crop here, its risks and its watch calendar |
| S7 | Evidence ("Why?") | Button on the card, links from S5 and S6 | Charts behind every claim, with source and resolution |
| S8 | About: method, data, limits, glossary | Top bar | What is measured, how accurate it is, what it cannot know, SI use, references |
| S9 | Demo tour | "Try a demo field", `?demo=1` | A judge sees the best state in ten seconds |

Routes: `#/` · `#/f/{fieldId}` · `#/f/{fieldId}/compare` · `#/about`. Query parameters:
`lang=en|uk`, `date=YYYY-MM-DD` (override "today"), `demo=1`.

Three journeys the screens must serve:

| Who | Path | Time |
|---|---|---|
| Farmer on a phone, in the field | S1 📍 locate → tap own field → S2 read "Sow next / Avoid" → S3 fix one wrong year → S5 compare → change one crop in "My plan" | 2 minutes |
| Agronomist at a desk | S1 search a village → tap a field → S7 check the evidence → S4 set constraints → S5 read [details] of each lane → share the URL with the owner | 5 minutes |
| Judge with no context | S0 "Try a demo field" → S9 three coach marks → S5 → S8 accuracy and limits | Under 1 minute to the first "aha" |

### 5.2a S0 Intro (first visit only; any tap skips it)

```
┌────────────────────────────────────────┐
│        (globe turns, flies to Ukraine) │
│                                        │
│  Lan                                   │
│  Tap a field. See its past.            │
│  Plan its future.                      │
│                                        │
│  [ Find my field ]  [ Try a demo field ]
│                                        │
│  1 Pick a field   2 Read its card      │
│  3 Compare rotations                   │
│  Built on NASA Earth observations  EN|UK
└────────────────────────────────────────┘
```

"Find my field" opens S1 with the search focused. "Try a demo field" starts S9. The intro is not
shown again once dismissed; About has a link to replay it.

### 5.3 S1 Map and S2 Field card (phone)

```
┌────────────────────────────────────────┐
│ 🔍 Find a village…      [📍] [EN|UK] ⓘ │  top bar: search, locate me, language, About
│ Layer: [Last crop] [Drought] [Rotation]│  layer chips + legend
│                                        │
│   satellite imagery, fields outlined   │  outlines from zoom 12; below that:
│        ┌────┐ ┌──────┐                 │  "Zoom in to see fields" + oblast shading
│        │ ▓▓ │ │      │ ← tap           │
│        └────┘ └──────┘     Today 14 Nov│  date chip (shows ?date override)
├────────────────────────────────────────┤  bottom sheet, half height
│ Field · 42 ha · loam · slope 2 %       │  header + "satellite estimate" badge
│ Was: 🌻21 🌾22 ?23 🌻24 🌾25 🌻26 [Edit]│  history strip, 11 seasons, scrollable
│ Now: winter crop is up (seen 6 Nov)    │  current state from HLS
│                                        │
│ ✅ Sow next     Soy · Spring barley · Peas
│ ⛔ Avoid        Sunflower until 2033 — it was here in 2024 and 2026
│ ⚠ Risks        July drought in 6 of the last 20 years
│ 👁 Watch        5–25 Jul: moisture at flowering
│                                        │
│ [Compare rotations]  [Why?]  [Priorities]
│ Rotation health ▓▓▓▓▓░░░ 58   🚩 Mark unsafe
└────────────────────────────────────────┘
```

Map interactions:

| Action | Result |
|---|---|
| Type in search | Client-side match on settlement names (English and Ukrainian); choosing one flies there at zoom 13 |
| 📍 | Browser geolocation after the browser's own permission prompt; flies to the position; nothing is sent to any server |
| Pan and zoom | Field outlines appear from zoom 12; below it oblast-level shading of the active layer |
| Layer chip | Recolours fields: last crop (2026) · drought risk · rotation health; the legend follows |
| Hover (desktop) | Outline highlight and a tooltip: area and last crop |
| Tap a field | Selects it, opens S2, updates the URL to `#/f/{id}`; the URL is shareable |
| Tap outside any field | Closes the card; a hint offers a climate-only card for that point (state E3) |

Card interactions:

| Element | Tap result |
|---|---|
| History strip item | Year detail: greenness curve of that year, confidence, "this is an estimate" |
| "?" in history | Explains low confidence and invites correction |
| Edit | Opens S3 |
| A crop under "Sow next" | Opens S6 for that crop |
| "Avoid" line | Shows the rule, the year it was last grown and the source |
| "Risks" line | Opens S7 at that chart |
| "Watch" line | Opens the watch calendar in S6 |
| Compare rotations | Opens S5 |
| Why? | Opens S7 |
| Priorities | Opens S4 |
| Mark unsafe | Private flag; the field is excluded from recommendations and is not counted as bare; stored only in this browser |
| Rotation health | Explains the 0–100 score and its four parts |

### 5.4 S3 History editor

```
┌────────────────────────────────────────┐
│ What grew on this field?          Done │
│ 2026  🌻 Sunflower   satellite · sure  ▾│
│ 2025  🌾 Winter cereal satellite · sure ▾│
│ 2024  🌻 Sunflower   you said          ▾│  farmer icon = corrected by you
│ 2023  ?  Not sure    too many clouds   ▾│
│ …                                      │
│ [ Reset to satellite estimate ]        │
│ Stays in this browser only.            │
└────────────────────────────────────────┘
```

A list of seasons 2016–2026. Each row: the satellite guess with its confidence and a crop picker
(11 crops, fallow, "I don't know"). Buttons: "Reset to satellite estimate", "Done". Edits are saved
in the browser, marked with a farmer icon on the strip, and everything recalculates immediately.
A hidden export button (About → "Export my corrections") downloads the edits as JSON; N uses it for UT1.

### 5.5 S4 Priorities and constraints

| Group | Controls |
|---|---|
| What matters most | Four sliders: save water · protect soil · lower risk · keep cash crops |
| Equipment | Toggles: sugar-beet harvester · row-crop planter · grain dryer |
| Market | "I can sell": a toggle per crop |
| Water | Irrigation available: yes / no |
| Crops to keep or exclude | Per-crop pin and ban |

Changing anything re-scores the card and S5 at once. A banned or unsellable crop is never suggested
and is shown greyed out with the reason.

### 5.6 S5 Compare rotations (desktop; on a phone the lanes stack and scroll sideways)

```
Field 42 ha · Climate: [40 years] [last 10 years] [dry years only]      Priorities ⚙

          2024   2025   2026  │ 2027 (in ground)  2028          2029          2030
As now     🌻     🌾     🌻    │ 🌾 winter wheat ──✖── 🌻 sunflower ─✖─ 🌾 w. wheat ── 🌻
                               │    returned too soon · dry soil after sunflower
           Water ▓▓░░ Heat ▓▓▓░ Soil ▓░░░ Disease ▓░░░            Score 41   [details]

Balanced   (same past)         │ 🌾 winter wheat ─🌱 cover─✔── 🫘 soy ──✔── 🌽 maize ── 🌾
                               │    cover shields soil · nitrogen bonus      ★ Combo ×2
           Water ▓▓▓░ Heat ▓▓▓░ Soil ▓▓▓▓ Disease ▓▓▓░            Score 78   [details]

Drought-   (same past)         │ 🌾 winter wheat ─────✔── 🟤 chickpea ─✔── 🌾 w. barley ── sorghum
proof                          │    nitrogen bonus · early harvest keeps moisture
           Water ▓▓▓▓ Heat ▓▓▓░ Soil ▓▓▓░ Disease ▓▓▓░            Score 74   [details]

My plan    (same past)         │ 🌾 winter wheat ── [ + choose ] ── [ + choose ] ── [ + choose ]
```

| Element | Behaviour |
|---|---|
| Lanes | Always at least three: "As now" (the pattern continued), "Balanced", "Drought-proof"; plus the editable "My plan" |
| Tile | Spans sowing to harvest on a month scale, so winter crops visibly cross the year boundary; a locked tile (crop already in the ground) has a pin |
| Link between tiles | Green with a label for a combo, red for an anti-combo; tap it for the reason and source |
| Cover-crop slot | A thin tile between harvest and the next sowing where the calendar allows it |
| Stat bars | Water · Heat · Soil · Disease, 0–100, with the total score |
| [details] | The five items for that strategy: why suggested · evidence · benefits · information gaps · check locally |
| Climate switch | Re-scores every lane on a subset of years: all, the last 10, or the driest third |
| My plan | Tap a slot, pick a crop; links, bars and score update instantly; impossible picks (window passed, banned) are disabled with the reason |
| Tap a tile | Opens S6 |

### 5.7 S6 Crop tile detail and S7 Evidence

```
S6 Crop detail (phone)                      S7 Evidence (phone)
┌──────────────────────────────┐            ┌──────────────────────────────┐
│ 🫘 Soybean · 2028        ✕   │            │ Why?  Field 42 ha        ✕   │
│ Why here                     │            │ [Greenness][Rain][Heat][Soil]│  chart tabs
│ ✔ After winter wheat         │            │                              │
│ ✔ Fixes nitrogen for 2029    │            │  ▁▃▆█▇▅▂  this season        │
│ Sow 25 Apr–15 May            │            │  ─ ─ ─ ─  its usual range    │
│ Harvest 10–30 Sep            │            │                              │
│ Risks here                   │            │ "Greenness peaked 20 % below │
│ ⚠ Dry August: 7 of 20 yrs ▸ │            │  this field's own average."  │
│ ⚠ Early frost: 2 of 20 yrs ▸│            │ Source: NASA HLS, 30 m.      │
│ Watch                        │            │ Estimate, not a measurement  │
│ 👁 1–20 Aug: pod fill, water │            │ of yield.                    │
│ We do not know               │            │ [40 years][last 10][dry yrs] │
│ · soil nitrogen · prices     │            │                              │
│ Sources ▸                    │            │ What this cannot tell you ▸  │
└──────────────────────────────┘            └──────────────────────────────┘
```

S6: crop name and icon · why it fits here (predecessor effect, climate fit) · sowing and harvest
window for this cell · hazards as "x of N years" each linking to a chart · the watch calendar
(what to look at, in which dates, on foot or with a drone — the satellite points to where, a
ground check confirms) · what we do not know · sources.

S7 charts, each with a plain caption, the source and its resolution ("district scale, about 50 km —
not your field alone"):

| Chart | Data |
|---|---|
| Greenness of this field: this season against its own previous seasons | HLS |
| Bare-soil calendar: months the field usually stands uncovered | HLS |
| Rain in the critical window, by year | IMERG, POWER |
| Hot days and frost dates by year | POWER |
| Soil moisture against normal | SMAP, POWER soil wetness |
| Then and now: last 10 years against the baseline | POWER |
| Terrain: slope and where water runs | SRTM |
| Soil: texture, organic carbon, pH | SoilGrids |

### 5.8 S8 About and S9 Demo tour

S8 sections: How it works in three steps · Data used (table with resolution and years) · How accurate
is the history (numbers and confusion matrix from §11) · What satellites cannot see · Satellite
versus ground measurements · Glossary · It supports, it does not replace, an agronomist · Privacy
(your inputs never leave the browser) · SI use · References and licences · Coverage map (where
history is processed, where only climate is).

S9: "Try a demo field" opens a curated field with a clear story (sunflower returned too soon) and
three coach marks: history strip → avoid line → Compare rotations. One "Skip" button.

### 5.9 States that must not break

| # | Situation | What the user sees |
|---|---|---|
| E1 | Field in an area whose history is not processed yet | Card with climate, soil and terrain; "History not processed here yet — add it yourself" with the editor |
| E2 | Field under about 2 ha or a sliver | "Too small for 30 m satellite data"; no history claims; climate advice still shown |
| E3 | Tap where no field polygon exists | "No mapped field here"; offer a climate-only card for the point |
| E4 | A season with too few cloud-free looks | "?" for that year; the engine works with the gap and says so |
| E5 | Data file fails to load | Short message with "Retry"; never an endless spinner |
| E6 | Browser storage unavailable | The app works; edits last for the session; a one-line notice |
| E7 | Location permission denied | Search stays available; no repeated prompts |

Glossary terms: greenness (NDVI) · evapotranspiration · soil-moisture anomaly · frost risk · water
balance · growing degree days · predecessor · return interval · cover crop · confidence.

Language: every string lives in `web/src/i18n/en.ts` and `uk.ts`; the switch persists; English is
the default.

---

## 6. Rotation engine

A pure TypeScript module (`web/src/engine/`), no network, no randomness, fully unit-tested. The same
code runs in the browser for the card and in Node for batch layer colouring, so there is exactly one
implementation of the rules.

### 6.1 Inputs and outputs

| Input | From |
|---|---|
| Field record: area, soil, slope, history, current state, bare days | `fields/{ck}.json` |
| Climate cell: per-year dekadal indicators, about 40 years | `climate/{cell}.json` |
| Crop catalogue and rules | `rules/crops.json`, `rules/rules.json` |
| Farmer overrides: history edits, priorities, constraints, unsafe flag | Browser storage |
| Today (or `?date=`) and the climate-scenario switch | UI |

| Output | Used by |
|---|---|
| `nextCrops()` → ranked crops for the next open slot, each with reasons | Card "Sow next" |
| `avoid()` → crops blocked or penalised, with rule, year and source | Card "Avoid" |
| `hazards(crop)` → list of "x of N years" with chart references | Card "Risks", S6, S7 |
| `watchList(crop)` → dated windows and what to look at | Card "Watch", S6 |
| `suggestRotations()` → at least three scored plans with links, bars and the five explanation items | S5 |
| `scorePlan(plan)` → the same scoring for the editable lane | S5 "My plan" |
| `rotationHealth()` → 0–100 for the last five known seasons | Card, map layer |

History classes map onto crops for rule checks: `winter_cereal` counts as a cereal (winter wheat
unless the farmer says barley), `spring_cereal` as spring barley, the other named classes as
themselves. `other` and `unknown` never satisfy a check; they are listed as gaps.

### 6.2 Crop catalogue (`crops.json`), one entry per crop

`id`, names (en, uk), icon, colour, botanical `family`, `type` (winter / spring / cover / fallow),
`sowing` and `harvest` rules (climate-derived, §6.5), heat requirement (base temperature and
growing-degree-day sum), water-demand class, rooting-depth class, `fixesNitrogen`, residue-cover
class, minimum `returnInterval` in years, `hazards[]` (each: id, window relative to the crop
calendar, variable, comparison, threshold, label key), `watch[]` (window, what to check),
`equipment[]`, and a `source` id for every number.

### 6.3 Rule types (`rules.json`)

| Type | Meaning | Example (must be confirmed against a source before shipping) |
|---|---|---|
| Return interval | Minimum years before the same crop returns to the field | Sunflower: at least 7 years (Cabinet of Ministers Resolution No. 164, 2010 — **VERIFY** current wording) |
| Family share | Maximum share of one family in the last five seasons | Cereals after cereals |
| Predecessor matrix | Effect of crop A on the following crop B, from −2 to +2, with a reason code | Legume → cereal: +2, nitrogen |
| Shared host | Crops that carry the same disease should not be neighbours | Sunflower, soybean, rapeseed: white mould |
| Calendar feasibility | The predecessor's harvest must leave time before the next sowing window | Late maize harvest → winter wheat window missed; computed from the cell's calendar, not hard-coded |
| Climate-conditioned modifier | A rule's weight depends on this cell's climate | "Dry soil after sunflower" doubles where autumns are dry in most years |

### 6.4 Combos and anti-combos (initial set)

| Id | Sequence | Label on the link | Sign |
|---|---|---|---|
| `N_BONUS` | Soybean / peas / chickpea → cereal | Nitrogen bonus | + |
| `BREAK_CROP` | Rapeseed → winter wheat | Disease break, early harvest | + |
| `CLASSIC_BEET` | Winter cereal → sugar beet | Classic predecessor | + |
| `FALLOW_MOISTURE` | Fallow → winter wheat | Stored moisture | + |
| `COVER_SHIELD` | Cover crop between harvest and a spring crop | Soil covered, less erosion | + |
| `DIVERSITY_3` | Three or more families within four seasons | Diversity | + |
| `CEREAL_REPEAT` | Wheat or barley → wheat or barley | Root rots, pests | − |
| `FUSARIUM` | Grain maize → wheat | Fusarium risk, late sowing | − |
| `EARLY_RETURN` | Any crop back before its return interval | Returned too soon | − |
| `WHITE_MOLD` | Sunflower ↔ soybean ↔ rapeseed as neighbours | Shared disease | − |
| `DRY_PROFILE` | Sunflower / sugar beet → any crop, in a dry-autumn climate | Dry soil left behind | − |
| `LATE_HARVEST` | A late-harvested crop → a winter crop | Sowing window missed | − |

Each combo ships only with a source id. N reviews the whole table in task 2.7.

### 6.5 Climate indicators, calendars and hazards

Per climate cell and per year, stored as 36 dekadal values: rain, reference evapotranspiration,
days with maximum temperature ≥ 30 °C and ≥ 35 °C, minimum temperature, soil wetness; plus yearly
growing degree days (base 5 and 10 °C), last spring frost and first autumn frost day, heavy-rain days.

- **Calendars are derived from the climate, not from a zone table.** For example, a spring crop's
  sowing window opens when the smoothed temperature passes that crop's threshold; a winter crop's
  window is set by the autumn temperature decline. This is what lets the same engine work in another
  region of the temperate Northern Hemisphere. Thresholds come from sources (§6.9).
- **Hazard** = a condition inside a crop's critical window, evaluated for every year, reported as
  "x of N years" for the selected scenario (all years / last 10 / driest third) and compared with
  the previous period to show the shift.
- **Bare-soil calendar** comes from the field's own greenness curves: months with greenness below
  a threshold. Combined with slope and heavy-rain frequency it gives erosion exposure.

### 6.6 Scoring

Four bars, each 0–100, per plan:

| Bar | Built from |
|---|---|
| Water | Water-related hazard frequency for each crop, climatic water balance over its season against its demand class, predecessor effect on soil water |
| Heat | Probability that the heat sum is reached before the frost or harvest deadline; heat and frost hazard frequency |
| Soil | Predecessor effects, nitrogen credit, bare days × slope × heavy rain, cover-crop credit, residue class |
| Disease | Return-interval compliance, shared-host neighbours, family share |

Total = weighted mean of the bars (weights from S4; defaults 0.3 / 0.2 / 0.25 / 0.25) plus combo
points, bounded to ±15. A hard violation (return interval, impossible calendar) marks the tile red
and caps that crop-year's Disease or Heat bar at 0. Required test properties: adding a violation
never raises the score; identical inputs give identical outputs; weights of zero remove a bar's influence.

### 6.7 Strategies

- **As now:** find the shortest repeating cycle (2–4 seasons) that matches the last six known
  seasons and continue it; if none, repeat the last three. If history is unknown, use the most
  frequent three-season sequence in our own classified data for that oblast and say so.
- **Balanced:** the highest total among all feasible sequences for the open slots (exhaustive
  search: at most 11³ sequences times cover-crop options, instant).
- **Drought-proof:** the highest Water bar among sequences within 15 % of the best total and
  differing from Balanced in at least two slots.
- **My plan:** whatever the farmer builds, scored the same way.

### 6.8 Date awareness

"Today" is the real date or `?date=`. A crop whose sowing window for this cell has closed is not
offered for that season. If the field's autumn greenness shows an emerged winter crop, the 2027
tile is locked as "winter crop (confirm which)" and planning starts after its harvest. The horizon
is three harvest seasons after the current or locked one.

### 6.9 Explanations, uncertainty and source discipline

- Texts are templates filled with numbers from the data. No generated prose.
- Each strategy's [details] has exactly five blocks: why suggested · evidence (charts) · benefits ·
  information gaps · check locally. "Information gaps" is never empty: it always lists what applies
  (no soil test, district-scale weather, estimated history for years X, no price data).
- A history item below the confidence threshold is shown as "?" and treated as unknown by the rules;
  the plan then says which checks could not be made.
- **No unsourced number ships.** Every threshold and interval in `crops.json` and `rules.json` has a
  `source` id resolving to `docs/REFERENCES.md`. Intended sources: FAO ECOCROP (crop climate
  requirements), FAO Irrigation and Drainage Paper 56 (water demand, critical periods), FAO GAEZ,
  Resolution No. 164, agronomy handbooks. A rule without a source is shown as "local practice,
  unverified" or removed.

---

## 7. Data

### 7.1 Sources

Status: ✅ fact checked in earlier research · ⚠ **VERIFY** at P0.

| # | Dataset | Role | Resolution, years | Access | Status |
|---|---|---|---|---|---|
| 1 | **NASA HLS Vegetation Indices v2.0** (HLSL30_VI, HLSS30_VI) | Greenness curves per field → crop history, current state, bare-soil calendar | 30 m; Landsat from Apr 2013, Sentinel-2 from Dec 2015 | LP DAAC, COG per index, Earthdata token | ✅ exists; ⚠ exact asset list and whether a quality mask ships with it |
| 2 | **NASA POWER** daily | Temperature, rain, radiation, humidity, wind, soil wetness → all climate indicators and trends | 0.5° × 0.625°; 1981 → now | Open API, JSON, no key | ✅; ⚠ request limits, CORS |
| 3 | **GPM IMERG** Final daily | Rain and extremes at finer scale | 0.1°; 2000 → now | GES DISC, Earthdata token, spatial subsetting | ⚠ subsetting route |
| 4 | **SMAP** enhanced L3 or L4 | Soil-moisture anomalies | 9 km; 2015 → now | AppEEARS or Harmony subsetting | ⚠ whether the API accepts a token; otherwise N submits the request in the web UI |
| 5 | **SRTM** (SRTMGL1 / NASADEM) | Slope, erosion exposure, low spots | 30 m | LP DAAC | ⚠ |
| 6 | Fields of The World, global (Taylor Geospatial et al.) | Field polygons | 10 m source; 3.17 B polygons over two years (1.62 B for 2024, 1.55 B for 2025), 241 countries | `data.source.coop/ftw/global-data/`, GeoParquet by country + PMTiles, anonymous, CC-BY-4.0 | ✅; ⚠ Ukraine file paths, id column, CORS |
| 7 | KPI-Ukraine crop maps 2016–2024 (Kussul et al., 2025) | Labels for training and testing in Ukraine | 10 m, 14 crop classes, F1 above 90 % for most classes | ⚠ download location and licence unknown | ⚠ gate G3 |
| 8 | ESA WorldCereal 2021 | Backup labels: cereals, maize | 10 m | Open, CC-BY | ⚠ |
| 9 | USDA NASS Crop Sequence Boundaries 2018–2025 | Independent validation labels (Red River Valley) | Field polygons with 8 years of crops | Public domain; mirror on Source Cooperative | ✅ |
| 10 | ISRIC SoilGrids 2.0 | Texture, organic carbon, pH | 250 m | Open, CC-BY-4.0 | ⚠ access route |
| 11 | Basemap: EOX Sentinel-2 cloudless (ESA Copernicus data) | Satellite imagery under the fields | 10 m | Tile service | ⚠ licence terms (non-commercial edition) and attribution text |
| 12 | GeoNames, Ukraine | Settlement search | — | CC-BY-4.0 | ⚠ |
| 13 | Administrative boundaries of Ukraine | Oblast shading, names | — | ⚠ pick a source whose licence allows reuse and which shows Ukraine's internationally recognised borders | ⚠ |
| 14 | FAO ECOCROP, FAO-56, GAEZ; Resolution No. 164 | Crop requirements and rotation norms | — | Public documents | ⚠ current wording of No. 164 |

Stretch sources, only if L1 is done: ECOSTRESS evapotranspiration and stress index (70 m) for
field-level heat and water stress · GRACE / GRACE-FO water-storage trend · NASA GIBS HLS imagery as a
dated "NASA view" layer · MODIS NDVI for a 25-year regional greenness trend.

Not used and why: the U.S.-only resources on the challenge list (SSURGO, CDL, PRISM, NAIP, NLCD,
OpenET and others) do not cover Ukraine; CSB, which derives from CDL, is used only for validation.

### 7.2 Pipeline stages (`pipeline/lan/`)

| Stage | Module | In → out |
|---|---|---|
| Fields | `fields.py` | FTW Ukraine → `work/fields.parquet`: id, geometry, area, confidence, centroid, oblast, raion, MGRS tile, chunk key, climate cell. Fields under 2 ha kept with flag `small` |
| Greenness | `hls.py` | For one MGRS tile and year: search granules, pick the clearest scene per dekad (March–November), stream the NDVI COG and the mask, zonal mean per field, append to `work/ndvi_obs.parquet`, delete the temporary file |
| Curves | `curves.py` | Observations → dekadal curve per field-year, gap-filled and smoothed; phenology features; bare days; autumn-2026 state |
| Labels | `labels.py` | Per field-year label from Path A or Path B (§7.4) and from CSB for the Red River tiles |
| Classifier | `classify.py` | Train, evaluate on held-out spatial blocks, write `metrics.json` and the confusion matrix, predict history with confidence |
| Climate | `climate.py` | POWER daily for every cell → dekadal indicators per year → `out/climate/{cell}.json` |
| Rain | `precip.py` | IMERG subset → finer rain indicators merged into the climate cells |
| Soil moisture | `smap.py` | SMAP subset → monthly anomalies per cell |
| Terrain | `terrain.py` | SRTM → slope mean and 90th percentile, elevation per field |
| Soil | `soil.py` | SoilGrids → clay, sand, organic carbon, pH per field |
| Export | `export.py` | `out/fields/{ck}.json`, `out/curves/{ck}.json`, `out/tiles/*.pmtiles`, `out/meta.json` |
| Layer scores | `web/scripts/batch-score.ts` | Runs the TypeScript engine in Node over the field chunks → rotation health and last crop written into the tiles |

Zonal statistics use one label raster per tile (fields burned into the tile's 30 m grid, shrunk by
one pixel inward to avoid mixed edges) and `numpy.bincount`, so a scene costs one pass over the array.

### 7.3 The HLS job: budget and gate G2

Estimates, to be replaced by measurements in task 0.5:

| Quantity | Estimate |
|---|---|
| MGRS tiles covering Ukraine | about 75 |
| Scene slots per tile | 27 dekads × 11 seasons = 297 |
| Full Ukraine, 2016–2026 | about 22,000 scenes, 300–450 GB of traffic |
| Cherkasy oblast (about 6 tiles) | about 1,800 scenes |
| Disk held at any moment | under 5 GB (streaming) |
| Traffic allowance | 3 TiB per month: enough |

Rule for G2: measure seconds per scene on one tile-year, compute how many tiles finish by Sun 07:00
with two worker processes, and fix the tile order: Cherkasy oblast first, then rings outward. Tiles
that do not finish get climate-only cards (state E1). Under Path A the job needs only 2025–2026
everywhere plus the training tiles, about 6,000 scenes, so all of Ukraine becomes realistic.

Job safety: every tile-year writes a `.ok` marker and is skipped on restart; a watchdog restarts a
crashed worker; a guard stops the job below 8 GB of free disk; `status.json` holds tiles done, scenes
per hour, ETA and the last error. It runs inside `tmux` on the VPS, so it survives a closed laptop.

### 7.4 Labels: gate G3

| | Path A — KPI maps available and licence allows use | Path B — no local labels |
|---|---|---|
| History 2016–2024 where HLS is processed | Our model on HLS curves (flag `model`) | Our model on HLS curves |
| History 2016–2024 elsewhere | Majority class of the KPI map inside the field (flag `map`) | Not available → state E1 |
| History 2025–2026 | Our model | Our model |
| Training labels | KPI map classes on training tiles | WorldCereal 2021 (cereals, maize) + CSB (USA) + phenology rules |
| Classes | 8 (below) | Robust groups: winter cereal, rapeseed, spring cereal, summer row crop, long-season crop; sunflower asked from the farmer |
| Accuracy claim | Agreement with the KPI map on held-out tiles, plus Red River, plus N's fields | Red River agreement, plus N's fields; stated plainly as weaker |

Classes (Path A): winter cereal · spring cereal · rapeseed · maize · sunflower · soybean · sugar beet · other or fallow.
Wheat and barley are merged because their curves are too alike at 30 m.

### 7.5 Classifier

LightGBM on the 27-dekad greenness curve plus phenology features (green-up dekad, peak dekad and
value, senescence dekad, season length, autumn greenness, area under the curve). Split by spatial
blocks (whole tiles held out), never by random rows. Outputs: class and probability per field-year.
Below the confidence threshold the UI shows "?". Report macro-F1, per-class F1, the confusion matrix
and the number of field-years. A label map that is itself about 90 % accurate makes our figure an
agreement rate, and the README says so.

### 7.6 Data contract v1 (frozen in task 0.6; the web track builds against fixtures from then on)

```ts
type CropId = 'w_wheat' | 'w_barley' | 's_barley' | 'maize' | 'sunflower' | 'soy'
            | 'sugar_beet' | 'w_rape' | 'peas' | 'chickpea' | 'sorghum' | 'fallow' | 'cover';
type HistClass = 'winter_cereal' | 'spring_cereal' | 'rapeseed' | 'maize' | 'sunflower'
               | 'soy' | 'sugar_beet' | 'other' | 'unknown';

interface HistoryItem { y: number; k: HistClass; p: number; src: 'model' | 'map' | 'farmer' }

interface FieldRecord {
  id: string;                 // stable field id
  c: [number, number];        // centroid [lon, lat]
  ha: number;
  adm: { oblast: string; raion: string };
  cell: string;               // climate cell id
  soil: { clay: number; sand: number; soc: number; ph: number } | null;
  terrain: { slope: number; slopeP90: number; elev: number } | null;
  hist: HistoryItem[];        // seasons 2016..2026; may be empty
  now: { state: 'winter_crop' | 'bare' | 'green_cover' | 'unknown'; asOf: string } | null;
  bareDays: number | null;    // mean days per year with greenness < 0.25
  flags: ('small' | 'low_conf' | 'no_history')[];
}
interface FieldChunk { v: 1; ck: string; fields: FieldRecord[] }

// Greenness curves, loaded only when Evidence opens.
// Each curve: base64 of uint8 values, value = round(ndvi * 200), 255 = no data.
interface CurveChunk { v: 1; ck: string; years: number[]; dekads: number[]; curves: Record<string, string> }

interface YearIndicators {
  y: number;
  gdd5: number; gdd10: number;
  lastSpringFrostDoy: number | null; firstAutumnFrostDoy: number | null;
  heavyRainDays: number;
  rain: number[]; et0: number[]; hot30: number[]; hot35: number[]; tmin: number[]; wet: number[]; // 36 dekads each
}
interface ClimateCell {
  v: 1; id: string; lat: number; lon: number;
  years: YearIndicators[];
  smap?: { y: number; anom: number[] }[];   // 12 months
}

interface Meta {
  v: 1; built: string;
  coverage: { historyTiles: string[]; climateOnly: boolean };
  accuracy: { macroF1: number; perClass: Record<string, number>; n: number; labelSource: string } | null;
  sources: { id: string; name: string; version: string; licence: string }[];
}
```

Vector tile feature properties: `id`, `ck` (chunk key), `ha`, `k` (last crop code), `rh` (rotation
health 0–100, −1 unknown), `f` (flag bits). Chunk key: a 0.25° grid cell of the centroid,
`ck = floor((lat + 90) / 0.25) + "_" + floor((lon + 180) / 0.25)`. Climate cell id: the POWER grid
cell, `lat.toFixed(1) + "_" + lon.toFixed(3)`.

### 7.7 What the site ships and where it lives

| Item | Estimated size | Limit |
|---|---|---|
| Vector tiles of fields, one file per oblast | 10–60 MB each, up to about 400 MB in total | 100 MB per file |
| Field chunks (attributes and history), about 1,200 for Ukraine | up to about 300 MB | — |
| Curve chunks (only where HLS is processed) | up to about 150 MB | — |
| Climate cells, about 350 | about 15 MB | — |
| Rules, place index, boundaries | under 5 MB | — |
| **Total data** | **under 900 MB** | **1 GB per Pages site** |

Two repositories, created at P3 with N's yes: `lan` (code; the site is built by GitHub Actions) and
`lan-data` (precomputed data, served by Pages). Both sit under the same `github.io` origin, so the
browser needs no cross-origin setup. The app reads the data location from one build-time variable.
If G1 shows that the browser can read FTW's own hosted tiles and they carry an id, the tiles are not
re-hosted at all.

---

## 8. Architecture and repository layout

```
SpaceXChallenge/
├─ .gitignore                 # first line: .env
├─ .env                       # EARTHDATA_TOKEN — never committed, never printed
├─ README.md                  # method, data, accuracy, limits, SI use, how to run
├─ docs/
│  ├─ PLAN.md                 # this file
│  ├─ DECISIONS.md            # gate results and every fork taken, with the measured numbers
│  ├─ REFERENCES.md           # ledger: every dataset, library, image, text source, with licence
│  ├─ SI_USE.md               # ledger: where and how SI tools were used
│  ├─ LOCAL_KNOWLEDGE.md      # N's notes: typical rotations, real dates, bad seasons (no names, no places)
│  ├─ VALIDATION.md           # classifier metrics, UT1–UT5 results, climate sanity checks
│  ├─ BUGS.md                 # tester findings, triaged
│  ├─ SUBMISSION.md           # final text of every form field
│  └─ video/                  # script.md, subtitles.srt
├─ pipeline/                  # uv project, Python 3.12
│  ├─ pyproject.toml
│  ├─ lan/                    # config.py fields.py hls.py curves.py labels.py classify.py
│  │                          # climate.py precip.py smap.py terrain.py soil.py export.py
│  ├─ jobs/                   # run_tile.py run_all.sh watchdog.sh
│  └─ tests/
├─ web/                       # Vite + React + TypeScript
│  ├─ src/engine/             # types.ts calendar.ts hazards.ts precursors.ts combos.ts
│  │                          # score.ts strategies.ts watch.ts explain.ts  (+ *.test.ts)
│  ├─ src/data/               # loader.ts (chunks, curves, climate, cache)
│  ├─ src/map/                # MapView.tsx layers.ts search.ts
│  ├─ src/screens/            # Intro FieldCard HistoryEditor Priorities Compare
│  │                          # CropDetail Evidence About DemoTour
│  ├─ src/state/store.ts      # selection, overrides, priorities, language, date
│  ├─ src/i18n/               # en.ts uk.ts
│  ├─ scripts/batch-score.ts
│  └─ public/                 # rules/crops.json rules/rules.json fixtures/
├─ data/                      # git-ignored: raw/ work/ out/
└─ logo/                      # existing
```

| Machine | Does |
|---|---|
| Laptop | Web app, engine, tests, documents, video, git |
| VPS | All heavy downloads and processing, inside its own project folder, under `tmux`; nothing else on the server is touched |
| GitHub Pages | Serves the site and the data to judges |
| Google Drive | Optional backup of results on Sunday evening |

Working conventions:

- Commit after every task with a short English message (`feat:`, `fix:`, `data:`, `docs:`).
- Tests where they pay: the engine is written test-first (the rules are the product); pipeline pure
  functions get pytest cases on synthetic rasters; the UI is checked by C in a real browser with
  screenshots, then by T on devices.
- Ledgers are updated in the same commit that introduces the thing: a new dataset or library adds a
  line to `REFERENCES.md`; any SI-produced asset adds a line to `SI_USE.md`.
- SI acknowledgement in metadata (rule C6): a "SI use" section in the README, a note in
  `pyproject.toml` and `package.json` descriptions, an "About → SI use" section in the app.
- After every phase: update §0, write the gate results to `DECISIONS.md`, report to N.

---

## 9. Master schedule

39 hours of wall clock: Sat 09:00 → Sun 23:59. Machines work non-stop; people sleep 02:00–08:00.
If people choose to stay up, the extra hours go to polish, never to new scope.

| When | C (Claude) | N (Nazarii) | T (teammate) |
|---|---|---|---|
| **Sat 09:00–10:30 · P0** | Repo, environments on laptop and VPS, source probes, HLS throughput test, data contract and fixtures | Give the approval bundle (§15). Confirm team and event status. Open the Project page and press "Save Progress" with the project name | Install OBS and a video editor. List the test devices |
| **10:30–14:00 · P1** | VPS: fields, climate, HLS for the Cherkasy tiles. Laptop: app shell, map, card on fixtures, engine calendar and rules | 11:00–12:00: dictate the local-knowledge sheet (typical rotations, real sowing and harvest dates, bad seasons with year and crop) | — |
| **14:00–18:00 · P2** | Curves, labels, classifier, history; engine scoring, strategies, hazards, watch list; card on real data | 16:00–16:40: review the rules table (task 2.7) | — |
| **18:00–22:00 · P3** | Compare screen, evidence charts, editors, date awareness, first deploy (target 21:30) | About 21:00: approve repositories and push. Check the live link on a phone. Save a draft of the project page | — |
| **22:00–02:00 · P4** | Start the night run, map layers, search, About, mobile pass, intro and demo tour | 22:00: approve the night run. Dictate the story facts for the summary. About 00:30: insurance recording. Sleep by 01:00 | 22:00–23:00: first test pass on the live link, then sleep |
| **Sun 02:00–08:00 · Night** | VPS processes the remaining tiles. Optional local-only night tasks (§10) | Sleep | Sleep |
| **08:00–11:00 · P5** | Ingest night results, rebuild, redeploy, Red River metrics, fix bugs as they arrive | 08:30–10:30: UT1–UT3 on known fields | 09:00–11:00: UT4–UT5 and the device matrix |
| **11:00–15:00 · P6** | Must-fix bugs, rule corrections, states E1–E7, performance, text drafts | 12:00: insurance submission. Pick the showcase field. Review texts | Retest fixes. Prepare the video project (titles, subtitle style) |
| **15:00–18:30 · P7** | Script and subtitles, page images and GIF, README, final form texts, duration checks | Screen takes, voice, upload, final edits of texts | Edit the video |
| **18:30–20:30 · P8** | Verify every link in a private window | Fill the form, tick both boxes, press "Submit for Judging" | Check the links from another device and network |
| **20:30–23:00 · P9** | Critical fixes only, wrap-up | Resubmit after any change. Final freeze 23:00 | — |

Time budget: building 21 h · validation 3 h · presentation 3.5 h · submission 2 h · buffer 3.5 h · sleep 6 h.

### Scope ladder

| Level | Must be true by | Content |
|---|---|---|
| **L0** | Sat 22:00 | At least one processed tile in Cherkasy oblast with real history and climate; the card; three lanes with combos; a live link |
| **L1** | Sun 11:00 | All of Cherkasy oblast; measured accuracy; evidence charts; history editor; priorities; both languages; phone layout; About; demo tour |
| **L2** | Sun 14:00 | Every oblast the night run finished; map layers; search across Ukraine; climate-only cards elsewhere |
| **L3 (stretch)** | Started only if L2 is done by Sun 12:00 | Climate-only cards anywhere in the world through the live POWER API; Red River view; dated NASA imagery layer; ECOSTRESS; GRACE; print and share; a variety or hybrid note per season |

### Cut rules

- At every checkpoint compare the clock with this table. More than 60 minutes behind → apply the next cut at once and write it to `DECISIONS.md`.
- CP1 late → the deep zone shrinks to one tile; soil data moves to P5.
- CP2 late → history comes from the label-map majority (Path A) or robust groups (Path B); "My plan" editing moves to P5.
- CP3 late → deploy what works at 23:00; evidence shrinks to three charts (greenness, rain, hot days).
- **Sun 14:00: feature freeze. Sun 15:00: demo freeze (tag `demo`).** Both are absolute.
- The presentation block never shrinks below 3 hours.

---

## 10. Phases and tasks

Each task: files → steps → verification. A phase is done when its checkpoint (CP) holds.

### P0 — Bootstrap and gates (Sat 09:00–10:30)

**0.1 Repository**
- [ ] `git init` inside `SpaceXChallenge`. The parent folder belongs to an unrelated repository; nothing is ever committed there.
- [ ] `.gitignore`: `.env`, `data/`, `node_modules/`, `.venv/`, `dist/`, `*.pmtiles`, `__pycache__/`, and `logo/*` except `logo/final-v3/` and `logo/build_logo.py`.
- [ ] Verify: `git check-ignore -v .env` prints the rule; `git status --short` does not list `.env`.
- [ ] Create the ledgers `docs/DECISIONS.md`, `REFERENCES.md`, `SI_USE.md`. Commit `chore: init repo`.

**0.2 Laptop environment**
- [ ] `pipeline/`: uv project pinned to Python 3.12 with the packages from the header. Verify: `uv run pytest` passes one sample test.
- [ ] `web/`: Vite React TypeScript template plus tailwind, shadcn/ui, maplibre-gl, pmtiles, zustand, recharts, vitest. Verify: `npm run dev` serves a page; `npm test` passes one sample test.
- [ ] **G4:** one HTTPS GET to the POWER API from Python and one from Node on the laptop. Record success or the error.

**0.3 VPS environment**
- [ ] Connect; record disk, memory, cores, OS version. Create the project folder. Install uv, tmux, build tools and tippecanoe.
- [ ] Copy `.env`, set mode 600.
- [ ] Verify: an Earthdata login test prints only `True`.

**0.4 Source probes** — every answer is written to `DECISIONS.md` with the measured value.
- [ ] HLS VI: search one tile for one month; list the assets (is NDVI there for both sensors? is there a quality mask?); note file sizes.
- [ ] FTW: find the Ukraine GeoParquet and PMTiles; list columns (id, confidence, area); count polygons in Ukraine and in the Cherkasy bounding box; test Range and CORS headers. → **G1**
- [ ] KPI crop maps: where they can be downloaded, in what format, under what licence. → **G3**
- [ ] POWER: one daily point request for 1981–2026 with all needed parameters; time it; check the CORS header and the fill value.
- [ ] CSB: read a Red River subset; list columns and crop codes.
- [ ] SoilGrids, SRTM, GeoNames, administrative boundaries, basemap: working URL and licence line for each.
- [ ] Resolution No. 164: read the current wording; record the return intervals it actually gives.
- [ ] Participant Terms and Conditions (not read so far): read them; record anything that restricts data, media, SI use or the licence of submitted code. Choose the code licence accordingly (decision O10).

**0.5 Throughput test** (files: `pipeline/lan/hls.py`, `pipeline/jobs/run_tile.py`)
- [ ] Process one MGRS tile for the 2025 season end to end. Record scenes per hour, megabytes per scene, peak memory.
- [ ] Extrapolate with §7.3 and fix the tile order and scene density. → **G2**

**0.6 Contract freeze** (files: `web/src/engine/types.ts`, `web/public/fixtures/`, `web/public/rules/`)
- [ ] Write the §7.6 types.
- [ ] Hand-make three fixture fields: A "sunflower returned too soon", B "healthy rotation", C "no history"; and one climate cell.
- [ ] Create `crops.json` and `rules.json` with all ids from §6; every number carries a `source` or is marked unsourced.
- [ ] Verify: a vitest test loads every fixture and type-checks it.

**0.7 Asynchronous orders**
- [ ] Request the SMAP subset for Ukraine. If the service needs a password instead of a token, N submits it in the web UI.

**0.8 People**
- [ ] N: confirms both members are on the same event and not waitlisted, that Field Shift is selected, and who the Team Owner is.
- [ ] N: opens the Project page, enters the project name, presses "Save Progress".
- [ ] T: OBS records a 10-second test clip; the editor opens it.

**CP0 (10:30):** G1–G4 are filled in §0; fixtures load; the VPS can read HLS.

### P1 — Data foundation and app shell (Sat 10:30–14:00)

Data track (VPS):

**1.1 Fields** (`pipeline/lan/fields.py`, `tests/test_fields.py`)
- [ ] Build `work/fields.parquet` for Ukraine as in §7.2.
- [ ] Tests: `test_small_fields_get_flag` (a 1.5 ha polygon gets `small`), `test_chunk_key_formula` (lat 49.44, lon 32.06 → `557_848`), `test_ids_unique`.
- [ ] Verify: print counts per oblast; plot 200 polygons of one chunk over the basemap and look at it.

**1.2 Climate** (`pipeline/lan/climate.py`, `tests/test_climate.py`)
- [ ] Fetch POWER daily series for every cell over Ukraine; compute the §7.6 indicators.
- [ ] Tests: `test_fill_value_becomes_nan` (−999 → NaN), `test_gdd_on_known_series`, `test_frost_dates_on_known_series`, `test_dekad_sums_equal_month_sum`.
- [ ] Verify against published climate normals for Cherkasy (mean July temperature, annual precipitation); write both pairs of numbers to `VALIDATION.md`.

**1.3 Greenness** (`pipeline/lan/hls.py`, `jobs/run_all.sh`, `jobs/watchdog.sh`, `tests/test_hls.py`)
- [ ] Tests: `test_zonal_mean_on_synthetic_raster` (three fields with known means), `test_masked_pixels_are_excluded`, `test_clearest_scene_per_dekad_is_chosen`, `test_done_marker_skips_tile_year`.
- [ ] Start the Cherkasy tiles, 2016–2026, in tmux. Verify: `status.json` advances; spot-check one field's values against the HLS scene viewed directly.

**1.4 Terrain and soil** (`terrain.py`, `soil.py`): slope and soil values for the deep zone. Verify: values lie in plausible ranges; a known steep valley shows a higher slope than a plateau field.

**1.5 Export v0** (`export.py`): chunks and tiles for the deep zone, copied to the laptop's `data/out`. Verify: a chunk validates against the §7.6 types.

Web track (laptop, in parallel, on fixtures):

**1.6 App shell** (`web/src/App.tsx`, `state/store.ts`, `i18n/`): routes of §5.2, language switch, date chip. Test: `test_every_en_key_exists_in_uk`.

**1.7 Map** (`map/MapView.tsx`, `map/layers.ts`): basemap with attribution, field tiles, zoom gate, hover, tap → selection and URL. Verify in a real browser at 1440 px and 390 px, with screenshots.

**1.8 Field card on fixtures** (`screens/FieldCard.tsx`): the layout of §5.3 for fixtures A, B and C.

**1.9 Engine core, test-first** (`engine/calendar.ts`, `precursors.ts`, `combos.ts`)
- [ ] `test_early_return_is_a_violation`: sunflower in 2024, proposed for 2027 → violation `EARLY_RETURN` with the year it becomes allowed.
- [ ] `test_nitrogen_bonus`: soy → winter wheat produces `N_BONUS`.
- [ ] `test_late_harvest_blocks_winter_crop`: maize → winter wheat is flagged when the cell's maize harvest ends after the wheat sowing window.
- [ ] `test_unknown_year_is_not_a_pass`: a "?" season makes the interval check report "could not check".
- [ ] `test_closed_window_not_offered`: on 2026-11-14 a winter crop is not offered for the 2027 season.
- [ ] `test_emerged_winter_crop_locks_first_slot`.
- [ ] Verify: `npm test` green.

**1.10 Local knowledge (N, 11:00–12:00)** (`docs/LOCAL_KNOWLEDGE.md`): N dictates in chat, C writes it down in English: rotations actually used nearby, real sowing and harvest dates per crop, bad seasons as year + crop + what happened. It feeds the rules review (2.7) and UT3. No names of people, farms or villages go into the file.

**CP1 (14:00):** tapping a real field in Cherkasy oblast opens a card with its real area, soil and slope (history still from fixtures); the HLS job is running.

### P2 — Engine and history (Sat 14:00–18:00)

**2.1 Curves** (`curves.py`): dekadal curves, features, bare days, autumn state. Tests: `test_gap_longer_than_four_dekads_stays_missing`, `test_bare_days_on_known_curve`, `test_autumn_state_rules`.

**2.2 Labels** (`labels.py`): per the path chosen at G3. Verify: class counts per tile; 20 random labelled curves plotted and inspected.

**2.3 Classifier** (`classify.py`): train and evaluate. Test: `test_train_and_test_tiles_are_disjoint`. Verify: `metrics.json` and the confusion matrix exist; numbers copied to `VALIDATION.md`.

**2.4 History**: predict all processed field-years with probabilities; re-export chunks. Verify: fixture-like field A's story exists in real data (find three real showcase candidates).

**2.5 Engine scoring** (`hazards.ts`, `score.ts`, `strategies.ts`, `watch.ts`, `explain.ts`)
- [ ] `test_hazard_frequency_counts_years` on a hand-made cell.
- [ ] `test_adding_a_violation_never_raises_the_score`.
- [ ] `test_three_strategies_always_returned_and_distinct`.
- [ ] `test_sparse_history_year_shows_gap_in_explanation` (review focus 1).
- [ ] `test_scenario_switch_changes_frequencies`.
- [ ] `test_information_gaps_never_empty`.

**2.6 Card on real data**: history strip, current state, sow / avoid / risks / watch from the engine.

**2.7 Rules review with N (16:00, 40 min)**: C shows the predecessor matrix, intervals and combos as tables in chat; N marks what is wrong or missing for local practice; C corrects and attaches sources. Verify: no unsourced rule remains unmarked.

**CP2 (18:00):** for a processed field the whole card is real. This is the core of the product.

### P3 — Compare, evidence, first deploy (Sat 18:00–22:00)

**3.1 Compare screen** (`screens/Compare.tsx`): lanes, month-scale tiles, links, bars, [details] with the five blocks.
**3.2 My plan**: slot picker with instant re-scoring; disabled picks show the reason.
**3.3 Evidence** (`screens/Evidence.tsx`): the charts of §5.7, each with caption, source and resolution note.
**3.4 Editors** (`HistoryEditor.tsx`, `Priorities.tsx`, unsafe flag). Tests: `test_overrides_persist_and_recalculate`, `test_storage_unavailable_does_not_crash` (review focus 5).
**3.5 Date parameter and climate-scenario switch.**
**3.6 Deploy** — needs N's yes (§15): create `lan` and `lan-data`, push, enable Pages.
- [ ] Verify the live URL in a private window and on a phone over mobile data.
- [ ] **G5:** request a byte range of a tiles file from Pages; confirm a partial response and that the map draws. If not: export a tile directory for the deep zone instead.
**3.7** N: saves the project-page draft; optionally files the FortiGuard web-filter classification for the site URL.
**3.8** T (22:00–23:00): first pass on the live link → `docs/BUGS.md`.

**CP3 (22:00) = L0:** a stranger with the link can tap the demo field on a phone and compare three rotations.

### P4 — Expansion and polish I (Sat 22:00–02:00)

**4.1 Night run** — needs N's yes: all remaining tiles in the G2 order, in tmux, with watchdog and `status.json`. Verify at 23:00 and 01:30 that it advances.
**4.2 Layers**: last crop, drought risk, rotation health (`web/scripts/batch-score.ts`); oblast shading at low zoom.
**4.3 Search and locate** (`map/search.ts`): settlement index in both languages. Test: `test_search_finds_cyrillic_and_latin`.
**4.4 About page**: all sections of §5.8; accuracy numbers read from `meta.json`.
**4.5 Phone pass** at 360 × 740 and 390 × 844: bottom sheet heights, lane scrolling, tap targets of at least 44 px.
**4.6 Intro and demo tour.**
**4.7 Insurance recording** (N with OBS, 5 minutes, around 00:30): a raw screen capture of at most 30 s of the working flow, kept locally in case Sunday goes wrong.

**CP4 (02:00):** the night run is healthy; the site is deployed; people sleep.

**Night (02:00–08:00).** The VPS job runs unattended. If N leaves a goal, C may do local-only tasks:
more engine edge-case tests, the README skeleton, the i18n completeness check, the Red River tiles
queued after the Ukrainian ones. No pushes, no installs, nothing outward.

### P5 — Ingest and human validation (Sun 08:00–11:00)

**5.1 Ingest**: pull the night results, predict, export, batch-score, deploy data (N's yes). Write the real coverage to `meta.json`. Verify: a field in a newly processed oblast opens with history.
**5.2 N: UT1–UT3** with the history editor and "Export my corrections" → numbers into `VALIDATION.md`.
**5.3 T: UT4–UT5 and the device matrix** (Android Chrome, iPhone Safari if available, desktop Chrome and Firefox) → `BUGS.md`.
**5.4 Red River validation**: metrics on the held-out county → `VALIDATION.md`.
**5.5 Triage**: every bug is must / should / won't. Only "must" enters P6.

**CP5 (11:00) = L1.**

### P6 — Fix and freeze (Sun 11:00–15:00)

**6.1** Must-fix bugs. **6.2** Rule corrections from UT2.
**6.3** Walk through states E1–E7 one by one in the browser; screenshot each (review focus 2 and 4).
**6.4** Performance on a throttled connection: record first-load time and tap-to-card time; target under 3 s and under 1 s.
**6.5 12:00 — insurance submission (N):** upload the insurance recording (public or unlisted), fill every required field with the current drafts, press "Submit for Judging". From this moment the team is eligible whatever happens later.
**6.6** Pick three showcase fields; wire them into the demo tour.
**6.7** 14:00 feature freeze. 15:00 tag `demo`.

**CP6 (15:00) = L2.**

### P7 — Presentation (Sun 15:00–18:30) — see §12 for content

| Time | Task | Owner |
|---|---|---|
| 15:00–15:30 | Final script and `subtitles.srt` | N + C |
| 15:30–16:15 | Three screen takes in OBS, 1920 × 1080, clean browser window, tiles pre-loaded | N or T |
| 16:15–16:40 | Voice recording | N |
| 16:40–17:30 | Edit to at most 29 s, burn in subtitles, export MP4 | T (fallback: C with ffmpeg) |
| 17:30–17:45 | Check duration with `ffprobe`; upload; open the link in a private window and on a phone | N + C |
| 15:00–17:00 | Page images: four screenshots and one GIF under 10 MB | C |
| 15:00–18:00 | README final; `SUBMISSION.md` with all form texts | C drafts, N edits |
| 18:00–18:30 | Read everything once as a judge who knows nothing | N + T |

**CP7 (18:30):** video link, site link and all texts exist and open without login.

### P8 — Submit (Sun 18:30–20:30)

Checklist in §12.6. **CP8:** the confirmation banner was seen and a screenshot of it is saved.

### P9 — Buffer and wrap (Sun 20:30–23:00)

- [ ] Critical fixes only. Any change to the page → "Submit for Judging" again.
- [ ] 23:00 final freeze; tag `submission`. Nothing is touched after 23:30.
- [ ] Backup of results (Drive, if N agrees). Update the project memory and the brain note.
- [ ] After the deadline: the site and both repositories stay public and unchanged until the end of January 2027.

---

## 11. Validation plan

| # | What | How | Reported as |
|---|---|---|---|
| V1 | Crop-history model in Ukraine | Whole tiles held out from training; compare with the label source | Macro-F1, per-class F1, confusion matrix, number of field-years; described as agreement with the label map |
| V2 | The same method where official field records exist | Red River Valley: train on some counties, test on a held-out county against CSB | Same metrics |
| V3 | True ground truth, small sample | UT1: N's known fields | Hits / total, with the number of fields |
| V4 | Climate indicators | Compare with published normals for one city | Two pairs of numbers |
| V5 | Risk flags against memory | UT3 | Hits and misses, listed |
| V6 | Rule engine | Unit tests of §10 | Test count, all green |
| V7 | Usability | UT4, UT5, device matrix | Pass / fail, time in seconds |

Every number is published with its sample size and its weakness. A failed test is reported as
failed, with what we would do next.

---

## 12. Presentation and submission

### 12.1 Video, at most 30 s (target 28–29 s)

Draft script, following the guide's timing. N rewrites it in his own words; the wording below only
fixes the length (74 words, about 2.6 words per second).

| Time | Voice | On screen |
|---|---|---|
| 0:00–0:03 | "We're Lan — a two-person team from rural Ukraine." | Team name, a real field from the map |
| 0:03–0:07 | "Field Shift: the climate now changes faster than a farmer's memory." | "Then and now" chart for one cell |
| 0:07–0:10 | "Lan: tap a field, see its past, plan its future." | Title and tagline |
| 0:10–0:21 | "NASA's HLS imagery shows what grew here for eleven seasons. Forty years of NASA climate data show the real risks. Then compare rotations — good sequences score combos." | Tap a field → history strip → risk line → Compare screen, a combo link lighting up |
| 0:21–0:28 | "More than a billion fields are already mapped. Each of them can get a second opinion from space." | Zoom out from the field to the country to the globe |

Rules for the video: at most 30.0 s, checked with `ffprobe` (aim for 29.0) · English subtitles
burned in, even if the voice is English · no person under 18 · no NASA logo · the team logo only
with a visible "SI-assisted" mark · no copyrighted music (none, or a CC0 track listed in References)
· real product footage, no mock-ups · published as public or unlisted (never private), with a copy
on Drive shared as "anyone with the link".

### 12.2 Project page fields

| Field | Content | Draft by |
|---|---|---|
| Project Name | Product name (decision O1) | N |
| High-Level Project Summary | What we built, how it answers the challenge, why it matters — three short paragraphs with two measured numbers | C → N |
| Link to Project Demo | The video | N |
| Link to Final Project | The live site; the repository is linked from the site and from the description | N |
| Detailed Project Description | What it does (the card, the comparison) · how it works (data → curves → history → rules → score) · validation numbers and failures · benefits and who it is for · limits · what comes next · tools and languages · screenshots and the GIF | C → N |
| Use of SI | From `docs/SI_USE.md` (§12.5) | C → N |
| NASA Data | Each dataset: product name and version, what it drives in the product, link | C |
| Space Agency Partner Data and Other References | From `docs/REFERENCES.md`: ESA-based products first, then every other dataset, library, font, icon and document, with licence | C |

Statements about other farm apps go in only if checked against their own sites during P7; otherwise
they are left out.

Measured numbers to insert (never invented): fields covered and total area · seasons reconstructed ·
classifier macro-F1 with sample size · UT1 hits/total · years of climate record · number of NASA
datasets in the core · number of sourced rotation rules · UT5 time.

### 12.3 Images for the page

Four screenshots (map with a layer, field card, comparison with combos, evidence chart) and one GIF
under 10 MB (tap → card → comparison). English UI, demo field, no personal data on screen.

### 12.4 README

What it is and a screenshot · live link and video link · how it works (one diagram) · data table
with licences · how different resolutions are brought together (30 m imagery → one value per field;
9–50 km grids → one climate cell; every claim labelled with its scale) · method and validation,
including what failed · limits · run it yourself (pipeline
and web) · SI use · team · licence of our code.

### 12.5 SI statement (truthful skeleton)

- The solution idea came from the team; see the provenance table in §3.
- An SI coding assistant (Claude, through Claude Code) was used for research on data sources, for
  planning support, for writing code of the pipeline and the web app, and for drafting English texts,
  which the team reviewed and edited.
- A planning discussion with the assistant and this plan document were produced during the night
  before the start; code and data work began at 09:00 on 14 Nov.
- The logo is based on an image generated with Gemini, redrawn as vector by code, and carries a
  visible "SI-assisted" mark.
- The product itself contains one machine-learning model (a gradient-boosted crop-type classifier)
  trained by us on open labels; its accuracy is reported. Recommendations are produced by
  transparent rules, not by a language model.

### 12.6 Submission checklist (P8)

- [ ] Both members appear on the Members tab; same event; nobody waitlisted.
- [ ] Every required field is filled, in English.
- [ ] Demo link: opens in a private window and on a phone without login; duration at most 30 s.
- [ ] Final project link: opens in a private window and on a phone; the demo field works.
- [ ] NASA Data lists at least the five core datasets. References list everything in `REFERENCES.md`.
- [ ] SI field filled from §12.5. Watermarks present where SI imagery appears.
- [ ] No person under 18 anywhere. No NASA branding.
- [ ] "Terms and Conditions" and "Confirm All Work is Original" ticked.
- [ ] "Submit for Judging" pressed; confirmation banner seen; screenshot saved.
- [ ] After any later edit: submit again.

---

## 13. Risks

| # | Risk | Early signal | Response |
|---|---|---|---|
| R1 | No usable crop labels for Ukraine | G3 at P0 | Path B; accuracy claim rests on Red River and N's fields; say so |
| R2 | HLS is slow or throttled | Task 0.5 | Fewer tiles, one scene per dekad, Path A reduces the job; deep zone shrinks before features do |
| R3 | FTW polygons merge or split real fields | Looking at task 1.1's plot | Show the confidence; choose a showcase area with clean polygons; state it as a limit |
| R4 | Pages does not serve byte ranges | G5 | Tile directory for the deep zone, or FTW's hosted tiles |
| R5 | Data exceeds the Pages limit | Sizes in task 1.5 | Per-oblast files, fewer attributes, curves only in the deep zone |
| R6 | Laptop TLS problem blocks installs or fetches | G4 | Fetch through the VPS; fixing the certificate store is a system change and needs N's decision |
| R7 | C loses context mid-work | Compaction | §0, `DECISIONS.md` and this plan are the source of truth; each session starts by reading them |
| R8 | Night run dies | `status.json` stops | Watchdog and done-markers; the morning uses whatever finished |
| R9 | Rules are naive or wrong | Task 2.7, UT2 | N's review, sources, visible "check locally" |
| R10 | Video over 30 s or link not public | `ffprobe`, private window | Hard check in P7; insurance recording from P4 |
| R11 | Submission site overloaded near the deadline | — | Insurance submission at Sun 12:00; final at 20:00 |
| R12 | Scope creep | Checkpoints slip | Cut rules; absolute freezes |
| R13 | A rule of the hackathon is missed (SI disclosure, watermark, references, language) | — | Ledgers from the first commit; checklist §12.6 |
| R14 | VPS disk fills | `df` | Streaming, temp cleanup, 8 GB guard |
| R15 | Earthdata token rejected | Task 0.3 | N issues a new token |
| R16 | Power or internet outage at home | — | Compute lives on the VPS; push often after the first approval; phone hotspot; devices and power banks charged; page text saved early |
| R17 | Fatigue | Mistakes, slow reviews | The sleep block is part of the plan; N's tasks are short and scheduled |

---

## 14. Personal checklists

**N (Nazarii)**

| When | Task |
|---|---|
| Before 09:00 | Rest. Charge laptop, phone, power bank. Brief T on the schedule |
| Sat 09:00 | Approval bundle (§15). Team and event check. Project page: name, "Save Progress" |
| Sat 11:00 | Local-knowledge sheet (1 h, by voice or text in chat) |
| Sat 16:00 | Rules review (40 min) |
| Sat ~21:00 | Approve repositories and push; check the live link on the phone |
| Sat 22:00 | Approve the night run; story facts for the summary; insurance recording about 00:30; sleep by 01:00 |
| Sun 08:30 | UT1–UT3 (2 h) |
| Sun 12:00 | Insurance submission |
| Sun 15:00–18:00 | Takes, voice, upload, text edits |
| Sun 18:30–20:30 | Final submission |

**T (teammate)**

| When | Task |
|---|---|
| Sat morning | OBS and editor ready; devices listed |
| Sat 22:00 | First test pass on the live link (1 h) |
| Sun 09:00 | UT4–UT5 and device matrix (2 h) |
| Sun 11:00–15:00 | Retest fixes; prepare the video project |
| Sun 16:40 | Edit the video (50 min) |
| Sun 18:30 | Check all links from another device and network |

**How T reports a bug:** device and browser · what was tapped · what was expected · what happened · screenshot.

---

## 15. Approvals and open decisions

### One approval at 09:00 ("го") covers

1. `git init` and local commits in the project folder.
2. Laptop installs: Python 3.12 through uv with the pipeline packages; the npm packages of the web app.
3. VPS: connecting, creating one project folder, installing uv, tmux, build tools, tippecanoe and the Python packages. Nothing existing on the server is removed.
4. Copying `.env` to the VPS (never printed).
5. Downloads on the VPS from the sources in §7.1: up to about 450 GB of traffic, under 20 GB kept on disk.
6. Daytime background jobs on the VPS in tmux, with visible progress.

### Separate explicit yes, each time it comes up

| Action | When |
|---|---|
| Creating the public repositories `lan` and `lan-data`, the first push, enabling Pages | P3 |
| Later pushes — N may grant "pushes to these two repositories until the deadline" once | P3 |
| The unattended night run | Sat 22:00 |
| FortiGuard classification form | P3, optional |
| Backup to Google Drive with rclone | P9, optional |
| Parallel sub-agents for independent tracks | Any time, optional |
| Uploading the video, pressing "Submit for Judging" | N does these himself |

### Open decisions for N (defaults apply if nothing is said)

| # | Question | Default |
|---|---|---|
| O1 | Product name and tagline | "Lan" · "Tap a field. See its past. Plan its future." |
| O2 | Which event the team is on and who the Team Owner is (this fixes the deadline's time zone) | Must be confirmed, no default |
| O3 | Bilingual UI, English by default (D19) | Yes |
| O4 | Voice of the video | Ukrainian with English subtitles |
| O5 | Team logo inside the product and video, with the "SI-assisted" mark | Yes, small |
| O6 | Allow parallel sub-agents | No |
| O7 | Drive backup on Sunday evening | Yes |
| O8 | Publish this plan in the public repository | Yes; it states when it was drafted |
| O9 | Earlier pending deletion of `logo/logo-drafts.png`, `logo/wheat-drafts.png`, `logo/final-v2/` | Not part of this plan; they stay on disk, untracked |
| O10 | Licence of our code | MIT, unless the Terms and Conditions require otherwise (task 0.4) |

---

## 16. Review focus

Conditions the spec implies and a real user will hit. Each has a test or a walkthrough in the task that owns the code.

1. **A cloudy season with too few clear looks** → the year shows "?", never a confident wrong crop; the engine still returns three plans and names the gap. (2.1, 2.5)
2. **A tap outside processed coverage or on a failed download** → a climate-only card or a short message with "Retry"; never a blank panel or an endless spinner. (6.3, states E1, E3, E5)
3. **The date sits inside or after a sowing window** (14–15 Nov, and `?date=`) → nothing is offered whose window has closed; an emerged winter crop locks the first slot. (1.9)
4. **Tiny or sliver polygons** → flagged "too small", no history claims. (1.1, 6.3)
5. **The farmer edits history or priorities** → everything recalculates, survives reload and language switch, and the app still works with storage disabled. (3.4)

---

## Appendix A. Sources

- Challenge: https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/
- Project Submission Guide: https://www.spaceappschallenge.org/resources/project-submission-guide/
- Judging & Awards Guide: https://www.spaceappschallenge.org/resources/judging-awards-guide/
- Participant FAQ: https://www.spaceappschallenge.org/resources/participant-faqs/
- HLS Vegetation Indices: https://www.earthdata.nasa.gov/data/catalog/lpcloud-hlsl30-vi-2.0 · https://www.earthdata.nasa.gov/data/catalog/lpcloud-hlss30-vi-2.0
- NASA POWER: https://power.larc.nasa.gov/
- Fields of The World, global: https://source.coop/ftw/global-data (description: `https://data.source.coop/ftw/global-data/llms.txt`)
- USDA NASS Crop Sequence Boundaries: https://www.nass.usda.gov/research-and-science/crop-sequence-boundaries · mirror https://source.coop/fiboa/us-usda-cropland
- KPI-Ukraine land-use maps 2016–2024: https://ela.kpi.ua/items/826226ca-5746-4d5e-b0b6-a0ff32963799/full · https://publications.jrc.ec.europa.eu/repository/handle/JRC145043
- Resolution No. 164 overview: https://i.factor.ua/ukr/journals/bn/2010/april/issue-15/article-82192.html
- PMTiles: https://docs.protomaps.com/pmtiles/

## Appendix B. Prior agriculture winners (context, not a template)

| Year | Team | What | Lesson |
|---|---|---|---|
| 2024 | NVS-knot (Galactic Impact) | Planting-risk app from soil moisture and evapotranspiration, U.S. Midwest | One concrete farmer question, two datasets at the core |
| 2024 | GaamaRamma (Best Use of Data) | Farm water management | One problem, strong data |
| 2025 | Zumorroda-X (Art & Technology) | Farmer mini-games across countries | Game-like presentation works |

None of them compared multi-year rotations for a specific field. That is this project's ground.
