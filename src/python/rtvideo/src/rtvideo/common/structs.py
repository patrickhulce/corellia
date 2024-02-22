from collections.abc import Iterator
from dataclasses import dataclass
from enum import Enum
from typing import List, TypeVar, Generic
from rtvideo.common.errors import assert_hwc

import cv2
import numpy as np

TObject = TypeVar('TObject')

class PixelFormat(Enum):
    RGB_uint8 = 'RGB_uint8'
    RGBA_uint8 = 'RGBA_uint8'
    RGB_float32 = 'RGB_float32'
    RGBA_float32 = 'RGBA_float32'
    BGR_uint8 = 'BGR_uint8'
    BGRA_uint8 = 'BGRA_uint8'


class PixelArrangement(Enum):
    CHW = 'CHW'
    HWC = 'HWC'


@dataclass
class BoundingBox:
    left: int
    top: int
    width: int
    height: int

    # Support enumeration as x, y, w, h
    def __iter__(self):
        return iter([self.left, self.top, self.width, self.height])

@dataclass
class Frame(Generic[TObject]):
    pixels: np.ndarray
    pixel_format: PixelFormat
    pixel_arrangement: PixelArrangement
    objects: List[TObject]

    def copy(self):
        return Frame(
            pixels=self.pixels,
            pixel_format=self.pixel_format,
            pixel_arrangement=self.pixel_arrangement,
            objects=self.objects.copy()
        )

    @property
    def width(self):
        if self.pixel_arrangement == PixelArrangement.CHW:
            return self.pixels.shape[2]
        elif self.pixel_arrangement == PixelArrangement.HWC:
            return self.pixels.shape[1]

        raise ValueError(f"Unsupported pixel arrangement: {self.pixel_arrangement}")

    @property
    def height(self):
        if self.pixel_arrangement == PixelArrangement.CHW:
            return self.pixels.shape[1]
        elif self.pixel_arrangement == PixelArrangement.HWC:
            return self.pixels.shape[0]

        raise ValueError(f"Unsupported pixel arrangement: {self.pixel_arrangement}")

    @property
    def channels(self):
        if self.pixel_arrangement == PixelArrangement.CHW:
            return self.pixels.shape[0]
        elif self.pixel_arrangement == PixelArrangement.HWC:
            return self.pixels.shape[2]

        raise ValueError(f"Unsupported pixel arrangement: {self.pixel_arrangement}")

    def as_rgb(self) -> np.ndarray:
        if self.pixel_format == PixelFormat.RGB_uint8:
            return self.pixels
        elif self.pixel_format == PixelFormat.RGB_float32:
            return (self.pixels.clip(0, 1) * 255).astype(np.uint8)
        elif self.pixel_format == PixelFormat.BGR_uint8:
            assert_hwc(self.pixels)
            return cv2.cvtColor(self.pixels, cv2.COLOR_BGR2RGB)        
        elif self.pixel_format == PixelFormat.RGBA_uint8:
            assert_hwc(self.pixels)
            return cv2.cvtColor(self.pixels, cv2.COLOR_RGBA2RGB)

        raise ValueError(f"Unsupported pixel format: {self.pixel_format}")

    def as_rgba(self) -> np.ndarray:
        if self.pixel_format == PixelFormat.RGBA_uint8:
            return self.pixels
        elif self.pixel_format == PixelFormat.RGBA_float32:
            return (self.pixels.clip(0, 1) * 255).astype(np.uint8)
        elif self.pixel_format == PixelFormat.BGRA_uint8:
            assert_hwc(self.pixels)
            return cv2.cvtColor(self.pixels, cv2.COLOR_BGRA2RGBA)
        elif self.pixel_format == PixelFormat.RGB_uint8:
            assert_hwc(self.pixels)
            return np.dstack([self.pixels, np.full((self.height, self.width), 255, dtype=np.uint8)])

        raise ValueError(f"Unsupported pixel format: {self.pixel_format}")

    def as_bgr(self) -> np.ndarray:
        if self.pixel_format == PixelFormat.BGR_uint8:
            return self.pixels
        
        rgb_pixels = self.as_rgb()
        assert_hwc(rgb_pixels)
        return cv2.cvtColor(rgb_pixels, cv2.COLOR_RGB2BGR)
    
    def as_bgra(self) -> np.ndarray:
        if self.pixel_format == PixelFormat.BGRA_uint8:
            return self.pixels
        
        rgba_pixels = self.as_rgba()
        assert_hwc(rgba_pixels)
        return cv2.cvtColor(rgba_pixels, cv2.COLOR_RGBA2BGRA)

class FrameSource:
    def open(self):
        pass

    def close(self):
        pass

    def __iter__(self) -> Iterator[Frame]:
        return self

    def __next__(self) -> Frame:
        raise NotImplementedError

class FrameProcessor:
    def open(self):
        pass

    def close(self):
        pass

    def __call__(self, frame: Frame) -> Frame:
        raise NotImplementedError