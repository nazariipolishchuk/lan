#!/usr/bin/env bash
# Field tiles per oblast (PLAN 4.0/4.2), run on the VPS where tippecanoe is installed:
#   bash build_tiles.sh <dir with fields-XX.geojsonseq.gz> <out dir>
# Zooms 11–12 only: fields are drawn from zoom 11, and z12 already holds ~1.6 m precision, so the map
# over-zooms it to 16. This keeps all of Ukraine under the 1 GB GitHub Pages limit (z9–14 would not fit).
set -euo pipefail
src=${1:?input dir}
out=${2:?output dir}
mkdir -p "$out"
for f in "$src"/fields-*.geojsonseq.gz; do
  code=$(basename "$f" .geojsonseq.gz)
  t0=$(date +%s)
  gzip -dc "$f" | tippecanoe -q -o "$out/$code.pmtiles" -l fields -Z 11 -z 12 \
    --drop-densest-as-needed --extend-zooms-if-still-dropping --detect-shared-borders --force -P /dev/stdin
  echo "$code $(du -m "$out/$code.pmtiles" | cut -f1) MB $(( $(date +%s) - t0 )) s"
done
