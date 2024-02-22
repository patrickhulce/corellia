from rtvideo.common.structs import Frame, FrameProcessor


class ObjectMarker(FrameProcessor):
    def __str__(self) -> str:
        return "ObjectMarker()"

    def __call__(self, frame: Frame) -> Frame:
        for object in frame.objects:
            frame.pixels[
                object.top : object.top + 10,
                object.left : object.left + 10,
            ] = 0

        return frame