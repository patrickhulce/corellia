import threading
import numpy as np
import cv2

from rtvideo.common.timer import Timer
from rtvideo.processors.face_detector.scrfd import SCRFD

def load_test_image() -> np.ndarray:
    # Assuming your model expects a 640x640 RGB image
    # Read an image from .data/image.jpg
    input_data = cv2.imread(".data/image.jpg")
    print('Input:', input_data.shape, input_data.dtype, input_data.min(), input_data.max())
    input_data = cv2.cvtColor(input_data, cv2.COLOR_BGR2RGB)
    return input_data


def test_onnx():
    # detector = SCRFD('.data/models/scrfd_10g_gnkps.onnx')
    detector = SCRFD('.data/models/scrfd_2.5g.onnx')
    detector.detect(np.zeros((640, 640, 3), dtype=np.uint8))

    input_data = load_test_image()
    print("Input:", input_data.shape, input_data.dtype, input_data.min(), input_data.max())

    timer = Timer()
    for _ in range(50):
        with timer.span("detect"):
            print("Results:", detector.detect(input_data))

    print(timer)

def main():
    # Run each function in a thread.
    onnx_thread = threading.Thread(target=test_onnx)
    onnx_thread.start()
    onnx_thread.join()

if __name__ == "__main__":
    main()