from dataclasses import dataclass
from typing import Optional
import cv2
import tensorrt as trt
import pycuda.driver as cuda
import logging

import numpy as np

from rtvideo.common.structs import BoundingBox, Frame, FrameProcessor, PixelArrangement, PixelFormat
from rtvideo.common.timer import NoopTimerSpan, TimerSpan

print(f"Initializing {__name__}")
log = logging.getLogger(__name__)

@dataclass
class TensorMemoryBinding:
    host: np.ndarray
    device: cuda.DeviceAllocation

class FaceSwapperTensorRT(FrameProcessor):
    model_path: str
    device: cuda.Device
    device_ctx: cuda.Device
    engine: trt.ICudaEngine
    inputs: list[TensorMemoryBinding]
    outputs: list[TensorMemoryBinding]
    bindings: list[int]

    def __init__(self, model_path: str):
        self.model_path = model_path

    def __str__(self) -> str:
        return f"FaceSwapperTensorRT(model_path={self.model_path})"

    @staticmethod
    def load_engine(model_path: str):
        log.info(f'Loading TensorRT ({trt.__version__}) engine from {model_path}')
        trt_logger = trt.Logger(trt.Logger.VERBOSE)
        with open(model_path, 'rb') as f, trt.Runtime(trt_logger) as runtime:
            return runtime.deserialize_cuda_engine(f.read())

    @staticmethod
    def allocate_buffers(engine: trt.ICudaEngine) -> tuple[list[TensorMemoryBinding], list[TensorMemoryBinding], list[int]]:
        inputs, outputs, bindings = [], [], []
        for binding in engine:
            size = trt.volume(engine.get_binding_shape(binding))
            dtype = trt.nptype(engine.get_binding_dtype(binding))

            # Allocate host and device buffers
            host_mem = cuda.pagelocked_empty(size, dtype)
            device_mem = cuda.mem_alloc(host_mem.nbytes)

            # Append the device buffer reference to device bindings.
            bindings.append(int(device_mem))

            # Append to the appropriate list.
            if engine.binding_is_input(binding):
                inputs.append(TensorMemoryBinding(host_mem, device_mem))
            else:
                outputs.append(TensorMemoryBinding(host_mem, device_mem))
        return inputs, outputs, bindings

    def open(self):
        cuda.init()
        self.device = cuda.Device(0)
        self.device_ctx = self.device.make_context()

        self.engine = FaceSwapperTensorRT.load_engine(self.model_path)
        self.inputs, self.outputs, self.bindings = FaceSwapperTensorRT.allocate_buffers(self.engine)
        self.exec_ctx = self.engine.create_execution_context()

    def close(self):
        del self.exec_ctx
        self.device_ctx.pop()
        del self.device_ctx


    def _run_tensorrt(self, face_input: np.ndarray, span: Optional[TimerSpan] = None):
        """
        Run the TensorRT model on the input face as a 512x512 CHW-RGB-float32 image.
        Return the output as a 512x512 CHW-RGBA-float32 image.
        """
        if span is None:
            span = self.active_span
        stream = cuda.Stream()

        # Transfer input data to the GPU.
        np.copyto(self.inputs[0].host, face_input.ravel())
        cuda.memcpy_htod_async(self.inputs[0].device, self.inputs[0].host, stream)

        # Execute the model.
        self.exec_ctx.execute_async_v2(bindings=self.bindings, stream_handle=stream.handle)

        # Transfer predictions back from the GPU.
        cuda.memcpy_dtoh_async(self.outputs[0].host, self.outputs[0].device, stream)
        stream.synchronize()
        
        # The output is now available in outputs[0].host
        log.debug(f"Output: {self.outputs[0].host}")
        # Reshape back to 4, 512, 512
        return self.outputs[0].host.reshape(4, 512, 512)

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

        with self.active_span.span('preprocess_frame'):
            face_input_rgb_hwc_uint8 = cv2.resize(face_input_rgb_hwc_uint8, (512, 512))
            face_input_rgb_chw_float32 = face_input_rgb_hwc_uint8.transpose((2, 0, 1)).astype(np.float32) / 255.0
            face_input_rgb_chw_float32 = np.expand_dims(face_input_rgb_chw_float32, axis=0)

        with self.active_span.span('run_tensorrt'):
            face_rgba_chw_float32 = self._run_tensorrt(face_input_rgb_chw_float32)

        with self.active_span.span('postprocess_frame'):
            face_rgba_hwc_uint8 = (face_rgba_chw_float32.clip(0, 1) * 255).astype(np.uint8).transpose((1, 2, 0))
            frame_rgba_hwc_uint8 = frame.as_rgba()

        with self.active_span.span('composite_images'):
            self._composite_images(frame_rgba_hwc_uint8, face_rgba_hwc_uint8, face)

        output_frame = Frame(
            pixels=frame_rgba_hwc_uint8,
            pixel_format=PixelFormat.RGBA_uint8,
            pixel_arrangement=PixelArrangement.HWC,
            objects=frame.objects
        )

        return output_frame