#!/bin/bash

set -euo pipefail

if [ $# -lt 4 ]
then
  echo "Usage: ./upscale-video.sh <input_file> <output_file> <start_time> <end_time>"
  exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="$2"
START_TIME="$3"
END_TIME="$4"
