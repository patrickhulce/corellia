from collections.abc import Iterator
from rtvideo.common.structs import Frame, FrameSource, PixelArrangement, PixelFormat

import cv2

from rtvideo.common.timer import NoopTimerSpan

DEFAULT_WIDTH = 1280
DEFAULT_HEIGHT = 720
DEFAULT_FPS = 30

class WebcamSource(FrameSource):
    def __init__(self, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, fps = DEFAULT_FPS):
        self.width = width
        self.height = height
        self.fps = fps
    
    def open(self) -> None:
        self.capture = cv2.VideoCapture(0, cv2.CAP_V4L2)
        self.capture.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self.capture.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        self.capture.set(cv2.CAP_PROP_FPS, self.fps)
        self.capture.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter.fourcc('M', 'J', 'P', 'G'))

        if not self.capture.isOpened():
            raise RuntimeError("Could not open webcam")

    def close(self) -> None:
        self.capture.release()

    def __next__(self) -> Frame:
        ret, pixels = self.capture.read()
        if not ret:
            raise StopIteration
        span = NoopTimerSpan() if self.timer is None else self.timer.span('frame')
        span.start()
        return Frame(pixels, PixelFormat.BGR_uint8, PixelArrangement.HWC, [], span=span)