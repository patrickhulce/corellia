import logging
from rtvideo.common.structs import PixelArrangement, PixelFormat
from rtvideo.processors.face_detector import FaceDetector
from rtvideo.processors.face_swapper import FaceSwapperTensorRT
from rtvideo.processors.object_marker import ObjectMarker
from rtvideo.processors.transforms import PixelFormatTransformer
from rtvideo.sinks.display import DisplaySink
from rtvideo.sinks.hls import HlsSink
from rtvideo.sources.file import FileSource
from rtvideo.sources.webcam import WebcamSource

logging.basicConfig(level=logging.DEBUG)
log = logging.getLogger('rtvideo')

def main():
    source = FileSource(".data/input.mp4")
    sink = HlsSink(".data/hls")
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