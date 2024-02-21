from sinks.display import DisplaySink
from sources.webcam import WebcamSource


def main():
    source = WebcamSource()
    sink = DisplaySink("Webcam")

    try:
        source.open()
        sink.open()

        for frame in source:
            sink(frame)
    except KeyboardInterrupt:
        print("User interrupted, exiting gracefully...")
    finally:
        source.close()
        sink.close()


if __name__ == "__main__":
    main()