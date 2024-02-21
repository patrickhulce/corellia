from processors.face_detector import FaceDetector
from processors.object_marker import ObjectMarker
from sinks.display import DisplaySink
from sources.webcam import WebcamSource


def main():
    source = WebcamSource()
    sink = DisplaySink("Webcam")
    processors = [
        FaceDetector('.data/models/yolov8n-face.onnx'),
        ObjectMarker(),
    ]

    try:
        source.open()
        sink.open()
        for processor in processors:
            processor.open()

        for frame in source:
            for processor in processors:
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