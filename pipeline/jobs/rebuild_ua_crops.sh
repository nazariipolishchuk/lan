#!/usr/bin/env bash
# Rebuild Ukraine with the crop-name models trained on Ukrainian labels (models_ua_crop.pkl).
# Previous per-oblast results and field tiles are moved aside (…/prev, data/out/tiles_prev), never deleted.
# Steps: history per oblast (3 workers) → merge → layer scores → GeoJSON → tiles (WSL) → stage lan-data
# (local commit only; pushing is a separate, approved step). Log: data/logs/rebuild_ua.log
set -u
ROOT=/c/Work/SpaceXChallenge
P=$ROOT/pipeline
UA=$ROOT/data/work/ua
export PYTHONIOENCODING=utf-8
cd "$P" || exit 1
say() { echo "$(date +%H:%M:%S) $*"; }

say "move previous results aside"
for d in "$UA"/*/; do
  [ -f "$d/oblast.json" ] || continue
  mkdir -p "$d/prev"
  mv "$d/oblast.json" "$d/prev/" && { [ -f "$d/history.parquet" ] && mv "$d/history.parquet" "$d/prev/"; true; }
done
codes=$(for d in "$UA"/*/; do [ -d "$d/fields" ] && basename "$d"; done | grep -vE '^(30|40)$')

say "history: $(echo $codes | wc -w) oblasts"
i=0; pids=()
for w in 0 1 2; do
  part=$(echo $codes | tr ' ' '\n' | awk -v w=$w 'NR % 3 == w')
  [ -z "$part" ] && continue
  uv run -q python jobs/build_ukraine.py oblast $part > "$ROOT/data/logs/rebuild_ua_oblast_$w.log" 2>&1 &
  pids+=($!)
done
rc=0; for p in "${pids[@]}"; do wait "$p" || rc=1; done
missing=$(for c in $codes; do [ -f "$UA/$c/oblast.json" ] || echo $c; done)
[ -n "$missing" ] && { say "history FAILED for: $missing"; exit 1; }
say "history ok"

uv run -q python jobs/build_ukraine.py merge || { say "merge FAILED"; exit 1; }
say "merge ok"
node --max-old-space-size=6144 "$ROOT/data/work/batch-score.bundle.mjs" "$ROOT/data/out" "$ROOT/web/public/rules" \
  "$UA/scores.json" 2026-11-15 || { say "scores FAILED"; exit 1; }
say "scores ok"
uv run -q python jobs/build_ukraine.py geojson all --force || { say "geojson FAILED"; exit 1; }
say "geojson ok"
[ -d "$ROOT/data/out/tiles" ] && mv "$ROOT/data/out/tiles" "$ROOT/data/out/tiles_prev_$(date +%H%M)"
MSYS_NO_PATHCONV=1 wsl -e bash /mnt/c/Work/SpaceXChallenge/pipeline/jobs/build_tiles_wsl.sh \
  /mnt/c/Work/SpaceXChallenge/data/work/ua /mnt/c/Work/SpaceXChallenge/data/out/tiles || { say "tiles FAILED"; exit 1; }
say "tiles: $(ls "$ROOT"/data/out/tiles/*.pmtiles | wc -l) files"
bash jobs/stage_lan_data.sh && say "lan-data staged (local commit, not pushed)"
say "done"
