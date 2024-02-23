import cv2
import logging

import numpy as np
import cupy as cp
import onnxruntime as ort
import cupyx.scipy.ndimage

from rtvideo.common.structs import BoundingBox, Frame, FrameProcessor, PixelArrangement, PixelFormat
from rtvideo.common.tensorrt_context import TensorRTContext
from rtvideo.common.timer import NoopTimerSpan, TimerSpan

log = logging.getLogger(__name__)


class FaceSwapper(FrameProcessor):
    model_path: str
    tensorrt: TensorRTContext
    onnx: ort.InferenceSession

    def __init__(self, model_path: str):
        self.model_path = model_path
        self.tensorrt = None
        self.onnx = None

        if model_path.endswith('.engine'):
            self.tensorrt = TensorRTContext(model_path)
        elif model_path.endswith('.onnx'):
            self.onnx = ort.InferenceSession(model_path, providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
        else:
            raise ValueError(f"Unidentified model: {model_path}")

    def __str__(self) -> str:
        return f"FaceSwapperTensorRT(model_path={self.model_path})"

    def open(self):
        if self.tensorrt is not None:
            self.tensorrt.open()

        if self.onnx is not None:
            self._run_model(np.zeros((1, 3, 512, 512), dtype=np.float32))

    def close(self):
        if self.tensorrt is not None:
            self.tensorrt.close()

    def _run_model(self, input: np.ndarray) -> np.ndarray:
        """
        Run the model on the input and return the output (CHW, float32).
        """
        if self.tensorrt is not None:
            # Select first output and remove the batch dimension.
            return self.tensorrt.run(input)[0][0]
        
        if self.onnx is not None:
            input_name = self.onnx.get_inputs()[0].name
            output_name = self.onnx.get_outputs()[0].name
            # Select first output and remove the batch dimension.
            return self.onnx.run([output_name], {input_name: input})[0][0]
        
    def _composite_images_gpu(self, background: np.ndarray, foreground: np.ndarray, position: BoundingBox) -> np.ndarray:
        """
        Composite a foreground image (HWC, RGBA, uint8)
        onto the background image (HWC, RGB, uint8)
        at the specified position using Cupy and GPU acceleration.
        """
        x, y, w, h = position
        background = cp.asarray(background)
        foreground = cp.asarray(foreground)

        # Add alpha channel to the background.
        background = cp.dstack((background, cp.ones((background.shape[0], background.shape[1], 1), dtype=cp.uint8) * 255))
        # Resize foreground to match the size of the bounding box.
        foreground = cupyx.scipy.ndimage.zoom(foreground, (h / foreground.shape[0], w / foreground.shape[1], 1), order=1)
        # Select out the background region to composite onto.
        background_region = background[y:y+h, x:x+w]
        # Composite the foreground onto the background using foreground alpha channel for each pixel.
        # Multiply the foreground by the alpha channel and add the result to the background.
        alpha = (foreground[:, :, 3] / 255.0).reshape(h, w, 1)
        alpha_matrix = cp.broadcast_to(alpha, (h, w, 3))
        background_region[:, :, 0:3] = (1 - alpha_matrix) * background_region[:, :, 0:3] + alpha_matrix * foreground[:, :, 0:3]
        # Paste the composited region back into the background.
        background[y:y+h, x:x+w] = background_region
        return background.get()

    def _composite_images(self, background: np.ndarray, foreground: np.ndarray, position: BoundingBox) -> np.ndarray:
        """
        Composite a foreground image (HWC, RGBA, uint8) 
        onto the background image (HWC, RGB, uint8)
        at the specified position.
        """
        if cp.cuda.is_available():
            return self._composite_images_gpu(background, foreground, position)

        x, y, w, h = position
        # Add the alpha channel to the background.
        background = cv2.cvtColor(background, cv2.COLOR_RGB2RGBA)
        # Resize foreground to match the size of the bounding box.
        foreground = cv2.resize(foreground, (w, h))
        # Select out the background region to composite onto.
        background_region = background[y:y+h, x:x+w]
        # Composite the foreground onto the background using foreground alpha channel for each pixel.
        # Multiply the foreground by the alpha channel and add the result to the background.
        alpha = (foreground[:, :, 3] / 255.0).reshape(h, w, 1)
        alpha_matrix = np.broadcast_to(alpha, (h, w, 3))
        background_region[:, :, 0:3] = (1 - alpha_matrix) * background_region[:, :, 0:3] + alpha_matrix * foreground[:, :, 0:3]
        # Paste the composited region back into the background.
        background[y:y+h, x:x+w] = background_region
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

        with self.active_span.child('run_tensorrt_faceswap'):
            face_rgba_chw_float32 = self._run_model(face_input_rgb_chw_float32)

        with self.active_span.child('postprocess_frame'):
            face_rgba_hwc_uint8 = (face_rgba_chw_float32.clip(0, 1) * 255).astype(np.uint8).transpose((1, 2, 0))

        with self.active_span.child('composite_images'):
            frame_rgb_hwc_uint8 = frame.pixels
            frame_rgba_hwc_uint8 = self._composite_images(frame_rgb_hwc_uint8, face_rgba_hwc_uint8, face)

        output_frame = Frame(
            pixels=frame_rgba_hwc_uint8,
            pixel_format=PixelFormat.RGBA_uint8,
            pixel_arrangement=PixelArrangement.HWC,
            objects=frame.objects,
            span=frame.span
        )

        return output_frame