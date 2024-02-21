import logging
from common.structs import PixelArrangement, PixelFormat
from processors.face_detector import FaceDetector
from processors.face_swapper import FaceSwapperTensorRT
from processors.object_marker import ObjectMarker
from processors.transforms import PixelFormatTransformer
from sinks.display import DisplaySink
from sources.file import FileSource
from sources.webcam import WebcamSource

log = logging
logging.basicConfig(level=logging.DEBUG)

def main():
    source = FileSource(".data/input.mp4")
    sink = DisplaySink("Webcam")
    processors = [
        PixelFormatTransformer(PixelFormat.RGB_uint8, PixelArrangement.HWC),
        FaceDetector('.data/models/yolov8n-face.onnx'),
        FaceSwapperTensorRT('.data/models/faceswap.engine'),
        ObjectMarker(),
    ]

    try:
        log.info("Opening source, sink, and processors...")
        source.open()
        sink.open()
        for processor in processors:
            processor.open()

        log.info("Processing frames...")
        for frame in source:
            for processor in processors:
                log.debug(f"Processing frame with {processor}")
                frame = processor(frame)
                log.debug(frame)
            sink(frame)
    except KeyboardInterrupt:
        print("User interrupted, exiting gracefully...")
    finally:
        source.close()
        sink.close()
        for processor in processors:
            processor.close()


if __name__ == "__main__":
    main()