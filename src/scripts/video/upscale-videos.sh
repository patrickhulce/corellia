#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
INPUT_DIRECTORY="./in"
TMP_DIRECTORY="./tmp"
OUTPUT_DIRECTORY="./out"
CHUNK_SIZE_IN_SECONDS=10

if [ $# -lt 3 ]
then
  echo "Usage: ./upscale-videos.sh
  --input-dir=<input_dir> : where the videos to upscale live
  --output-dir=<output_dir> : where the final upscaled videos will be saved
  --tmp-dir=<tmp_dir> : where intermediate chunks will be saved"
  exit 1
fi

for arg in "$@"
do
    key=$(echo "$arg" | cut -f1 -d=)
    value=$(echo "$arg" | cut -f2 -d=)

    case $key in
        --input-dir) INPUT_DIRECTORY=$value;;
        --output-dir) OUTPUT_DIRECTORY=$value;;
        --tmp-dir) TMP_DIRECTORY=$value;;
        *)
    esac
done

for file_path in "$INPUT_DIRECTORY"/*.mp4
do
  # Step 0. Check if the file has already been processed with existence in output.
  file_name=$(basename "$file_path")
  file_name_no_ext="${file_name%.*}"
  output_file_path="$OUTPUT_DIRECTORY/$file_name"
  if [ -f "$output_file_path" ]; then
    echo "Skipping $file_name because it already exists in output."
    continue
  fi

  # Create the directories we'll need.
  mkdir -p "$OUTPUT_DIRECTORY"
  mkdir -p "$TMP_DIRECTORY/upscaled"
  mkdir -p "$TMP_DIRECTORY/encoded"

  # Step 1. Determine the length the video and count how many chunks of $CHUNK_SIZE_IN_SECONDS we need.
  echo "Determining length of $file_name..."
  length_in_seconds=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$file_path")
  length_in_seconds_int=${length_in_seconds%.*}
  echo "Length of $file_name is $length_in_seconds seconds."
  num_chunks=$(python -c "print(int($length_in_seconds / $CHUNK_SIZE_IN_SECONDS))")
  echo "Splitting $file_name into $num_chunks chunks..."

  # Step 2. For each chunk, upscale it and encode it.
  for i in $(seq 0 $num_chunks)
  do
    UPSCALED_FILE_PATH="$TMP_DIRECTORY/upscaled/$file_name_no_ext-$i.mp4"
    ENCODED_FILE_PATH="$TMP_DIRECTORY/encoded/$file_name_no_ext-$i.mp4"

    # Step 2a. Determine the start and end time of the chunk.
    start_time=$((i * CHUNK_SIZE_IN_SECONDS))
    end_time=$(((i + 1) * CHUNK_SIZE_IN_SECONDS))
    if [ $start_time -ge "$length_in_seconds_int" ]; then
      echo "Skipping $file_name chunk $i because it's past the end of the video."
      continue
    fi

    # Check if it's the last chunk, and if so, set the end time to the end of the video.
    if [ $end_time -gt "$length_in_seconds_int" ]; then
      end_time=$length_in_seconds
    fi

    echo "Processing chunk $i of $num_chunks from $start_time to $end_time..."
    if [ -f "$ENCODED_FILE_PATH" ]; then
      # Check if the chunk was the right length OR if it was the last chunk.
      existing_chunk_length=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$ENCODED_FILE_PATH" || echo '0')
      existing_chunk_length_int=${existing_chunk_length%.*}
      if [ "$existing_chunk_length_int" -ge "$CHUNK_SIZE_IN_SECONDS" ] || [ "$i" -eq "$num_chunks" ]; then
        echo "$file_name chunk $i already encoded."
        continue
      else
        echo "Removing existing $file_name chunk $i because it's the wrong length."
        rm "$ENCODED_FILE_PATH"
      fi
    fi

    # Step 2b. Delete any existing chunks in tmp/upscaled that aren't in tmp/encoded.
    if [ -f "$UPSCALED_FILE_PATH" ]; then
      echo "Removing existing $file_name chunk $i because it already exists in tmp/upscaled, must be partially finished."
      rm "$UPSCALED_FILE_PATH"
    fi

    # Step 2c. Upscale the chunk.
    echo "Upscaling $file_name chunk $i..."
    "$SCRIPT_DIR/upscale-video.sh" "$file_path" "$UPSCALED_FILE_PATH" "$start_time" "$end_time"

    # Step 2d. Encode the chunk.
    ffmpeg -i "$UPSCALED_FILE_PATH" -c:v libx265 -crf 23 "$ENCODED_FILE_PATH"
  done

  # Step 3. Concatenate all the chunks.
  echo "Concatenating chunks..."
  file_list_path="$TMP_DIRECTORY/$file_name_no_ext-file-list.txt"
  for i in $(ls "$TMP_DIRECTORY/encoded/$file_name_no_ext-"*.mp4 | sort -V); do echo "file '$i'" >> "$file_list_path"; done
  ffmpeg -f concat -safe 0 -i "$file_list_path" -c copy "$output_file_path"

  # Step 4. Clean up the tmp directory.
  echo "Cleaning up tmp directory..."
  rm -rf "$TMP_DIRECTORY"
done
