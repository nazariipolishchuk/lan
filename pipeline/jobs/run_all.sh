#!/usr/bin/env bash
# Process every tile in logs/tiles.txt (first column), newest season first. Safe to restart:
# finished tile-years have .ok markers and are skipped. A crashed tile is retried with fewer workers.
# Stops when free disk drops below 8 GB.
set -u
cd "$(dirname "$0")/.."
UV=/root/.local/bin/uv
export GDAL_CACHEMAX=64 ARROW_DEFAULT_MEMORY_POOL=system MALLOC_ARENA_MAX=2 MALLOC_MMAP_THRESHOLD_=1048576
LOGS=../logs
YEARS="2026 2025 2024 2023 2022 2021 2020 2019 2018 2017 2016"
START=${1:-1}   # 1-based line to start from
STOP=${2:-9999}

n=0
while read -r tile _rest; do
  n=$((n + 1))
  [ "$n" -lt "$START" ] && continue
  [ "$n" -gt "$STOP" ] && break
  free_gb=$(df --output=avail -BG / | tail -1 | tr -dc '0-9')
  if [ "$free_gb" -lt 8 ]; then echo "$(date -u +%FT%T) STOP low disk ${free_gb}G" >> "$LOGS/run_all.log"; exit 1; fi
  echo "$(date -u +%FT%T) tile $n $tile start" >> "$LOGS/run_all.log"
  if ! $UV run -q python jobs/run_tile.py "$tile" $YEARS --workers 3 >> "$LOGS/run_all.log" 2>&1 < /dev/null; then
    echo "$(date -u +%FT%T) tile $tile failed (exit $?), retry with 2 workers" >> "$LOGS/run_all.log"
    $UV run -q python jobs/run_tile.py "$tile" $YEARS --workers 2 >> "$LOGS/run_all.log" 2>&1 < /dev/null \
      || echo "$(date -u +%FT%T) tile $tile failed twice" >> "$LOGS/run_all.log"
  fi
done < "$LOGS/tiles.txt"
echo "$(date -u +%FT%T) range $START-$STOP done" >> "$LOGS/run_all.log"
