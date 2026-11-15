#!/usr/bin/env bash
# Night supervisor for the USA build (N's yes, 15 Nov ~00:30). Runs in its own Git Bash window; closing the
# window stops it. Every step resumes where it stopped, so a failed step is simply run again (up to 3 tries).
# Progress: data/logs/us_status.txt (one line per event); each step's output: data/logs/night_<step>.log.
#
# Chain: wait for HLS 2026 → pull the VPS results → climate → soil/terrain → history per state → merge →
# layer scores → GeoJSON → tiles (WSL tippecanoe) → upload to R2 → HLS 2025–2023 (laptop lanes + VPS) → pull.
# It never pushes to GitHub: the site switch to the USA data is checked and pushed by hand.
set -u
ROOT=/c/Work/SpaceXChallenge
P=$ROOT/pipeline
LOG=$ROOT/data/logs
ST=$LOG/us_status.txt
H=$(grep -oE 'root@[0-9.]+' "$LOG/start_laptop_hls.cmd")
SSH=(ssh -i "$HOME/.ssh/youtubeclip" -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4 "$H")
export LAN_REGION=us PYTHONIOENCODING=utf-8
TILES=$(wc -l < "$LOG/tiles_us.txt")
cd "$P" || exit 1

say() { echo "$(date +%H:%M:%S) $*" | tee -a "$ST"; }
step() {  # step NAME command…: up to 3 tries
  local name=$1; shift
  for t in 1 2 3; do
    say "$name: start (try $t)"
    if "$@" >> "$LOG/night_$name.log" 2>&1; then say "$name: ok"; return 0; fi
    say "$name: FAILED (try $t), see night_$name.log"; sleep 30
  done
  say "$name: GAVE UP after 3 tries"; return 1
}
codes_by_size() { du -s "$ROOT"/data/work/us/*/fields | sort -rn | awk -F/ '{print $(NF-1)}'; }

# wait until every tile has a marker for each of YEARS on the VPS (the laptop copies its markers there);
# when nothing advances for 25 minutes, relaunch the laptop lanes; after two relaunches go on regardless
wait_hls() {
  local years=$1 launcher=$2 last=-1 still=0 relaunch=0 n want
  want=$(( TILES * $(echo "$years" | wc -w) ))
  while :; do
    # the laptop's markers go to the VPS from here (so the VPS skips those tiles); done = laptop ∪ VPS
    (cd "$ROOT/data/work/ndvi_us" && ls *.ok 2>/dev/null | tar cf - -T - 2>/dev/null) | "${SSH[@]}" 'cd lan/data/work/ndvi_us && tar xf - 2>/dev/null' || true
    n=0
    for y in $years; do
      n=$(( n + $( { "${SSH[@]}" "cd lan/data/work/ndvi_us && ls *_$y.ok 2>/dev/null"; (cd "$ROOT/data/work/ndvi_us" && ls *_$y.ok 2>/dev/null); } | sort -u | wc -l) ))
    done
    say "hls $years: $n / $want tile-seasons"
    [ "$n" -ge "$want" ] && return 0
    if [ "$n" -eq "$last" ]; then still=$(( still + 1 )); else still=0; last=$n; fi
    if [ "$still" -ge 12 ]; then
      if [ "$relaunch" -ge 2 ]; then say "hls $years: no progress after 2 relaunches, going on with $n / $want"; return 0; fi
      relaunch=$(( relaunch + 1 )); still=0
      say "hls $years: stalled, relaunching laptop lanes ($relaunch)"
      cmd //c "$launcher" 8
    fi
    sleep 120
  done
}

pull_vps() {
  local need
  need=$(comm -23 <("${SSH[@]}" 'cd lan/data/work/ndvi_us && ls *.parquet' | sort) <(cd "$ROOT/data/work/ndvi_us" && ls *.parquet | sort) | sed 's/\.parquet$//')
  [ -z "$need" ] && return 0
  echo "$need" | awk '{print $1".parquet"; print $1".ok"}' | "${SSH[@]}" 'cd lan/data/work/ndvi_us && tar cf - -T - 2>/dev/null' | (cd "$ROOT/data/work/ndvi_us" && tar xf -)
}

climate() {
  uv run -q python -c "
from pathlib import Path
from lan.climate import run
from lan.config import RAW_DIR, DATA_DIR
cells = Path('../data/work/cells_us.txt').read_text().split()
run(cells, DATA_DIR / 'out_us' / 'climate', RAW_DIR / 'power', workers=4)
missing = [c for c in cells if not (DATA_DIR / 'out_us' / 'climate' / f'{c}.json').exists()]
print('missing cells:', len(missing))
raise SystemExit(0 if len(missing) <= len(cells) // 100 else 1)
"
}

parallel_codes() {  # parallel_codes WORKERS STEP CODES…: split codes round-robin (largest first) over workers
  local w=$1 stepname=$2; shift 2
  local codes=("$@") pids=() i
  for ((i = 0; i < w; i++)); do
    local part=()
    for ((j = i; j < ${#codes[@]}; j += w)); do part+=("${codes[j]}"); done
    [ ${#part[@]} -eq 0 ] && continue
    uv run -q python jobs/build_ukraine.py "$stepname" "${part[@]}" > "$LOG/night_${stepname}_$i.log" 2>&1 &
    pids+=($!)
  done
  local rc=0
  for p in "${pids[@]}"; do wait "$p" || rc=1; done
  return $rc
}

prep() {
  # earlier workers started by hand may still run: wait for them first
  while powershell -NoProfile -Command "if (Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { \$_.CommandLine -match 'build_ukraine.py prep' }) { exit 0 } else { exit 1 }"; do
    say "prep: waiting for running prep workers"; sleep 120
  done
  local miss=()
  for c in $(codes_by_size); do
    [ -f "$ROOT/data/work/us/$c/soil.parquet" ] && [ -f "$ROOT/data/work/us/$c/terrain.parquet" ] || miss+=("$c")
  done
  say "prep: ${#miss[@]} states to do"
  [ ${#miss[@]} -eq 0 ] && return 0
  parallel_codes 4 prep "${miss[@]}"
  for c in "${miss[@]}"; do [ -f "$ROOT/data/work/us/$c/terrain.parquet" ] || return 1; done
}

oblasts() {
  uv run -q python jobs/build_ukraine.py tiles-index || return 1
  local miss=()
  for c in $(codes_by_size); do [ -f "$ROOT/data/work/us/$c/oblast.json" ] || miss+=("$c"); done
  say "history: ${#miss[@]} states to do"
  [ ${#miss[@]} -eq 0 ] && return 0
  parallel_codes 2 oblast "${miss[@]}"
  for c in "${miss[@]}"; do [ -f "$ROOT/data/work/us/$c/oblast.json" ] || return 1; done
}

scores() {
  node --max-old-space-size=8192 "$ROOT/data/work/batch-score.bundle.mjs" "$ROOT/data/out_us" "$ROOT/web/public/rules/us" \
    "$ROOT/data/work/us/scores.tsv" 2026-11-15
}

geojson() {
  local codes=($(codes_by_size))
  parallel_codes 3 geojson "${codes[@]}" || return 1
  uv run -q python jobs/build_ukraine.py geojson --layer
}

tiles() {
  MSYS_NO_PATHCONV=1 wsl -e bash /mnt/c/Work/SpaceXChallenge/pipeline/jobs/build_tiles_wsl.sh /mnt/c/Work/SpaceXChallenge/data/work/us \
    /mnt/c/Work/SpaceXChallenge/data/out_us/tiles
  local n
  n=$(ls "$ROOT"/data/out_us/tiles/*.pmtiles 2>/dev/null | wc -l)
  say "tiles: $n files"
  [ "$n" -ge "$(ls -d "$ROOT"/data/work/us/*/ | wc -l)" ]
}

upload() { uv run -q python jobs/upload_r2.py "$ROOT/data/out_us" us/ --workers 16; }

second_pass() {
  # the laptop decides "queues met" from the VPS log, so the 2026 log is moved aside first
  local i
  for i in $(seq 1 30); do  # the VPS may still finish a last 2026 tile
    "${SSH[@]}" 'tmux has-session -t =us 2>/dev/null' || break
    say "pass2: waiting for the VPS 2026 queue to end"; sleep 60
  done
  "${SSH[@]}" 'tmux kill-session -t =us 2>/dev/null; [ -f lan/logs/run_all.log ] && mv lan/logs/run_all.log lan/logs/run_all_us2026.log; exit 0' || return 1
  sed 's/-Years 2026/-Years 2025,2024,2023/' "$LOG/start_laptop_hls_us.cmd" > "$LOG/start_laptop_hls_us2.cmd"
  "${SSH[@]}" 'cd lan/pipeline && tmux new-session -d -s us2 "TILES=../logs/tiles_us.txt YEARS=\"2025 2024 2023\" WORKERS=4 EXTRA=\"--fields ../data/work/fields_us --out ../data/work/ndvi_us\" bash jobs/run_all.sh 1 784; echo exit=\$? >> ../logs/run_all.log"' || return 1
  sleep 20
  cmd //c "C:\\Work\\SpaceXChallenge\\data\\logs\\start_laptop_hls_us2.cmd" 8
}

say "=== night chain start ==="
step hls2026 wait_hls "2026" "C:\\Work\\SpaceXChallenge\\data\\logs\\start_laptop_hls_us.cmd"
step pull pull_vps
step climate climate
step prep prep
step history oblasts
step merge uv run -q python jobs/build_ukraine.py merge
step scores scores
step geojson geojson
step tiles tiles
step upload upload && say "USA data is in R2 (prefix us/). Site switch: push by hand after a check."
step pass2 second_pass
step hls2023 wait_hls "2025 2024 2023" "C:\\Work\\SpaceXChallenge\\data\\logs\\start_laptop_hls_us2.cmd"
step pull2 pull_vps
say "=== night chain done ==="
echo "Finished. This window can be closed."
read -r _
