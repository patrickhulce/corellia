from dataclasses import dataclass
import logging
import tensorrt as trt
import pycuda.driver as cuda

import numpy as np


log = logging.getLogger(__name__)

@dataclass
class TensorMemoryBinding:
    size: int
    shape: tuple[int]
    dtype: trt.DataType
    host: np.ndarray
    device: cuda.DeviceAllocation

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

        print("TensorRT Engine Inputs:", self.inputs)
        print("TensorRT Engine Outputs:", self.outputs)
        assert len(self.inputs) == 1, "Only 1 input tensor is supported."
        assert len(self.outputs) == 1, "Only 1 output tensor is supported."
        assert self.outputs[0].shape[0] == 1, "Only 1 batch size is supported."


    def close(self):
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
            size = trt.volume(engine.get_binding_shape(binding))
            dtype = trt.nptype(engine.get_binding_dtype(binding))
            shape = engine.get_binding_shape(binding)

            # Allocate host and device buffers
            host_mem = cuda.pagelocked_empty(size, dtype)
            device_mem = cuda.mem_alloc(host_mem.nbytes)

            # Append the device buffer reference to device bindings.
            bindings.append(int(device_mem))

            # Append to the appropriate list.
            if engine.binding_is_input(binding):
                inputs.append(TensorMemoryBinding(size, shape, dtype, host_mem, device_mem))
            else:
                outputs.append(TensorMemoryBinding(size, shape, dtype, host_mem, device_mem))
        return inputs, outputs, bindings
    
    def run(self, input_data: np.ndarray) -> np.ndarray:
        stream = cuda.Stream()

        # Transfer input data to the GPU.
        np.copyto(self.inputs[0].host, input_data.ravel())
        cuda.memcpy_htod_async(self.inputs[0].device, self.inputs[0].host, stream)

        # Execute the model.
        self.exec_ctx.execute_async_v2(bindings=self.bindings, stream_handle=stream.handle)

        # Transfer predictions back from the GPU.
        cuda.memcpy_dtoh_async(self.outputs[0].host, self.outputs[0].device, stream)
        stream.synchronize()

        # The output is now available in outputs[0].host
        log.debug(f"Output: {self.outputs[0].host}")
        output_shape = self.outputs[0].shape[1:] # Remove the batch size
        return self.outputs[0].host.reshape(output_shape)