#!/bin/bash
set -e

VDIR="videos"
OUTDIR="output"
mkdir -p "$OUTDIR/clips"

echo "═══════════════════════════════════════════"
echo "  🎬 BoredBrain Demo Video Builder"
echo "═══════════════════════════════════════════"

# ─── Step 1: Convert webm → mp4 + trim ────────────────────────────────

echo ""
echo "📦 Step 1: Converting and trimming clips..."

declare -a CLIPS=(
  "01-hero-landing.webm:0:3:clip01"
  "02-hero-features.webm:0.5:2.5:clip02"
  "03-arena-battle.webm:1:3.5:clip03"
  "04-arena-scroll.webm:0.5:2.5:clip04"
  "05-arena-debates.webm:1:3:clip05"
  "06-marketplace.webm:1:3:clip06"
  "07-playground.webm:1:3.5:clip07"
  "08-stats-dashboard.webm:1:3:clip08"
  "09-topics.webm:1:2.5:clip09"
  "10-registry.webm:1:2.5:clip10"
)

for entry in "${CLIPS[@]}"; do
  IFS=':' read -r input start dur output <<< "$entry"
  echo "  → $output ($dur s)"
  ffmpeg -y -ss "$start" -i "$VDIR/$input" -t "$dur" \
    -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:-1:-1:color=black,fade=t=in:d=0.3,fade=t=out:st=$(echo "$dur - 0.3" | bc):d=0.3" \
    -c:v libx264 -preset fast -crf 18 -r 30 -an \
    "$OUTDIR/clips/${output}.mp4" 2>/dev/null
done

# ─── Step 2: Create title cards using color + Remotion stills ─────────

echo ""
echo "📝 Step 2: Creating black transition cards..."

# Simple black card with fade (titles will be added via Remotion overlay)
for i in 1 2 3 4 5; do
  ffmpeg -y -f lavfi -i "color=c=black:s=1920x1080:d=1.5:r=30" \
    -vf "fade=t=in:d=0.2,fade=t=out:st=1.3:d=0.2" \
    -c:v libx264 -preset fast -crf 18 -r 30 \
    "$OUTDIR/clips/black${i}.mp4" 2>/dev/null
done
echo "  ✓ Black transition cards"

# ─── Step 3: Generate BGM ─────────────────────────────────────────────

echo ""
echo "🎵 Step 3: Generating background music..."

ffmpeg -y -f lavfi \
  -i "sine=frequency=55:duration=50[bass]; \
      sine=frequency=110:duration=50[sub]; \
      sine=frequency=220:duration=50[mid]; \
      sine=frequency=440:duration=50[high]; \
      anoisesrc=d=50:c=pink:a=0.012[noise]; \
      [bass]volume=0.25[b]; \
      [sub]volume=0.12,tremolo=f=2:d=0.3[s]; \
      [mid]volume=0.06,tremolo=f=4:d=0.5[m]; \
      [high]volume=0.03,tremolo=f=8:d=0.7[h]; \
      [noise]volume=0.4[n]; \
      [b][s][m][h][n]amix=inputs=5:duration=longest,afade=t=in:d=2,afade=t=out:st=46:d=4,lowpass=f=6000,highpass=f=40" \
  -c:a aac -b:a 192k "$OUTDIR/bgm.m4a" 2>/dev/null

echo "  ✓ bgm.m4a"

# ─── Step 4: Assemble video ───────────────────────────────────────────

echo ""
echo "🎞️  Step 4: Assembling final video..."

# Sequence: black → hero → features → black → arena battle → arena scroll → arena debates
#           → black → marketplace → black → playground → stats → topics → registry → black(CTA)
cat > "$OUTDIR/concat.txt" << 'EOF'
file 'clips/black1.mp4'
file 'clips/clip01.mp4'
file 'clips/clip02.mp4'
file 'clips/black2.mp4'
file 'clips/clip03.mp4'
file 'clips/clip04.mp4'
file 'clips/clip05.mp4'
file 'clips/black3.mp4'
file 'clips/clip06.mp4'
file 'clips/black4.mp4'
file 'clips/clip07.mp4'
file 'clips/clip08.mp4'
file 'clips/clip09.mp4'
file 'clips/clip10.mp4'
file 'clips/black5.mp4'
EOF

ffmpeg -y -f concat -safe 0 -i "$OUTDIR/concat.txt" \
  -c:v libx264 -preset fast -crf 18 -r 30 -pix_fmt yuv420p \
  "$OUTDIR/video-noaudio.mp4" 2>/dev/null

echo "  ✓ Video assembled"

# ─── Step 5: Add BGM ──────────────────────────────────────────────────

echo ""
echo "🔊 Step 5: Adding background music..."

ffmpeg -y -i "$OUTDIR/video-noaudio.mp4" -i "$OUTDIR/bgm.m4a" \
  -c:v copy -c:a aac -b:a 192k \
  -shortest -map 0:v -map 1:a \
  "$OUTDIR/boredbrain-demo.mp4" 2>/dev/null

FILESIZE=$(du -h "$OUTDIR/boredbrain-demo.mp4" | cut -f1)
DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUTDIR/boredbrain-demo.mp4" 2>/dev/null | cut -d. -f1)

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Demo video complete!"
echo "  📹 output/boredbrain-demo.mp4 ($FILESIZE)"
echo "  ⏱️  ${DURATION}s"
echo "═══════════════════════════════════════════"
