import logging
import queue
import threading
from dataclasses import dataclass
import time
from typing import List, Tuple

import cv2
import cupy as cp
import numpy as np

logging.basicConfig(level=logging.INFO)

SOURCE = 'camera-v4l2' # 'camera-v4l2', 'camera-gstreamer', or 'file'
TARGET_FPS = 30
TARGET_WIDTH = 1280
TARGET_HEIGHT = 720
QUEUE_TIMEOUT = 1 / TARGET_FPS


@dataclass
class BoundingBox:
    left: int
    top: int
    width: int
    height: int


@dataclass
class InFrameQueueItem:
    frame: cp.ndarray


@dataclass
class ObjectQueueItem:
    frame: cp.ndarray
    objects: List[Tuple[float, float, float, float]]


@dataclass
class OutFrameQueueItem:
    frame: np.ndarray

# A timer class that allows us to measure arbitrary time intervals using `with timer.span('name'):` blocks
class Timer:
    def __init__(self):
        self.spans = []

    def span(self, name):
        class TimerSpan:
            def __enter__(self):
                self.name = name
                self.start = time.time()
                return self

            def __exit__(self, type, value, traceback):
                self.end = time.time()
                self.duration = self.end - self.start

        span = TimerSpan()
        self.spans.append(span)
        return span

    def __str__(self):
        spans_by_name = {}
        for span in self.spans:
            if span.name not in spans_by_name:
                spans_by_name[span.name] = []
            spans_by_name[span.name].append(span)

        summary = ''
        for name, spans in spans_by_name.items():
            sorted_durations = sorted(span.duration * 1000 for span in spans)

            # Summary statistics
            p50 = sorted_durations[int(len(spans) * 0.5)]
            p95 = sorted_durations[int(len(spans) * 0.95)]
            p99 = sorted_durations[int(len(spans) * 0.99)]

            summary = f"{summary}{name}: p50={p50:.2f}ms, p95={p95:.2f}ms, p99={p99:.2f}ms\n"

        return summary


@dataclass
class Pipeline:
    in_frame_queue: queue.Queue[InFrameQueueItem] = queue.Queue(maxsize=1)
    objects_queue: queue.Queue[ObjectQueueItem] = queue.Queue(maxsize=1)
    out_frame_queue: queue.Queue[OutFrameQueueItem] = queue.Queue(maxsize=1)

    timer = Timer()
    exit_signal = threading.Event()

def get_fourcc(capture):
    # Numeric FourCC value
    numeric_fourcc = int(capture.get(cv2.CAP_PROP_FOURCC))

    # Convert to string representation
    fourcc_str = chr((numeric_fourcc & 255)) + \
                chr(((numeric_fourcc >> 8) & 255)) + \
                chr(((numeric_fourcc >> 16) & 255)) + \
                chr(((numeric_fourcc >> 24) & 255))

    return fourcc_str

def configure_camera_gstreamer():
    gst_str = ("v4l2src device=/dev/video0 ! " 
            f"video/x-raw, width=${TARGET_WIDTH}, height=${TARGET_HEIGHT}, framerate=${TARGET_FPS}/1 ! "
            "videoconvert ! "
            "appsink")
    capture = cv2.VideoCapture(gst_str, cv2.CAP_GSTREAMER)
    return capture

def configure_camera_v4l2():
    capture = cv2.VideoCapture(0, cv2.CAP_V4L2)

    logging.info(f"Default 4CC {get_fourcc(capture)}")

    # Set FourCC to MJPG (MJPEG) - this is the most suitable for 30 fps capture
    capture.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter.fourcc('M', 'J', 'P', 'G'))

    logging.info(f"Configured 4CC {get_fourcc(capture)}")

    # Check if the webcam is opened successfully
    if not capture.isOpened():
        logging.error("Error: Could not open webcam")
        exit()

    # Set the frame width and height
    capture.set(cv2.CAP_PROP_FRAME_WIDTH, TARGET_WIDTH)
    capture.set(cv2.CAP_PROP_FRAME_HEIGHT, TARGET_HEIGHT)

    # Set the frame rate
    capture.set(cv2.CAP_PROP_FPS, TARGET_FPS)

    # Get the actual frame width and height
    actual_width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))

    if actual_width != TARGET_WIDTH or actual_height != TARGET_HEIGHT:
        logging.error(f"Error: Camera did not set the frame to {TARGET_WIDTH}x{TARGET_HEIGHT}")
        exit()

    return capture

def configure_capture():
    if SOURCE == 'camera-v4l2':
        capture = configure_camera_v4l2()
    elif SOURCE == 'camera-gstreamer':
        capture = configure_camera_gstreamer()
    elif SOURCE == 'file':
        capture = cv2.VideoCapture('.data/input.mp4')
    else:  
        logging.error("Error: Invalid source")
        exit()

    return capture

def read_frame_from_camera(capture: cv2.VideoCapture) -> np.ndarray:
    def read(second_attempt=False):
        logging.info('Reading frame...')
        ret, frame = capture.read()
        if not ret:
            if SOURCE == 'file' and not second_attempt:
                # If we're reading from a file, loop back to the beginning
                capture.set(cv2.CAP_PROP_POS_FRAMES, 0)
                return read(second_attempt=True)
                
            logging.error("Error: Could not read frame from webcam")
            exit()

        return frame

    return read()


def thread_loop(pipeline, target_fn):
    try:
        while not pipeline.exit_signal.is_set():
            try:
                target_fn()
            except queue.Empty:
                logging.warn("Queue is empty!")
                continue
            except queue.Full:
                logging.warn("Queue is full!")
                continue
    finally:
        pipeline.exit_signal.set()


def frame_reader(pipeline):
    capture = configure_capture()

    def read_frame():
        with pipeline.timer.span('read_frame'):
            frame_from_camera = read_frame_from_camera(capture)

        with pipeline.timer.span('upload_frame'):
            gpu_frame = cp.asarray(frame_from_camera)

        logging.info("Putting frame in queue")
        pipeline.in_frame_queue.put(
            InFrameQueueItem(gpu_frame), timeout=QUEUE_TIMEOUT
        )
    
    try:
        thread_loop(pipeline, read_frame)
        logging.info("Frame reader loop ended")
    finally:
        capture.release()


def detector(pipeline):
    def detect_objects():
        in_frame = pipeline.in_frame_queue.get(timeout=QUEUE_TIMEOUT)
        logging.info("Got frame from queue, detecting objects")
        objects = []

        for i in range(5):
            objects.append(BoundingBox(left=i * 30, top=i * 30, width=30, height=30))

        logging.info("Putting objects in queue")
        pipeline.objects_queue.put(
            ObjectQueueItem(in_frame.frame, objects), timeout=QUEUE_TIMEOUT
        )

    thread_loop(pipeline, detect_objects)
    logging.info("Detector loop ended")


def drawer(pipeline):
    def draw():
        object_data = pipeline.objects_queue.get(timeout=QUEUE_TIMEOUT)
        logging.info("Got objects from queue, drawing")

        for object in object_data.objects:
            object_data.frame[
                object.top : object.top + object.height,
                object.left : object.left + object.width,
            ] = 0

        logging.info("Putting out frame in queue")
        pipeline.out_frame_queue.put(
            OutFrameQueueItem(object_data.frame.get()), timeout=QUEUE_TIMEOUT
        )

    thread_loop(pipeline, draw)
    logging.info("Drawer loop ended")


def render(pipeline):
    def render_frame():
        frame = pipeline.out_frame_queue.get(timeout=QUEUE_TIMEOUT)
        logging.info("Got frame from queue, rendering")

        cv2.imshow("Video", frame.frame)

        # Exit on 'q' key
        if cv2.waitKey(1) & 0xFF == ord("q"):
            pipeline.exit_signal.set()

    thread_loop(pipeline, render_frame)
    logging.info("Render loop ended")


def main():
    pipeline = Pipeline()
    frame_reader_thread = threading.Thread(target=frame_reader, args=(pipeline,))
    detector_thread = threading.Thread(target=detector, args=(pipeline,))
    drawer_thread = threading.Thread(target=drawer, args=(pipeline,))

    frame_reader_thread.start()
    # Sleep for a few seconds while we wait for camera to start up
    print("Sleeping for 2 seconds to let camera start up...")
    time.sleep(2)

    detector_thread.start()
    drawer_thread.start()

    logging.info("Render loop started!")
    render(pipeline)
    logging.info("Render loop ended, shutting down...")

    # Clean up and exit
    pipeline.exit_signal.set()
    cv2.destroyAllWindows()
    logging.info("Waiting for frame reader to finish...")
    frame_reader_thread.join()
    logging.info("Waiting for detector to finish...")
    detector_thread.join()
    logging.info("Waiting for drawer to finish...")
    drawer_thread.join()
    logging.info("All threads finished!")
    print(pipeline.timer)


main()
