import logging
from rtvideo.common.structs import PixelArrangement, PixelFormat
from rtvideo.common.timer import Timer
from rtvideo.pipelines.multi_threaded_pipeline import MultiThreadPipeline
from rtvideo.pipelines.single_threaded_pipeline import SingleThreadPipeline
from rtvideo.processors.face_detector import FaceDetector
from rtvideo.processors.face_swapper import FaceSwapper
from rtvideo.processors.object_marker import ObjectMarker
from rtvideo.processors.transforms import PixelFormatTransformer
from rtvideo.sinks.display import DisplaySink
from rtvideo.sinks.hls import HlsSink
from rtvideo.sources.file import FileSource
from rtvideo.sources.webcam import WebcamSource

logging.basicConfig(level=logging.DEBUG)
log = logging.getLogger('rtvideo')

def main():
    # source = WebcamSource()
    # sink = DisplaySink("Webcam")

    source = FileSource(".data/input.mp4")
    sink = HlsSink(".data/hls")
    processors = [
        PixelFormatTransformer(PixelFormat.RGB_uint8),
        FaceDetector('.data/models/scrfd_2.5g.onnx'),
        FaceSwapper('.data/models/faceswap.onnx'),
        ObjectMarker(),
        sink,
    ]

    MultiThreadPipeline(source, processors, log, Timer()).run()

if __name__ == "__main__":
    main()