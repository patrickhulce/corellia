import os
import battery_runner

SCRIPTS_DIR = os.path.dirname(os.path.realpath(__file__))

HOME_DIR = os.environ["HOME"]
FFPLAY = f"{HOME_DIR}/code/ffmpeg/bin/ffplay"
GSTREAM_SRC = "decklinkvideosrc ! videoconvert"
GSTREAM_SRC = "v4l2src device=/dev/video2 ! videoconvert"

FFMPEG_ARGS = "-f decklink -i 'DeckLink SDI 4K'"
FFMPEG_ARGS = "-f v4l2 -i /dev/video2"
WIDTH=1280
HEIGHT=960
# WIDTH=1920
# HEIGHT=1080
# WIDTH=4096
# WIDTH=3840
# HEIGHT=2160
# FPS=60
FPS=30
# FPS=24

PIXELFORMAT="YUYV"
# PIXELFORMAT="BGR3"

def main():
    battery_runner.run_scripts([
        ("v4l2-reset", f"v4l2-ctl --set-fmt-video=width={WIDTH},height={HEIGHT},pixelformat='{PIXELFORMAT}'", ),
        ("ffplay", f"{FFPLAY} {FFMPEG_ARGS}", ),
        ("v4l2-reset", f"v4l2-ctl --set-fmt-video=width={WIDTH},height={HEIGHT},pixelformat='{PIXELFORMAT}'", ),
        ("gstreamer", f"gst-launch-1.0 {GSTREAM_SRC} ! autovideosink",),
        ("v4l2-reset", f"v4l2-ctl --set-fmt-video=width={WIDTH},height={HEIGHT},pixelformat='{PIXELFORMAT}'", ),
        ("opencv-v4l2", f"python3 {SCRIPTS_DIR}/play_opencv.py v4l2 --width={WIDTH} --height={HEIGHT} --fps={FPS}", ),
        ("v4l2-reset", f"v4l2-ctl --set-fmt-video=width={WIDTH},height={HEIGHT},pixelformat='{PIXELFORMAT}'", ),
        ("opencv-v4l2-mjpeg", f"python3 {SCRIPTS_DIR}/play_opencv.py v4l2 --width={WIDTH} --height={HEIGHT} --fps={FPS} --v4l2-mjpeg", ),
        ("v4l2-reset", f"v4l2-ctl --set-fmt-video=width={WIDTH},height={HEIGHT},pixelformat='{PIXELFORMAT}'", ),
        ("opencv-gstreamer", f'python3 {SCRIPTS_DIR}/play_opencv.py gstreamer --width={WIDTH} --height={HEIGHT} --fps={FPS} "--gstreamer-args={GSTREAM_SRC} ! appsink"', ),
        ("v4l2-reset", f"v4l2-ctl --set-fmt-video=width={WIDTH},height={HEIGHT},pixelformat='{PIXELFORMAT}'", ),
        ("opencv-ffmpeg", f'python3 {SCRIPTS_DIR}/play_opencv.py ffmpeg --width={WIDTH} --height={HEIGHT} --fps={FPS} "--ffmpeg-args={FFMPEG_ARGS}"', ),
    ])

if __name__ == "__main__":
    main()

