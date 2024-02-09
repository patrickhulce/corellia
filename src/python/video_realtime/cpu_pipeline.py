import logging
import queue
import threading
from dataclasses import dataclass
import time
from typing import List, Tuple

import cv2
import numpy as np

logging.basicConfig(level=logging.INFO)

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
    frame: np.ndarray


@dataclass
class ObjectQueueItem:
    frame: np.ndarray
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

def configure_camera():
    capture = cv2.VideoCapture(0)  # 0 represents the default webcam, you can change it if you have multiple cameras

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


def read_frame_from_camera(capture: cv2.VideoCapture) -> np.ndarray:
    ret, frame = capture.read()
    if not ret:
        logging.error("Error: Could not read frame from webcam")
        exit()

    frame = cv2.flip(frame, 1)
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    return rgb_frame


def thread_loop(pipeline, target_fn):
    try:
        while not pipeline.exit_signal.is_set():
            try:
                target_fn()
            except queue.Empty:
                logging.exception("Queue is empty!")
                continue
            except queue.Full:
                logging.exception("Queue is full!")
                continue
    finally:
        pipeline.exit_signal.set()


def frame_reader(pipeline):
    capture = configure_camera()

    def read_frame():
        with pipeline.timer.span('read_frame'):
            frame_from_camera = read_frame_from_camera(capture)
        logging.info("Putting frame in queue")
        pipeline.in_frame_queue.put(
            InFrameQueueItem(frame_from_camera), timeout=QUEUE_TIMEOUT
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
            OutFrameQueueItem(object_data.frame), timeout=QUEUE_TIMEOUT
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
