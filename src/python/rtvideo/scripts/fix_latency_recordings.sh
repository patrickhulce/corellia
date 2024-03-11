#!/bin/bash

set -euxo pipefail

# For each .MOV file in the current directory, convert it to an .mp4 file
for file in *.MOV; do
  output_mp4=$(basename "$file" .MOV).mp4

  left_half_filters="crop=iw/4:ih/2:0:0,eq=brightness=0.8:contrast=2.5,unsharp=5:5:3.0,hqdn3d=1.2:1.2:6:6,scale=iw*2:ih*2"
  right_half_filters="crop=iw/2:ih:iw/2:0,eq=brightness=0.06:contrast=1.5,unsharp"
  drawtext="drawtext=fontfile=/Library/Fonts/Arial Unicode.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:text='%{n}':x=10:y=10"

  ffmpeg -i "$file" \
    -vf "split=2[a][b];[a]$left_half_filters[a];[b]$right_half_filters[b];[a][b]hstack, $drawtext" \
    -y \
    "$output_mp4"
done
