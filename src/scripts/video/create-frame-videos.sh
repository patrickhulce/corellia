#!/bin/bash

set -euxo pipefail

rm -rf .data/frame_rate_test
mkdir -p .data/frame_rate_test
cd .data/frame_rate_test

# Create 240 demo PNG files
for i in {1..240}; do
    filename=$(printf "frame_%03d.png" "$i")
    magick -size 100x100 xc:none -gravity center -pointsize 40 -fill white -draw "text 0,0 \"${i}\"" "$filename"
done

# Create a video from the frames
ffmpeg -framerate 24 -i frame_%03d.png output_24.mp4

# Create a video with 23.976 fps
ffmpeg -framerate 23.976 -i frame_%03d.png output_23_976.mp4

# Create a video with 29.97 fps
ffmpeg -framerate 29.97 -i frame_%03d.png output_29_97.mp4

# Create a video with 30 fps
ffmpeg -framerate 30 -i frame_%03d.png output_30.mp4

# Extract 1s of video, starting at 2s
ffmpeg -ss 2 -t 1 -i output_24.mp4 -c libx264 output_24_2s.mp4



