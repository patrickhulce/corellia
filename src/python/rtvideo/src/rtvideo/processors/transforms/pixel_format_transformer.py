from rtvideo.common.structs import Frame, FrameProcessor, PixelFormat


class PixelFormatTransformer(FrameProcessor):
    def __init__(self, target_pixel_format: PixelFormat):
        self.target_pixel_format = target_pixel_format

    def __str__(self) -> str:
        return f"PixelFormatTransformer(target_pixel_format={self.target_pixel_format})"

    def __call__(self, frame: Frame) -> Frame:
        if frame.pixel_format == self.target_pixel_format:
            return frame

        if self.target_pixel_format == PixelFormat.RGB_uint8:
            rgb_pixels = frame.as_rgb()
            return Frame(
                pixels=rgb_pixels,
                pixel_format=self.target_pixel_format,
                pixel_arrangement=frame.pixel_arrangement,
                objects=frame.objects,
                span=frame.span)

        raise NotImplementedError(f"Conversion from {frame.pixel_format} to {self.target_pixel_format} is not supported")