import os
import sys
import battery_runner

SCRIPTS_DIR = os.path.dirname(os.path.realpath(__file__))

HOME_DIR = os.environ["HOME"]
FFMPEG = f"{HOME_DIR}/code/ffmpeg/bin/ffmpeg"

WIDTH=1920
HEIGHT=1080
FPS=24

def main():
    # Get label from first CLI argument.
    label = sys.argv[1] if len(sys.argv) > 1 else "color-battery"

    output_files = [
        f"{label}-v4l2-bgr3.npy",
        f"{label}-v4l2-yuyv.npy",
        f"{label}-v4l2-mjpg.npy",
        f"{label}-ffmpeg-bgr.npy",
        f"{label}-ffmpeg-yuyv.npy",
        f"{label}-ffmpeg-bgr.raw",
        f"{label}-ffmpeg-yuyv.raw",
    ]

    battery_runner.run_scripts([
        ("v4l2-reset", f"v4l2-ctl --set-fmt-video=width={WIDTH},height={HEIGHT},pixelformat='YUYV'", ),
        ("opencv-v4l2", f"python3 {SCRIPTS_DIR}/play_opencv.py v4l2 --width={WIDTH} --height={HEIGHT} --fps={FPS} --v4l2-fourcc=BGR3 --frame-buffer-out={output_files[0]} --autosave", ),
        ("opencv-v4l2", f"python3 {SCRIPTS_DIR}/play_opencv.py v4l2 --width={WIDTH} --height={HEIGHT} --fps={FPS} --v4l2-fourcc=YUYV --frame-buffer-out={output_files[1]} --autosave", ),
        ("opencv-v4l2-mjpeg", f"python3 {SCRIPTS_DIR}/play_opencv.py v4l2 --width={WIDTH} --height={HEIGHT} --fps={FPS} --v4l2-fourcc=MJPG --frame-buffer-out={output_files[2]} --autosave", ),
        ("opencv-ffmpeg-bgr", f'python3 {SCRIPTS_DIR}/play_opencv.py ffmpeg --width={WIDTH} --height={HEIGHT} --fps={FPS} "--ffmpeg-args=-f v4l2 -input_format bgr24 -i /dev/video0" --frame-buffer-out={output_files[3]} --autosave', ),
        ("opencv-ffmpeg-yuyv", f'python3 {SCRIPTS_DIR}/play_opencv.py ffmpeg --width={WIDTH} --height={HEIGHT} --fps={FPS} "--ffmpeg-args=-f v4l2 -input_format yuyv422 -i /dev/video0" --frame-buffer-out={output_files[4]} --autosave', ),
        ("ffmpeg-bgr", f"{FFMPEG} -f v4l2 -input_format bgr24 -t 5 -i /dev/video0 -f rawvideo -c:v copy -y {output_files[5]}", ),
        ("ffmpeg-yuyv", f"{FFMPEG} -f v4l2 -input_format yuyv422 -t 5 -i /dev/video0 -f rawvideo -c:v copy -y {output_files[6]}", ),
    ], skip_confirmation=True)

    play_scripts = []
    for output_file in output_files:
        pix_fmt = "bgr24" if 'bgr' in output_file else "yuyv422"
        play_arg = f"--npy-input={output_file} v4l2" if output_file.endswith(".npy") else f'ffmpeg --ffmpeg-args="-f rawvideo -pix_fmt {pix_fmt} -s {WIDTH}x{HEIGHT} -i {output_file}"'
        play_scripts.append((f"play {output_file}", f"python3 {SCRIPTS_DIR}/play_opencv.py --width={WIDTH} --height={HEIGHT} --fps={FPS} {play_arg}", ))
    battery_runner.run_scripts(play_scripts, skip_confirmation=True)

if __name__ == "__main__":
    main()

