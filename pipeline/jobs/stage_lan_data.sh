#!/usr/bin/env bash
# Stage data/out into the local clone of the `lan-data` repository (data/lan-data, git-ignored here).
# It only copies and commits locally; pushing is a separate, approved step.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
dst="$root/data/lan-data"
mkdir -p "$dst"
if [ ! -d "$dst/.git" ]; then
  git -C "$dst" init -q -b main
fi
# replace the data folders, keep the repository files
for d in climate curves fields tiles; do
  rm -rf "${dst:?}/$d"
  cp -r "$root/data/out/$d" "$dst/$d"
done
cp "$root/data/out/meta.json" "$dst/meta.json"
touch "$dst/.nojekyll"
cat > "$dst/README.md" <<'EOF'
# lan-data

Precomputed data for the Lan web app (NASA Space Apps Challenge 2026, "Field Shift").
Served by GitHub Pages at `/lan-data/`; the app's code is in the `lan` repository.

| Folder | Content | Sources |
|---|---|---|
| `tiles/` | Field outlines as PMTiles | Fields of The World (CC-BY-4.0) |
| `fields/` | Per-field area, soil, slope, crop history | NASA HLS, KPI/World Bank maps (CC-BY-4.0), SoilGrids (CC-BY-4.0), NASA NASADEM |
| `curves/` | Greenness curves per field and season | NASA HLS Vegetation Indices |
| `climate/` | Climate indicators per cell | NASA POWER |
| `meta.json` | Build date, coverage, measured accuracy, sources | — |

Crop history is a satellite estimate, not a record. Licences of every source: `docs/REFERENCES.md` in `lan`.
EOF
git -C "$dst" add -A
git -C "$dst" commit -q -m "data: $(date -u +%Y-%m-%dT%H:%MZ)" || echo "nothing new to commit"
du -sh "$dst" --exclude=.git
