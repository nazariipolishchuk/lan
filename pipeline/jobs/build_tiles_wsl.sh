#!/usr/bin/env bash
# Field tiles for one build, run inside WSL with the tippecanoe built in ~/local/bin (no sudo):
#   bash build_tiles_wsl.sh /mnt/c/Work/SpaceXChallenge/data/work/us /mnt/c/Work/SpaceXChallenge/data/out_us/tiles
# Reads <work>/<code>/fields-<code>.geojsonseq, writes <out>/fields-<code>.pmtiles, skips tiles already built.
# Zooms 11–12 as for Ukraine (see build_tiles.sh). The input is copied to the Linux disk first: tippecanoe
# reads it several times and /mnt/c is slow.
set -euo pipefail
work=${1:?work dir}
out=${2:?output dir}
TIPPE=${TIPPE:-$HOME/local/bin/tippecanoe}
mkdir -p "$out" /tmp/lan_tiles
for f in "$work"/*/fields-*.geojsonseq; do
  code=$(basename "$f" .geojsonseq)
  [ -s "$out/$code.pmtiles" ] && { echo "$code exists"; continue; }
  t0=$(date +%s)
  cp "$f" /tmp/lan_tiles/in.geojsonseq
  "$TIPPE" -q -o "/tmp/lan_tiles/$code.pmtiles" -l fields -Z 11 -z 12 \
    --drop-densest-as-needed --extend-zooms-if-still-dropping --detect-shared-borders --force -P /tmp/lan_tiles/in.geojsonseq
  mv "/tmp/lan_tiles/$code.pmtiles" "$out/$code.pmtiles"
  rm -f /tmp/lan_tiles/in.geojsonseq
  echo "$code $(du -m "$out/$code.pmtiles" | cut -f1) MB $(( $(date +%s) - t0 )) s"
done
