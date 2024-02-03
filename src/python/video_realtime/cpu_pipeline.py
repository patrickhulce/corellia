import logging
import queue
import threading
from dataclasses import dataclass
from typing import List, Tuple

import cv2
import numpy as np

logging.basicConfig(level=logging.INFO)

TARGET_FPS = 30
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


@dataclass
class Pipeline:
    in_frame_queue: queue.Queue[InFrameQueueItem] = queue.Queue(maxsize=1)
    objects_queue: queue.Queue[ObjectQueueItem] = queue.Queue(maxsize=1)
    out_frame_queue: queue.Queue[OutFrameQueueItem] = queue.Queue(maxsize=1)

    exit_signal = threading.Event()


def read_frame_from_camera() -> np.ndarray:
    return np.random.rand(480, 640, 3)


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
    def read_frame():
        frame_from_camera = read_frame_from_camera()
        logging.info("Putting frame in queue")
        pipeline.in_frame_queue.put(
            InFrameQueueItem(frame_from_camera), timeout=QUEUE_TIMEOUT
        )

    thread_loop(pipeline, read_frame)
    logging.info("Frame reader loop ended")


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


main()
