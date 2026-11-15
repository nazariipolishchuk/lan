# Bugs found on the live link

Task 3.8 (T, first pass) and later passes. One row per bug; C fixes from the top.

| # | Found by, when | Device and browser | Steps | What happened | Expected | Status |
|---|---|---|---|---|---|---|
| 1 | Claude, 15 Nov (scripted pass in headless Chrome) | Phone 390×844 and desktop 1280×800, Chrome | Open the site in a private window, press "Try a demo field" | The demo tour started only from the second button; the dimmed screen was barely visible on the dark map; the map, search and layers were never explained | A short guide that starts from the main button and covers the map first | Fixed 742fc63: new 9-step guide (map → card → comparison) |
| 2 | Claude, 15 Nov | Phone 390×844 | Demo tour, step "What to sow next" | The highlight ring ran out of the card over the map; the hint card covered the search box | Ring only around the visible part; hint card beside it | Fixed 742fc63: spotlight clipped to visible area, card placed by measured size |
| 3 | Claude, 15 Nov | Phone, any | Open the site for the first time and tap the map | The welcome card closed on the stray tap, so the guide was lost | Welcome card stays until Skip, Esc or a button | Fixed 742fc63 |
| 4 | Claude, 15 Nov | Phone 390×844, Ukrainian | Welcome card, footer | The "UK" button was cut off on the right by the long NASA line | Language toggle fully visible | Fixed 742fc63 |
| 5 | Claude, 15 Nov | Phone 390×844 | Field card: risk lines, watch dates, "Mark unsafe"; comparison: climate switch, combo chips, Priorities, Details | Tap targets 21–32 px tall (task 15: hard to hit with a finger) | At least 40 px | Fixed: min-height 40 px on phones |
| 6 | Rostyslav (QA), 15 Nov: `lan-data` branch `test/qa-report`, QA_REPORT.md | Data check script | Scan `fields/*.json.gz` for repeated ids | 285 field ids stored twice with different data (examples `84xnpcmef0`, `84weicme43`) | One record per field | Confirmed, but both copies sat in the same chunk (not in two): a field on an oblast border is stored once per oblast by Fields of The World, so merge glued both; the site showed the first copy. Fixed: `dedupe_fields` in merge plus a `dedupe` step, keeping the copy whose oblast holds the centre. Local data: 285 dropped in 86 chunks, 0 left, 597,389 fields kept. Published to lan-data (`a978eba`); per-oblast counts in `meta.json` recounted after the dedupe (`build_ukraine.py recount`: 597,389 fields, 597,203 with history) |
| 7 | Rostyslav (QA), 15 Nov | Data check script | Fields with history but no `curves/` (116,058) | Feared an empty chart | "No data" message | Not a bug: all 116,058 are fields flagged `small` (< 2 ha), which carry no curves by design. Checked `802mqcqgza` and `8a817c7tdd`: "Why?" says "No greenness curves for this field yet" |
| 8 | Rostyslav (QA), 15 Nov | Data check script | Years missing from a field's history (1,491) | Feared a broken strip | The gap shown as unknown | Not a bug: `81rj8cpqxe` lacks 2022 and its strip shows 2022 as "Not sure" like the other unknown years |
| 9 | Rostyslav (QA), 15 Nov | meta.json | Licences listed in meta.json | GeoNames and geoBoundaries missing | Every source listed | Fixed in `write_meta` and in local meta.json (also added the 2020 Ukrainian crop type map used for crop hints). They were already listed on the About screen. Published to lan-data (`a978eba`) |
| 10 | Rostyslav (QA), 15 Nov | curl / PowerShell | PMTiles on GitHub Pages | "Range requests not supported, the whole 1.7–14 MB file loads" | 16 KB ranges | Not reproduced: in Chrome every PMTiles request on the live site gets `206 Partial Content` with about 16.5 KB (measured 15 Nov). With `Accept-Encoding: gzip` (curl, PowerShell) Pages compresses the range, which is probably what the script saw; browsers do not ask for that on range requests |

### Checked on 15 Nov and found fine (scripted, phone EN + UK, desktop EN)
- All 19 ⓘ notes on the card and the comparison open and stay fully on screen.
- No Latin words left in the Ukrainian card and comparison; no page wider than the screen; no console errors.
- History editor: setting 2026 to sunflower removes sunflower from "Sow next" and re-scores the rest at once.
- "Why?" draws its charts (16 on the demo field).

### Known limits from the QA report (not bugs)
- `.json.gz` is served without `Content-Encoding`; the loader unpacks it itself (by design, see loader.ts).
- The site reads the 16 KB header of every region's PMTiles on first load (about 0.5 MB in all); tiles themselves load per view.
