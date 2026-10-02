#!/usr/bin/env bash
# Découpe les planches générées (MCP Monid / Alibaba wan2.7-image) en assets pixel art du jeu.
# Usage : tools/build-art.sh <dossier des planches sources>
# Planches attendues : rooms_a.png rooms_b.png rooms_c.png (2048×1280, grilles 2×2), portraits.png (1536×1536, 3×3), surface.png (2560×640).
set -euo pipefail
SRC=${1:?dossier source}
OUT=$(dirname "$0")/../public/assets
mkdir -p "$OUT/rooms" "$OUT/portraits"
# Recadrage bas-aligné (on garde le sol) au ratio 256×104, réduction en boîte puis palette de 64 couleurs.
crop() {
  local w=$(( $3-$2-16 )); local h=$(( w*104/256 )); local ybot=$(( $5-8 )); local ytop=$(( ybot-h ))
  if [ $ytop -lt $(( $4+8 )) ]; then ytop=$(( $4+8 )); h=$(( ybot-ytop )); w=$(( h*256/104 )); fi
  convert "$SRC/$1" -crop ${w}x${h}+$(( $2+8 ))+${ytop} +repage -filter Box -resize 256x104\! -dither None -colors 64 "$OUT/rooms/$6.png"
}
crop rooms_a.png 23 1000 113 516 hydroponics; crop rooms_a.png 1048 2024 113 516 residential
crop rooms_a.png 23 1000 680 1152 admin;      crop rooms_a.png 1048 2024 680 1152 security
crop rooms_b.png 21 1002 28 599 medical;      crop rooms_b.png 1043 2023 28 599 workshop
crop rooms_b.png 21 1002 668 1196 water;      crop rooms_b.png 1043 2023 668 1196 generator
crop rooms_c.png 20 1005 67 567 depot;        crop rooms_c.png 1042 2029 67 567 mine
crop rooms_c.png 20 1005 702 1213 canteen;    crop rooms_c.png 1042 2029 702 1213 servers
names=(mayor judge sheriff it mechanic miner doctor farmer supply); i=0
for r in 0 1 2; do for c in 0 1 2; do
  convert "$SRC/portraits.png" -crop 480x480+$(( c*510+16 ))+$(( r*510+16 )) +repage -filter Box -resize 96x96 -dither None -colors 64 "$OUT/portraits/${names[$i]}.png"; i=$((i+1))
done; done
convert "$SRC/surface.png" -filter Box -resize 1280x320 -dither None -colors 64 "$OUT/surface.png"
# Intro : le Pacte (pact_closed.png / pact_open.png en 2048×1152, la version ouverte générée avec la fermée en référence)
mkdir -p "$OUT/intro"
convert "$SRC/pact_closed.png" -filter Box -resize 1024x576 -dither None -colors 96 "$OUT/intro/pact_closed.png"
convert "$SRC/pact_open.png" -filter Box -resize 1024x576 -dither None -colors 96 "$OUT/intro/pact_open.png"
convert "$SRC/pact_open.png" -crop 620x560+1050+300 +repage -filter Box -resize 310x280 -dither None -colors 48 "$OUT/intro/page.png"
