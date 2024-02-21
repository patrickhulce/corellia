from common.structs import Frame, PixelArrangement, PixelFormat


class PixelFormatTransformer:
    def __init__(self, target_pixel_format: PixelFormat, target_pixel_arrangement: PixelArrangement):
        self.target_pixel_format = target_pixel_format
        self.target_pixel_arrangement = target_pixel_arrangement

    def open(self):
        pass

    def close(self):
        pass

    def __call__(self, frame: Frame) -> Frame:
        assert frame.pixel_arrangement == self.target_pixel_arrangement

        if frame.pixel_format == self.target_pixel_format:
            return frame

        if self.target_pixel_format == PixelFormat.RGB_uint8:
            rgb_pixels = frame.as_rgb()
            return Frame(
                pixels=rgb_pixels,
                pixel_format=self.target_pixel_format,
                pixel_arrangement=self.target_pixel_arrangement,
                objects=frame.objects)

        raise NotImplementedError(f"Conversion from {frame.pixel_format} to {self.target_pixel_format} is not supported")