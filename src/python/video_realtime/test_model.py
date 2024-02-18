import numpy as np
import onnxruntime as rt
import cv2

def load_test_image() -> np.ndarray:
    # Assuming your model expects a 512x512 RGB image
    # Read an image from .data/image.jpg
    input_data = cv2.imread(".data/image.jpg")
    print('Input:', input_data.shape, input_data.dtype, input_data.min(), input_data.max())
    # Put it into the right format (CHW) and float it
    input_data = cv2.cvtColor(input_data, cv2.COLOR_BGR2RGB)
    input_data = cv2.resize(input_data, (512, 512))
    input_data = input_data.transpose(2, 0, 1)
    input_data = input_data.astype(np.float32) / 255.0
    # Convert to 4D tensor
    input_data = np.expand_dims(input_data, axis=0)
    return input_data


def save_output(output: np.ndarray, variant: str = 'default'):
    # Convert to 255 RGB (HWC) and save the result to png    
    output = output.transpose(1, 2, 0).clip(0, 1)
    output = output * 255
    output = output.astype(np.uint8)
    # Convert back to BGR
    output = cv2.cvtColor(output, cv2.COLOR_RGBA2BGRA)
    cv2.imwrite(f".data/output-{variant}.png", output)
    print('Done!', output.shape, output.dtype, output.min(), output.max())


def test_tensorrt():
    import tensorrt as trt
    import numpy as np
    import pycuda.driver as cuda
    import pycuda.autoinit  # This is needed for initializing CUDA driver

    def load_engine(engine_path):
        TRT_LOGGER = trt.Logger(trt.Logger.WARNING)
        with open(engine_path, 'rb') as f, trt.Runtime(TRT_LOGGER) as runtime:
            return runtime.deserialize_cuda_engine(f.read())

    def allocate_buffers(engine):
        inputs, outputs, bindings = [], [], []
        stream = cuda.Stream()
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
        return inputs, outputs, bindings, stream

    engine_path = "model.engine"
    engine = load_engine(engine_path)

    inputs, outputs, bindings, stream = allocate_buffers(engine)

    # Create a context for executing inference
    with engine.create_execution_context() as context:
        # Assuming input data is a numpy array
        input_data = load_test_image()
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
        save_output(face_img, 'tensorrt')



def test_onnx():
    # Load the ONNX model
    sess = rt.InferenceSession(".data/models/faceswap.onnx")

    input_data = load_test_image()
    # Run the model (replace 'input_name' and 'output_name' with actual names)
    input_name = sess.get_inputs()[0].name
    output_name = sess.get_outputs()[0].name
    print(f'Running model with input {input_name} and output {output_name}')
    result = sess.run([output_name], {input_name: input_data})
    save_output(result[0][0], 'onnx')


def main():
    test_tensorrt()
    test_onnx()

if __name__ == "__main__":
    main()