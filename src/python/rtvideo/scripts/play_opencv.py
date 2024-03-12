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

def is_black_frame(frame):
    black_channel_rows = np.all(frame == 0, axis=1)
    black_rows = np.all(black_channel_rows, axis=1)
    number_of_black_rows = np.sum(black_rows)
    return number_of_black_rows > frame.shape[0] / 4

def main():
    parser = argparse.ArgumentParser(description='Video stream display using OpenCV with different backends.')
    parser.add_argument('source_type', choices=['v4l2', 'gstreamer', 'ffmpeg'], help='The type of video source to use.')
    parser.add_argument('--ffmpeg-args', default='-i /dev/video0', help='The arguments for FFmpeg. Ignored for v4l2 and gstreamer. Default is "-i /dev/video0".')
    parser.add_argument('--gstreamer-args', default='decklinkvideosrc ! videoconvert ! appsink', help='The arguments for GStreamer. Ignored for v4l2 and ffmpeg. Default is "decklinkvideosrc ! videoconvert ! appsink".')
    parser.add_argument('--frame-buffer-out', default='', help='The file to save the frame buffer to.')
    parser.add_argument('--v4l2-device', default='/dev/video0', help='The V4L2 device to use. Default is "/dev/video0".')
    parser.add_argument('--v4l2-fourcc', default='', help='Code to use V4L2. e.g. MJPG, YUYV, etc. Default is "".')
    parser.add_argument('--width', type=int, default=1920, help='Width of the video frames. Default is 1920.')
    parser.add_argument('--height', type=int, default=1080, help='Height of the video frames. Default is 1080.')
    parser.add_argument('--fps', type=int, default=30, help='Frames per second of the video. Default is 30.')
    parser.add_argument('--npy-input', default='', help='The file to load the frame buffer from. Default is "".')
    parser.add_argument('--autosave', action='store_true', help='Automatically save the frame buffer to the file specified by --frame-buffer-out.')

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
            # Get the FOURCC value
            fourcc = int(cap.get(cv2.CAP_PROP_FOURCC))
            fourcc_str = ''.join([chr(c) for c in (fourcc & 0xFF, (fourcc >> 8) & 0xFF, (fourcc >> 16) & 0xFF, (fourcc >> 24) & 0xFF)])
            print(f'Current FOURCC is:', fourcc_str)
            
            cap.set(cv2.CAP_PROP_FPS, args.fps)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            if args.v4l2_fourcc:
                cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*args.v4l2_fourcc))

                fourcc = int(cap.get(cv2.CAP_PROP_FOURCC))
                fourcc_str = ''.join([chr(c) for c in (fourcc & 0xFF, (fourcc >> 8) & 0xFF, (fourcc >> 16) & 0xFF, (fourcc >> 24) & 0xFF)])
                print(f'Updated FOURCC is:', fourcc_str)
        elif args.source_type == 'gstreamer':
            cap = cv2.VideoCapture(args.gstreamer_args, cv2.CAP_GSTREAMER)
    
    window_name = "Fullscreen"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.moveWindow(window_name, 0, 0)
    cv2.setWindowProperty(window_name, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)
    
    FRAME_BUFFER_SIZE = args.fps * 5
    frame_buffer = []
    success_message_display_time = 0

    if args.npy_input:
        frame_buffer = list(np.load(args.npy_input))

    try:
        frame_count = 0
        while True:
            if args.source_type == 'ffmpeg':
                frame = read_frame(process, args.width, args.height)
                if frame is None:
                    print("Failed to read frame from FFmpeg. Exiting...")
                    break
            elif args.npy_input:
                frame = frame_buffer[0]
                frame_buffer.pop(0)
            else:
                ret, frame = cap.read()
                if not ret:
                    print("Failed to read frame. Exiting...")
                    break
                
            if is_black_frame(frame):
                print("Black frame detected. Skipping...")
                continue

            frame_buffer.append(frame.copy())

            if frame_count % 100 == 0:
                print(f"Rendered {frame_count} frames")

            frame_count += 1
            text = f"SOURCE={args.source_type}, HEIGHT={args.height}, FPS={args.fps}"
            font = cv2.FONT_HERSHEY_SIMPLEX  # Font type
            org = (10, 30)  # Bottom-left corner of the text in pixels (x, y)
            fontScale = 1  # Font scale (font size)
            color = (255, 255, 255)  # Text color in BGR
            thickness = 2  # Thickness of the lines used to draw the text

            if len(frame_buffer) > FRAME_BUFFER_SIZE:
                frame_buffer.pop(0)

            # Use cv2.putText() to add text to the frame
            cv2.putText(frame, text, org, font, fontScale, color, thickness, cv2.LINE_AA)

            if success_message_display_time > 0:
                cv2.putText(frame, "Frame buffer saved!", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 3, (0, 255, 0), 3)
                success_message_display_time -= 1
                if args.autosave and success_message_display_time == 0:
                    print(f"Autosaved frame buffer to {args.frame_buffer_out}!")
                    break

            cv2.imshow(window_name, frame)
            key = cv2.waitKey(1) & 0xFF

            is_manual_save = args.frame_buffer_out and key == ord('s')
            is_auto_save = args.autosave and len(frame_buffer) == FRAME_BUFFER_SIZE and success_message_display_time == 0
            if key == ord('q'):
                break
            elif is_manual_save or is_auto_save:
                np.save(args.frame_buffer_out, np.array(frame_buffer))
                success_message_display_time = 60

    finally:
        if cap is not None:
            cap.release()
        if args.source_type == 'ffmpeg':
            process.terminate()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    main()