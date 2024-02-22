from dataclasses import dataclass
import cv2
import tensorrt as trt
import pycuda.driver as cuda
import logging

import numpy as np

from rtvideo.common.structs import BoundingBox, Frame, PixelArrangement, PixelFormat

print(f"Initializing {__name__}")
log = logging.getLogger(__name__)

@dataclass
class TensorMemoryBinding:
    host: np.ndarray
    device: cuda.DeviceAllocation

class FaceSwapperTensorRT:
    model_path: str
    device: cuda.Device
    device_ctx: cuda.Device
    engine: trt.ICudaEngine
    inputs: list[TensorMemoryBinding]
    outputs: list[TensorMemoryBinding]
    bindings: list[int]

    def __init__(self, model_path: str):
        self.model_path = model_path

    def _load_engine(self):
        log.info(f'Loading TensorRT ({trt.__version__}) engine from {self.model_path}')
        trt_logger = trt.Logger(trt.Logger.VERBOSE)
        with open(self.model_path, 'rb') as f, trt.Runtime(trt_logger) as runtime:
            return runtime.deserialize_cuda_engine(f.read())

    def _allocate_buffers(self, engine):
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

        self.engine = self._load_engine()
        self.inputs, self.outputs, self.bindings = self._allocate_buffers(self.engine)

    def close(self):
        self.device_ctx.pop()
        del self.device_ctx


    def _run_tensorrt(self, face_input: np.ndarray):
        """
        Run the TensorRT model on the input face as a 512x512 CHW-RGB-float32 image.
        Return the output as a 512x512 CHW-RGBA-float32 image.
        """
        stream = cuda.Stream()
        with self.engine.create_execution_context() as context:
            np.copyto(self.inputs[0].host, face_input.ravel())

            # Transfer input data to the GPU.
            cuda.memcpy_htod_async(self.inputs[0].device, self.inputs[0].host, stream)
            # Execute the model.
            context.execute_async_v2(bindings=self.bindings, stream_handle=stream.handle)
            # Transfer predictions back from the GPU.
            cuda.memcpy_dtoh_async(self.outputs[0].host, self.outputs[0].device, stream)
            # Wait for the async operations to complete.
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

        face_input_rgb_hwc_uint8 = cv2.resize(face_input_rgb_hwc_uint8, (512, 512))
        face_input_rgb_chw_float32 = face_input_rgb_hwc_uint8.transpose((2, 0, 1)).astype(np.float32) / 255.0
        face_input_rgb_chw_float32 = np.expand_dims(face_input_rgb_chw_float32, axis=0)
        face_rgba_chw_float32 = self._run_tensorrt(face_input_rgb_chw_float32)

        face_rgba_hwc_uint8 = (face_rgba_chw_float32.clip(0, 1) * 255).astype(np.uint8).transpose((1, 2, 0))
        frame_rgba_hwc_uint8 = frame.as_rgba()
        self._composite_images(frame_rgba_hwc_uint8, face_rgba_hwc_uint8, face)

        output_frame = Frame(
            pixels=frame_rgba_hwc_uint8,
            pixel_format=PixelFormat.RGBA_uint8,
            pixel_arrangement=PixelArrangement.HWC,
            objects=frame.objects
        )

        return output_frame