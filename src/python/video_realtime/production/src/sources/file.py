from collections.abc import Iterator
from common.structs import Frame, PixelArrangement, PixelFormat

import cv2


class FileSource:
    def __init__(self, file_path: str, loop: bool = True):
        self.loop = loop
        self.file_path = file_path
    
    def open(self) -> None:
        self.capture = cv2.VideoCapture(self.file_path)

        if not self.capture.isOpened():
            raise RuntimeError("Could not open webcam")

    def close(self) -> None:
        self.capture.release()

    def __iter__(self) -> Iterator[Frame]:
        return self

    def __next__(self) -> Frame:
        ret, pixels = self.capture.read()
        if not ret:
            if self.loop:
                self.capture.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, pixels = self.capture.read()
                if not ret:
                    raise StopIteration
            else:
                raise StopIteration
            
        return Frame(pixels, PixelFormat.BGR_uint8, PixelArrangement.HWC, [])