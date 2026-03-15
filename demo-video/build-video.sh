#!/bin/bash
set -e

VDIR="videos"
OUTDIR="output"
mkdir -p "$OUTDIR/clips"

echo "═══════════════════════════════════════════"
echo "  🎬 BoredBrain Demo Video Builder"
echo "═══════════════════════════════════════════"

# ─── Step 1: Convert webm → mp4 + trim to tight clips ─────────────────

echo ""
echo "📦 Step 1: Converting and trimming clips..."

# Each clip: input, start_time, duration, output_name
declare -a CLIPS=(
  "01-hero-landing.webm:0:3:clip01"
  "02-hero-features.webm:0.5:3:clip02"
  "03-arena-battle.webm:1:4:clip03"
  "04-arena-scroll.webm:0.5:3:clip04"
  "05-arena-debates.webm:1:3.5:clip05"
  "06-marketplace.webm:1:3.5:clip06"
  "07-playground.webm:1:4:clip07"
  "08-stats-dashboard.webm:1:3.5:clip08"
  "09-topics.webm:1:3:clip09"
  "10-registry.webm:1:3:clip10"
)

for entry in "${CLIPS[@]}"; do
  IFS=':' read -r input start dur output <<< "$entry"
  echo "  → $output ($dur s)"
  ffmpeg -y -ss "$start" -i "$VDIR/$input" -t "$dur" \
    -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:-1:-1:color=black" \
    -c:v libx264 -preset fast -crf 18 -r 30 -an \
    "$OUTDIR/clips/${output}.mp4" 2>/dev/null
done

# ─── Step 2: Generate synthetic BGM (sine wave beat) ───────────────────

echo ""
echo "🎵 Step 2: Generating background music..."

# Create a dark, techy ambient track using ffmpeg's audio generators
# Low bass + hi-hat pattern + pad synth
ffmpeg -y -f lavfi \
  -i "sine=frequency=55:duration=45[bass]; \
      sine=frequency=110:duration=45[sub]; \
      sine=frequency=220:duration=45[mid]; \
      sine=frequency=440:duration=45[high]; \
      anoisesrc=d=45:c=pink:a=0.015[noise]; \
      [bass]volume=0.3[b]; \
      [sub]volume=0.15,tremolo=f=2:d=0.3[s]; \
      [mid]volume=0.08,tremolo=f=4:d=0.5[m]; \
      [high]volume=0.04,tremolo=f=8:d=0.7[h]; \
      [noise]volume=0.5[n]; \
      [b][s][m][h][n]amix=inputs=5:duration=longest,afade=t=in:d=2,afade=t=out:st=42:d=3,lowpass=f=8000,highpass=f=40" \
  -c:a aac -b:a 192k "$OUTDIR/bgm.m4a" 2>/dev/null

echo "  ✓ bgm.m4a generated"

# ─── Step 3: Create text overlay images ────────────────────────────────

echo ""
echo "✏️  Step 3: Creating text overlays..."

# Generate overlay text cards using ffmpeg drawtext
generate_title() {
  local text="$1"
  local subtitle="$2"
  local outfile="$3"
  local color="${4:-white}"

  ffmpeg -y -f lavfi -i "color=c=black@0.0:s=1920x1080:d=1,format=rgba" \
    -vf "drawtext=text='${text}':fontsize=72:fontcolor=${color}:x=(w-text_w)/2:y=(h-text_h)/2-40:font='Helvetica', \
         drawtext=text='${subtitle}':fontsize=24:fontcolor=white@0.5:x=(w-text_w)/2:y=(h-text_h)/2+60:font='Helvetica'" \
    -frames:v 1 "$outfile" 2>/dev/null
  echo "  ✓ $outfile"
}

generate_title "THE AUTONOMOUS" "AGENT ECONOMY" "$OUTDIR/title-intro.png" "gold"
generate_title "AI DISCOURSE ARENA" "Watch · Stake · Win" "$OUTDIR/title-arena.png" "orangered"
generate_title "AGENT MARKETPLACE" "190+ AI Agents" "$OUTDIR/title-marketplace.png" "mediumpurple"
generate_title "WEB 4.0 ECOSYSTEM" "Autonomous · Decentralized · Intelligent" "$OUTDIR/title-web4.png" "deepskyblue"
generate_title "BOREDBRAIN.APP" "Join the Future" "$OUTDIR/title-cta.png" "gold"

# ─── Step 4: Build final video with transitions ───────────────────────

echo ""
echo "🔧 Step 4: Building final video with transitions..."

# Create intro title card (3s with fade)
ffmpeg -y -f lavfi -i "color=c=black:s=1920x1080:d=3:r=30" \
  -i "$OUTDIR/title-intro.png" \
  -filter_complex "[0:v][1:v]overlay=0:0:enable='between(t,0,3)',fade=t=in:d=0.5,fade=t=out:st=2.5:d=0.5" \
  -c:v libx264 -preset fast -crf 18 -r 30 -t 3 \
  "$OUTDIR/clips/title01.mp4" 2>/dev/null

# Arena title card
ffmpeg -y -f lavfi -i "color=c=black:s=1920x1080:d=2:r=30" \
  -i "$OUTDIR/title-arena.png" \
  -filter_complex "[0:v][1:v]overlay=0:0,fade=t=in:d=0.3,fade=t=out:st=1.7:d=0.3" \
  -c:v libx264 -preset fast -crf 18 -r 30 -t 2 \
  "$OUTDIR/clips/title02.mp4" 2>/dev/null

# Marketplace title card
ffmpeg -y -f lavfi -i "color=c=black:s=1920x1080:d=2:r=30" \
  -i "$OUTDIR/title-marketplace.png" \
  -filter_complex "[0:v][1:v]overlay=0:0,fade=t=in:d=0.3,fade=t=out:st=1.7:d=0.3" \
  -c:v libx264 -preset fast -crf 18 -r 30 -t 2 \
  "$OUTDIR/clips/title03.mp4" 2>/dev/null

# Web 4.0 title card
ffmpeg -y -f lavfi -i "color=c=black:s=1920x1080:d=2:r=30" \
  -i "$OUTDIR/title-web4.png" \
  -filter_complex "[0:v][1:v]overlay=0:0,fade=t=in:d=0.3,fade=t=out:st=1.7:d=0.3" \
  -c:v libx264 -preset fast -crf 18 -r 30 -t 2 \
  "$OUTDIR/clips/title04.mp4" 2>/dev/null

# CTA title card (3s)
ffmpeg -y -f lavfi -i "color=c=black:s=1920x1080:d=3:r=30" \
  -i "$OUTDIR/title-cta.png" \
  -filter_complex "[0:v][1:v]overlay=0:0,fade=t=in:d=0.5,fade=t=out:st=2.5:d=0.5" \
  -c:v libx264 -preset fast -crf 18 -r 30 -t 3 \
  "$OUTDIR/clips/title05.mp4" 2>/dev/null

echo "  ✓ Title cards generated"

# ─── Step 5: Add xfade transitions between clips ──────────────────────

echo ""
echo "🎞️  Step 5: Concatenating with cross-fade transitions..."

# Build concat file with specific order
cat > "$OUTDIR/concat.txt" << 'CONCATEOF'
file 'clips/title01.mp4'
file 'clips/clip01.mp4'
file 'clips/clip02.mp4'
file 'clips/title02.mp4'
file 'clips/clip03.mp4'
file 'clips/clip04.mp4'
file 'clips/clip05.mp4'
file 'clips/title03.mp4'
file 'clips/clip06.mp4'
file 'clips/title04.mp4'
file 'clips/clip07.mp4'
file 'clips/clip08.mp4'
file 'clips/clip09.mp4'
file 'clips/clip10.mp4'
file 'clips/title05.mp4'
CONCATEOF

# Simple concat first (cross-fade is complex with many inputs)
ffmpeg -y -f concat -safe 0 -i "$OUTDIR/concat.txt" \
  -c:v libx264 -preset fast -crf 18 -r 30 -pix_fmt yuv420p \
  "$OUTDIR/video-noaudio.mp4" 2>/dev/null

echo "  ✓ Video assembled"

# ─── Step 6: Add BGM ──────────────────────────────────────────────────

echo ""
echo "🔊 Step 6: Adding background music..."

# Get video duration
DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUTDIR/video-noaudio.mp4" 2>/dev/null)
echo "  Video duration: ${DURATION}s"

ffmpeg -y -i "$OUTDIR/video-noaudio.mp4" -i "$OUTDIR/bgm.m4a" \
  -c:v copy -c:a aac -b:a 192k \
  -shortest -map 0:v -map 1:a \
  "$OUTDIR/boredbrain-demo.mp4" 2>/dev/null

echo "  ✓ Final video with audio"

# ─── Done ─────────────────────────────────────────────────────────────

FILESIZE=$(du -h "$OUTDIR/boredbrain-demo.mp4" | cut -f1)
echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Demo video complete!"
echo "  📹 $OUTDIR/boredbrain-demo.mp4 ($FILESIZE)"
echo "  ⏱️  ${DURATION}s"
echo "═══════════════════════════════════════════"
