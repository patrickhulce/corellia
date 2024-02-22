import cv2
import logging

import numpy as np

from rtvideo.common.structs import BoundingBox, Frame, FrameProcessor, PixelArrangement, PixelFormat
from rtvideo.common.tensorrt_context import TensorRTContext
from rtvideo.common.timer import NoopTimerSpan, TimerSpan

log = logging.getLogger(__name__)


class FaceSwapperTensorRT(FrameProcessor):
    model_path: str
    tensorrt: TensorRTContext

    def __init__(self, model_path: str):
        self.model_path = model_path
        self.tensorrt = TensorRTContext(model_path)

    def __str__(self) -> str:
        return f"FaceSwapperTensorRT(model_path={self.model_path})"

    def open(self):
        self.tensorrt.open()

    def close(self):
        self.tensorrt.close()

    def _composite_images(self, background: np.ndarray, foreground: np.ndarray, position: BoundingBox) -> np.ndarray:
        """
        Composite a foreground image (HWC, RGBA, uint8) 
        onto the background image (HWC, RGBA, uint8)
        at the specified position.
        """
        x, y, w, h = position
        foreground = cv2.resize(foreground, (w, h))
        # FIXME: Implement the compositing algorithm instead of pasting foreground onto background.
        background[y:y+h, x:x+w] = foreground
        return background

    def __call__(self, frame: Frame) -> Frame:
        assert frame.pixel_arrangement == PixelArrangement.HWC
        assert frame.pixel_format == PixelFormat.RGB_uint8

        if len(frame.objects) == 0:
            return frame
        
        face = frame.objects[0]
        face_input_rgb_hwc_uint8 = frame.pixels[
            face.top : face.top + face.height,
            face.left : face.left + face.width,
        ]

        with self.active_span.child('preprocess_frame'):
            face_input_rgb_hwc_uint8 = cv2.resize(face_input_rgb_hwc_uint8, (512, 512))
            face_input_rgb_chw_float32 = face_input_rgb_hwc_uint8.transpose((2, 0, 1)).astype(np.float32) / 255.0
            face_input_rgb_chw_float32 = np.expand_dims(face_input_rgb_chw_float32, axis=0)

        with self.active_span.child('run_tensorrt'):
            face_rgba_chw_float32 = self.tensorrt.run(face_input_rgb_chw_float32)

        with self.active_span.child('postprocess_frame'):
            face_rgba_hwc_uint8 = (face_rgba_chw_float32.clip(0, 1) * 255).astype(np.uint8).transpose((1, 2, 0))
            frame_rgba_hwc_uint8 = frame.as_rgba()

        with self.active_span.child('composite_images'):
            self._composite_images(frame_rgba_hwc_uint8, face_rgba_hwc_uint8, face)

        output_frame = Frame(
            pixels=frame_rgba_hwc_uint8,
            pixel_format=PixelFormat.RGBA_uint8,
            pixel_arrangement=PixelArrangement.HWC,
            objects=frame.objects
        )

        return output_frame