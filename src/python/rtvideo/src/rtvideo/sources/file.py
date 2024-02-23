from collections.abc import Iterator
from rtvideo.common.structs import Frame, FrameSource, PixelArrangement, PixelFormat

import cv2

from rtvideo.common.timer import NoopTimerSpan

class FileSource(FrameSource):
    def __init__(self, file_path: str, loop: bool = True):
        self.loop = loop
        self.file_path = file_path
    
    def open(self) -> None:
        self.capture = cv2.VideoCapture(self.file_path)

        if not self.capture.isOpened():
            raise RuntimeError("Could not open webcam")

    def close(self) -> None:
        self.capture.release()

    def __next__(self) -> Frame:
        span = NoopTimerSpan() if self.timer is None else self.timer.span('frame')
        span.start()
        
        ret, pixels = self.capture.read()
        if not ret:
            if self.loop:
                self.capture.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, pixels = self.capture.read()
                if not ret:
                    raise StopIteration
            else:
                raise StopIteration
            
        return Frame(pixels, PixelFormat.BGR_uint8, PixelArrangement.HWC, [], span=span)