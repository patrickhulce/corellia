import threading
import numpy as np
import cupy as cp
import onnxruntime as rt
import cv2

from rtvideo.common.tensorrt_context import TensorRTContext
from rtvideo.common.timer import Timer

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
    swapper = TensorRTContext('.data/models/faceswap.engine')

    try:
        swapper.open()
        image = swapper.run(load_test_image())[0][0]
        save_output(image, 'tensorrt')
    finally:
        swapper.close()



def test_onnx():
    # Load the ONNX model
    session = rt.InferenceSession(".data/models/faceswap.onnx",
                                  providers=["CUDAExecutionProvider", "CPUExecutionProvider"])

    input_data = load_test_image()
    # Run the model (replace 'input_name' and 'output_name' with actual names)
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    print(f'Running model with input {input_name} and output {output_name}')
    timer = Timer()
    for i in range(50):
        with timer.span("run_onnx_faceswap"):
            result = session.run([output_name], {input_name: input_data})
    save_output(result[0][0], 'onnx')
    print(timer)


def main():
    # Run each function in a thread.
    tensor_thread = threading.Thread(target=test_tensorrt)
    onnx_thread = threading.Thread(target=test_onnx)

    tensor_thread.start()
    onnx_thread.start()

    tensor_thread.join()
    onnx_thread.join()

if __name__ == "__main__":
    main()