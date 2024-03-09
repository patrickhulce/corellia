import os
import cv2
import numpy as np
import subprocess
import argparse

HOME_DIR = os.environ["HOME"]
FFMPEG = f"{HOME_DIR}/code/ffmpeg/bin/ffmpeg"

def open_ffmpeg_source(width, height, fps, ffmpeg_args):
    command = f'{FFMPEG} {ffmpeg_args} -f image2pipe -pix_fmt bgr24 -vcodec rawvideo -an -'
    print(f"Running FFmpeg command: {command}")
    process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, bufsize=10**8)
    return process, width, height, fps

def read_frame(process, width, height):
    frame_size = width * height * 3
    frame_bytes = read_exact(process.stdout, frame_size)
    if not frame_bytes:
        return None
    frame = np.frombuffer(frame_bytes, np.uint8).reshape((height, width, 3))
    return frame.copy()


def read_exact(pipe: subprocess.Popen, size: int) -> bytes:
    buffer = b""
    while len(buffer) < size:
        data = pipe.read(size - len(buffer))
        if not data:
            raise EOFError(
                f"Pipe closed before {size} bytes could be read, only read {len(buffer)} bytes"
            )
        buffer += data
    return buffer

def main():
    parser = argparse.ArgumentParser(description='Video stream display using OpenCV with different backends.')
    parser.add_argument('source_type', choices=['v4l2', 'gstreamer', 'ffmpeg'], help='The type of video source to use.')
    parser.add_argument('--ffmpeg-args', default='-i /dev/video0', help='The arguments for FFmpeg. Ignored for v4l2 and gstreamer. Default is "-i /dev/video0".')
    parser.add_argument('--gstreamer-args', default='decklinkvideosrc ! videoconvert ! appsink', help='The arguments for GStreamer. Ignored for v4l2 and ffmpeg. Default is "decklinkvideosrc ! videoconvert ! appsink".')
    parser.add_argument('--v4l2-device', default='/dev/video0', help='The V4L2 device to use. Default is "/dev/video0".')
    parser.add_argument('--v4l2-mjpeg', action='store_true', help='Use MJPEG format for V4L2. Default is False.')
    parser.add_argument('--width', type=int, default=1920, help='Width of the video frames. Default is 1920.')
    parser.add_argument('--height', type=int, default=1080, help='Height of the video frames. Default is 1080.')
    parser.add_argument('--fps', type=int, default=30, help='Frames per second of the video. Default is 30.')

    args = parser.parse_args()

    if args.source_type == 'ffmpeg':
        print(f"Opening FFmpeg source with width={args.width}, height={args.height}, fps={args.fps}, and args={args.ffmpeg_args}")
        process, width, height, fps = open_ffmpeg_source(args.width, args.height, args.fps, args.ffmpeg_args)

    cap = None
    if args.source_type in ['v4l2', 'gstreamer']:
        if args.source_type == 'v4l2':
            cap = cv2.VideoCapture(args.v4l2_device, cv2.CAP_V4L2)
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)
            cap.set(cv2.CAP_PROP_FPS, args.fps)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            if args.v4l2_mjpeg:
                cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
        elif args.source_type == 'gstreamer':
            cap = cv2.VideoCapture(args.gstreamer_args, cv2.CAP_GSTREAMER)
    
    window_name = "Fullscreen"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.moveWindow(window_name, 0, 0)
    cv2.setWindowProperty(window_name, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)
    
    try:
        frame_count = 0
        while True:
            if args.source_type == 'ffmpeg':
                frame = read_frame(process, args.width, args.height)
                if frame is None:
                    print("Failed to read frame from FFmpeg. Exiting...")
                    break
            else:
                ret, frame = cap.read()
                if not ret:
                    print("Failed to read frame. Exiting...")
                    break

            if frame_count % 100 == 0:
                print(f"Rendered {frame_count} frames")

            frame_count += 1
            text = f"SOURCE={args.source_type}, HEIGHT={args.height}, FPS={args.fps}"
            font = cv2.FONT_HERSHEY_SIMPLEX  # Font type
            org = (10, 30)  # Bottom-left corner of the text in pixels (x, y)
            fontScale = 1  # Font scale (font size)
            color = (255, 255, 255)  # Text color in BGR
            thickness = 2  # Thickness of the lines used to draw the text

            # Use cv2.putText() to add text to the frame
            cv2.putText(frame, text, org, font, fontScale, color, thickness, cv2.LINE_AA)

            cv2.imshow(window_name, frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    finally:
        if cap is not None:
            cap.release()
        if args.source_type == 'ffmpeg':
            process.terminate()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    main()