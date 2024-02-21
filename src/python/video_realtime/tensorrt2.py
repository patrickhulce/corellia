import tensorrt as trt
import numpy as np
import pycuda.driver as cuda

def init_tensor():
    def load_engine(engine_path):
        print('TRT VERSION', trt.__version__)
        TRT_LOGGER = trt.Logger(trt.Logger.VERBOSE)
        with open(engine_path, 'rb') as f, trt.Runtime(TRT_LOGGER) as runtime:
            return runtime.deserialize_cuda_engine(f.read())

    def allocate_buffers(engine):
        inputs, outputs, bindings = [], [], []
        for binding in engine:
            size = trt.volume(engine.get_binding_shape(binding))
            dtype = trt.nptype(engine.get_binding_dtype(binding))
            # Allocate host and device buffers
            host_mem = cuda.pagelocked_empty(size, dtype)
            device_mem = cuda.mem_alloc(host_mem.nbytes)
            # Append the device buffer to device bindings.
            bindings.append(int(device_mem))
            # Append to the appropriate list.
            if engine.binding_is_input(binding):
                inputs.append({'host': host_mem, 'device': device_mem})
            else:
                outputs.append({'host': host_mem, 'device': device_mem})
        return inputs, outputs, bindings

    # Manually initialize the CUDA engine
    cuda.init()
    device = cuda.Device(0)  # Assuming you want to use GPU 0
    device_context = device.make_context()  # Create a context on the device.

    engine_path = ".data/models/faceswap.engine"
    engine = load_engine(engine_path)
    inputs, outputs, bindings = allocate_buffers(engine)
    return (device, device_context, engine, inputs, outputs, bindings)

class TensorContext:
    def __init__(self, engine):
        self.engine = engine

    def __enter__(self):
        context = self.engine.create_execution_context()
        stream = cuda.Stream()
        return (context, stream)
    
    def __exit__(self, exc_type, exc_value, exc_traceback):
        del context
        del stream

def run_tensorrt(engine_tuple, frame_data):
    device, device_context, engine, inputs, outputs, bindings = engine_tuple
    stream = cuda.Stream()
    with engine.create_execution_context() as context:
        # Assuming input data is a numpy array
        input_data = frame_data
        np.copyto(inputs[0]['host'], input_data.ravel())  # Flatten input

        # Transfer input data to the GPU.
        cuda.memcpy_htod_async(inputs[0]['device'], inputs[0]['host'], stream)
        # Execute the model.
        context.execute_async_v2(bindings=bindings, stream_handle=stream.handle)
        # Transfer predictions back from the GPU.
        cuda.memcpy_dtoh_async(outputs[0]['host'], outputs[0]['device'], stream)
        # Synchronize the stream
        stream.synchronize()
        # The output is now available in outputs[0]['host']
        print("Output:", outputs[0]['host'])
        # Reshape back to 4, 512, 512
        face_img = outputs[0]['host'].reshape(4, 512, 512)
        return face_img