import logging
from typing import Optional
import tensorrt as trt
import pycuda.driver as cuda

import numpy as np
import cupy as cp
import cupyx


log = logging.getLogger(__name__)

class TensorMemoryBinding:
    size: int
    shape: tuple[int]
    dtype: trt.DataType
    host: np.ndarray
    device: cp.ndarray

    def __init__(self, shape: tuple[int], size: int, dtype: trt.DataType) -> None:
        self.size = size
        self.shape = shape
        self.dtype = dtype
        self.host = cupyx.zeros_pinned(size, dtype, order='C')
        self.device = cp.zeros(size, dtype, order='C')
        
    def copy_htod_async(self, stream: cp.cuda.Stream) -> None:
        hostptr = self.host.ctypes.data
        self.device.data.copy_from_host_async(hostptr, self.host.nbytes, stream)

    def copy_dtoh_async(self, stream: cp.cuda.Stream) -> None:
        hostptr = self.host.ctypes.data
        self.device.data.copy_to_host_async(hostptr, self.host.nbytes, stream)

class TensorRTContext:
    engine_path: str
    device: cuda.Device
    device_ctx: cuda.Device
    engine: trt.ICudaEngine
    inputs: list[TensorMemoryBinding]
    outputs: list[TensorMemoryBinding]
    bindings: list[int]

    def __init__(self, engine_path: str) -> None:
        self.engine_path = engine_path

    def open(self):
        cuda.init()
        self.device = cuda.Device(0)
        self.device_ctx = self.device.make_context()

        self.engine = TensorRTContext.load_engine(self.engine_path)
        self.inputs, self.outputs, self.bindings = TensorRTContext.allocate_buffers(self.engine)
        self.exec_ctx = self.engine.create_execution_context()
        self.stream = cp.cuda.Stream(non_blocking=True)

        assert len(self.inputs) == 1, "Only 1 input tensor is currently supported."


    def close(self):
        for memory in self.inputs + self.outputs:
            del memory.device

        del self.exec_ctx
        self.device_ctx.pop()
        del self.device_ctx

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
            shape = engine.get_binding_shape(binding)
            size = trt.volume(engine.get_binding_shape(binding))
            dtype = trt.nptype(engine.get_binding_dtype(binding))

            memory = TensorMemoryBinding(shape, size, dtype)
            bindings.append(int(memory.device.data.ptr))

            if engine.binding_is_input(binding):
                inputs.append(memory)
            else:
                outputs.append(memory)
        return inputs, outputs, bindings
    
    def run(self, input_data: Optional[np.ndarray] = None) -> list[np.ndarray]:
        stream = self.stream

        # If they didn't already use the on-device cupy array then...
        if input_data is not None:
            # Transfer input data to the GPU device binding.
            np.copyto(self.inputs[0].host, input_data.ravel())
            self.inputs[0].copy_htod_async(stream)

        # Execute the model.
        self.exec_ctx.execute_async_v2(bindings=self.bindings, stream_handle=stream.ptr)

        # Transfer predictions back from the GPU.
        for output in self.outputs:
            output.copy_dtoh_async(stream)
        stream.synchronize()

        # The output is now available in outputs[0].host
        log.debug(f"Output: {self.outputs[0].host}")
        return [output.host.reshape(output.shape) for output in self.outputs]