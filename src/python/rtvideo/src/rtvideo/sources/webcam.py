from collections.abc import Iterator
from rtvideo.common.structs import Frame, PixelArrangement, PixelFormat

import cv2

DEFAULT_WIDTH = 1280
DEFAULT_HEIGHT = 720
DEFAULT_FPS = 30

class WebcamSource:
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

    def __iter__(self) -> Iterator[Frame]:
        return self

    def __next__(self) -> Frame:
        ret, pixels = self.capture.read()
        if not ret:
            raise StopIteration
        return Frame(pixels, PixelFormat.BGR_uint8, PixelArrangement.HWC, [])