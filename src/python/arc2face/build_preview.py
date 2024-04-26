
import os
import shutil

import tqdm

POSE_LIST = []
POSE_LIST_FILE = "poses.txt"
INPUT_DIR = "/home/patrick/data/arc2face/out"
OUTPUT_DIR = ".data/complete"


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(POSE_LIST_FILE) as f:
        for line in f:
            line = line.strip()
            if line:
                POSE_LIST.append(line)

    files_to_process = os.listdir(INPUT_DIR)
    files_to_process.sort()
    frame_number = 1
    for file in tqdm.tqdm(files_to_process):
        if not file.endswith(".jpg"):
            continue

        pose_number = file.split("__")[1].split("_")[1]
        if pose_number not in POSE_LIST:
            continue

        input_path = os.path.join(INPUT_DIR, file)
        output_file = f"frame_{frame_number:04d}.jpg"
        output_path = os.path.join(OUTPUT_DIR, output_file)
        shutil.copyfile(input_path, output_path)
        frame_number += 1


main()
