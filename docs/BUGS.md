# Bugs found on the live link

Task 3.8 (T, first pass) and later passes. One row per bug; C fixes from the top.

| # | Found by, when | Device and browser | Steps | What happened | Expected | Status |
|---|---|---|---|---|---|---|
| 1 | Claude, 15 Nov (scripted pass in headless Chrome) | Phone 390×844 and desktop 1280×800, Chrome | Open the site in a private window, press "Try a demo field" | The demo tour started only from the second button; the dimmed screen was barely visible on the dark map; the map, search and layers were never explained | A short guide that starts from the main button and covers the map first | Fixed 742fc63: new 9-step guide (map → card → comparison) |
| 2 | Claude, 15 Nov | Phone 390×844 | Demo tour, step "What to sow next" | The highlight ring ran out of the card over the map; the hint card covered the search box | Ring only around the visible part; hint card beside it | Fixed 742fc63: spotlight clipped to visible area, card placed by measured size |
| 3 | Claude, 15 Nov | Phone, any | Open the site for the first time and tap the map | The welcome card closed on the stray tap, so the guide was lost | Welcome card stays until Skip, Esc or a button | Fixed 742fc63 |
| 4 | Claude, 15 Nov | Phone 390×844, Ukrainian | Welcome card, footer | The "UK" button was cut off on the right by the long NASA line | Language toggle fully visible | Fixed 742fc63 |
| 5 | Claude, 15 Nov | Phone 390×844 | Field card: risk lines, watch dates, "Mark unsafe"; comparison: climate switch, combo chips, Priorities, Details | Tap targets 21–32 px tall (task 15: hard to hit with a finger) | At least 40 px | Fixed: min-height 40 px on phones |

### Checked on 15 Nov and found fine (scripted, phone EN + UK, desktop EN)
- All 19 ⓘ notes on the card and the comparison open and stay fully on screen.
- No Latin words left in the Ukrainian card and comparison; no page wider than the screen; no console errors.
- History editor: setting 2026 to sunflower removes sunflower from "Sow next" and re-scores the rest at once.
- "Why?" draws its charts (16 on the demo field).

### Waiting for
- T's own notes from the first test pass (not received yet: no branch, no rows here).
