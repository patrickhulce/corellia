import os
import battery_runner

SCRIPTS_DIR = os.path.dirname(os.path.realpath(__file__))

HOME_DIR = os.environ["HOME"]
FFPLAY = f"{HOME_DIR}/code/ffmpeg/bin/ffplay"
GSTREAM_SRC = "decklinkvideosrc ! videoconvert"

FFMPEG_ARGS = "-f decklink -i 'DeckLink SDI 4K'"
WIDTH=1920
HEIGHT=1080
# WIDTH=4096
# HEIGHT=2160
FPS=30
# FPS=60

def main():
    battery_runner.run_scripts([
        ("ffplay", f"{FFPLAY} {FFMPEG_ARGS}", ),
        ("gstreamer", f"gst-launch-1.0 {GSTREAM_SRC} ! autovideosink",),
        # ("opencv-v4l2", "python3 play_opencv.py v4l2", ),
        ("opencv-gstreamer", f'python3 {SCRIPTS_DIR}/play_opencv.py gstreamer --fps={FPS} "--gstreamer-args={GSTREAM_SRC} ! appsink"', ),
        ("opencv-ffmpeg", f'python3 {SCRIPTS_DIR}/play_opencv.py ffmpeg --fps={FPS} "--ffmpeg-args={FFMPEG_ARGS}"', ),
    ])

if __name__ == "__main__":
    main()
