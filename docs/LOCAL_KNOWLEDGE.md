# Local knowledge (N, Cherkasy oblast, Forest-Steppe)

Dictated by N on Sat 14 Nov 2026, 11:25. Ground truth from his own experience of fields near his
village. No names of people, farms or villages. Feeds the rules review (task 2.7) and UT3.

## Coverage of task 1.10

| Asked in the plan | Status |
|---|---|
| Rotations actually used nearby | Partly: "after maize or sunflower a light crop". N does not know full chains (he does not track fields); final |
| Real harvest dates per crop | Given (below) |
| Real sowing dates per crop | Winter crops: "somewhere in October, almost right after the harvest is fully finished" (14 Nov, 12:15). No exact dates; spring crops not given; final |
| Bad seasons (year + crop) | N declines: he cannot judge agronomists' mistakes from memory |

## Sowing

Winter crops are sown in October, almost immediately after the harvest is fully finished. N does
not track exact dates.

Check against the engine (climate-derived calendar, cell `49.5_31.875`, test
`web/src/engine/realdata.test.ts`): winter wheat late September – mid October, winter barley early –
mid October. **Agrees.** Harvest of cereals in July, sugar beet September–October: agrees with the
harvest notes below. Rapeseed harvest came out in August; real rapeseed is threshed in early July,
before wheat, so its season length was corrected from 31 to 29 dekads (unsourced, review in 2.7).

## Crops grown

Most common nearby: wheat, soybean, maize, sunflower, sugar beet.

## Typical sequences

- After maize or sunflower, farmers usually sow a "light" crop (a less demanding one).
  → Supports `DRY_PROFILE` and the negative predecessor effects of sunflower and maize.
- N cannot give exact rotation chains from memory.

## Harvest timing (what actually happens)

| Crop | When | Why / note |
|---|---|---|
| Most crops | July–August | Main threshing season |
| Soybean | Can be the earliest | In drought the pods shatter and the beans fall out; the combine can no longer pick them up, so farmers harvest as early as possible |
| Sugar beet | October | Often after rains, so the roots are heavier for sale |
| Hybrid (seed) crops: wheat, maize | As soon as the crop dries | Harvested immediately at dry-down |
| Maize for silage (ordinary maize) | Late; can be harvested even in snow | Harvest window extends into winter |

## Implications for the engine (to check in 2.7)

- Soy shatter risk under drought → a hazard "dry spell at pod maturity → early harvest / losses".
- Sugar beet harvest in October and maize harvest late (sometimes into winter) → `LATE_HARVEST`
  before a winter crop is realistic here.
- Bad seasons with year and crop: N will not name any (he cannot judge agronomists' mistakes from memory).
  Validation therefore rests on crop history, not on remembered bad years.

## Crop damage by agrochemicals (regular, not unusual)

When a crop is burnt by fertiliser or herbicide, farmers usually either **resow** the field or try
to revive the crop with a neutraliser. N does not know the exact products.

Implications: a season's greenness curve can show a sudden drop and a second green-up (resowing),
or a dip and a slow recovery. The classifier and the "now" state must not treat such a curve as a
different crop by default; the card's gaps list should mention that a resown season may be
misclassified.
