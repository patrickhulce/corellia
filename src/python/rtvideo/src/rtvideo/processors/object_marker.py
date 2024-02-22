from rtvideo.common.structs import Frame


class ObjectMarker:
    def open(self):
        pass

    def close(self):
        pass

    def __call__(self, frame: Frame) -> Frame:
        for object in frame.objects:
            frame.pixels[
                object.top : object.top + 10,
                object.left : object.left + 10,
            ] = 0

        return frame