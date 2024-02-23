import logging
from rtvideo.common.structs import PixelArrangement, PixelFormat
from rtvideo.common.timer import Timer
from rtvideo.pipelines.single_threaded_pipeline import SingleThreadPipeline
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
        PixelFormatTransformer(PixelFormat.RGB_uint8),
        FaceDetector('.data/models/scrfd_2.5g.onnx'),
        FaceSwapperTensorRT('.data/models/faceswap.engine'),
        ObjectMarker(),
        sink,
    ]

    SingleThreadPipeline(source, processors, log, Timer()).run()

if __name__ == "__main__":
    main()