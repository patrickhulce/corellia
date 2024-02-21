import threading
import numpy as np
import cupy as cp
import onnxruntime as rt
import cv2
from python.video_realtime.models import init_faceswap, run_faceswap
from python.video_realtime.structs import BoundingBox
from python.video_realtime.tensorrt2 import init_tensor, run_tensorrt

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
    use_new = False
    use_new = True

    engine_tuple = init_tensor()
    try:
        capture = cv2.VideoCapture(0, cv2.CAP_V4L2)
        capture.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter.fourcc('M', 'J', 'P', 'G'))

        for i in range(5): 
            if use_new:
                # input_data = cv2.imread(".data/image.jpg")
                # print('Input:', input_data.shape, input_data.dtype, input_data.min(), input_data.max())
                # input_data = cv2.cvtColor(input_data, cv2.COLOR_BGR2RGB)
                # input_data = cv2.resize(input_data, (512, 512))
                ret, frame = capture.read()
                if not ret:
                    print("Failed to grab frame")
                    break
                print('Input:', frame.shape, frame.dtype, frame.min(), frame.max())
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

                output = run_faceswap(engine_tuple, frame, [BoundingBox(0, 0, 400, 400)])
                # save_output(output, 'tensorrt2')
                output = cv2.cvtColor(output, cv2.COLOR_RGBA2BGRA)
                cv2.imwrite(f".data/output-tensor2.png", output)
            else:
                image = run_tensorrt(engine_tuple, load_test_image())
                save_output(image, 'tensorrt')
    finally:
        capture.release()
        engine_tuple[1].pop()



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
    # Run each function in a thread.
    tensor_thread = threading.Thread(target=test_tensorrt)
    onnx_thread = threading.Thread(target=test_onnx)

    tensor_thread.start()
    onnx_thread.start()

    tensor_thread.join()
    onnx_thread.join()

if __name__ == "__main__":
    main()