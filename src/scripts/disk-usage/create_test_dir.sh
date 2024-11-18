#!/bin/bash

set -euxo pipefail

ROOT_DIR=${1:-".data/test_dir"}
NUM_FILES=100
MAX_DEPTH=5
MIN_SIZE=1024  # Minimum file size in KB
MAX_SIZE=1024000  # Maximum file size in KB

# Ensure the root directory exists
mkdir -p "$ROOT_DIR"
echo "Creating test directory structure in $ROOT_DIR..."

# Function to create a random file with a random size between MIN_SIZE and MAX_SIZE KB
create_random_file() {
    local dir=$1
    local filename=$2
    local filesize=$((RANDOM % (MAX_SIZE - MIN_SIZE + 1) + MIN_SIZE))
    dd if=/dev/urandom of="$dir/$filename" bs=1K count="$filesize" &> /dev/null
}

# Function to randomly create files and directories recursively
populate_directory() {
    local dir=$1
    local depth=$2

    # Stop if we've reached the maximum depth
    if [ "$depth" -ge "$MAX_DEPTH" ]; then
        return
    fi

    # Create a random number of files and subdirectories at each depth
    local num_files=$((RANDOM % (NUM_FILES / MAX_DEPTH) + 1))
    local num_dirs=$((RANDOM % 3 + 1))  # Up to 3 subdirectories at each level

    # Create files
    for i in $(seq 1 "$num_files"); do
        create_random_file "$dir" "file_${depth}_$i.bin"
    done

    # Create subdirectories and recursively populate them
    for j in $(seq 1 "$num_dirs"); do
        sub_dir="$dir/dir_${depth}_$j"
        mkdir -p "$sub_dir"
        populate_directory "$sub_dir" $((depth + 1))
    done
}

# Start populating the root directory
populate_directory "$ROOT_DIR" 0

echo "Test directory structure created in $ROOT_DIR."
