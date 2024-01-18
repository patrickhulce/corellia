#!/bin/bash

set -euxo pipefail

if [ $# -lt 4 ]
then
  echo "Usage: ./upscale-video.sh <input_file> <output_file> <start_time> <end_time>"
  exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="$2"
START_TIME="$3"
END_TIME="$4"
DURATION=$(python -c "print($END_TIME - $START_TIME)")

export TVAI_MODEL_DATA_DIR="C:\\ProgramData\\Topaz Labs LLC\\Topaz Video AI\\models\\"
export TVAI_MODEL_DIR="C:\\ProgramData\\Topaz Labs LLC\\Topaz Video AI\\models"
export FFMPEG_PATH="C:\\Program Files\\Topaz Labs LLC\\Topaz Video AI\\ffmpeg.exe"

"$FFMPEG_PATH" "-hide_banner" \
 "-t" "$DURATION"\
 "-ss" "$START_TIME"\
 "-i" "$INPUT_FILE"\
 "-sws_flags" "spline+accurate_rnd+full_chroma_int"\
 "-color_trc" "1"\
 "-colorspace" "1"\
 "-color_primaries" "1"\
 "-filter_complex" "tvai_up=model=prob-3:scale=0:w=8192:h=4096:preblur=0:noise=0:details=0:halo=0:blur=0:compression=0:estimate=8:blend=0.2:device=0:vram=1:instances=1,scale=w=8192:h=4096:flags=lanczos:threads=0,scale=out_color_matrix=bt709"\
 "-c:v" "hevc_nvenc"\
 "-profile:v" "main"\
 "-pix_fmt" "yuv420p"\
 "-b_ref_mode" "disabled"\
 "-tag:v" "hvc1"\
 "-g" "30"\
 "-preset" "p7"\
 "-tune" "hq"\
 "-rc" "constqp"\
 "-qp" "25"\
 "-rc-lookahead" "20"\
 "-spatial_aq" "1"\
 "-aq-strength" "15"\
 "-b:v" "0"\
 "-map" "0:a"\
 "-map_metadata:s:a:0" "0:s:i:2"\
 "-c:a" "copy"\
 "-bsf:a:0" "aac_adtstoasc"\
 "-map_metadata" "0"\
 "-map_metadata:s:v" "0:s:v"\
 "-movflags" "frag_keyframe+empty_moov+delay_moov+use_metadata_tags+write_colr" \
 "$OUTPUT_FILE"
