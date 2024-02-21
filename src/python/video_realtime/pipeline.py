import cv2
import numpy as np
import time
from python.video_realtime.models import init_faceswap, run_faceswap
from python.video_realtime.structs import BoundingBox
from python.video_realtime.tensorrt2 import init_tensor
from python.video_realtime.production.src.processors.face_detector.yolov8_face import YOLOv8Face

TARGET_FPS = 15

# A timer class that allows us to measure arbitrary time intervals using `with timer.span('name'):` blocks
class Timer:
    def __init__(self):
        self.spans = []

    def span(self, name):
        class TimerSpan:
            def __enter__(self):
                self.name = name
                self.start = time.time()
                return self

            def __exit__(self, type, value, traceback):
                self.end = time.time()
                self.duration = self.end - self.start

        span = TimerSpan()
        self.spans.append(span)
        return span

    def __str__(self):
        spans_by_name = {}
        for span in self.spans:
            if span.name not in spans_by_name:
                spans_by_name[span.name] = []
            spans_by_name[span.name].append(span)

        summary = ''
        for name, spans in spans_by_name.items():
            sorted_durations = sorted(span.duration * 1000 for span in spans)

            # Summary statistics
            p50 = sorted_durations[int(len(spans) * 0.5)]
            p95 = sorted_durations[int(len(spans) * 0.95)]
            p99 = sorted_durations[int(len(spans) * 0.99)]

            summary = f"{summary}{name}: p50={p50:.2f}ms, p95={p95:.2f}ms, p99={p99:.2f}ms\n"

        return summary


def expand_bounding_box(bbox, frame_width, frame_height, scale=1.2):
    x, y, w, h = bbox
    center_x, center_y = x + w / 2, y + h / 2
    max_dim = max(w, h)
    new_dim = int(max_dim * scale)
    new_x = int(max(0, center_x - new_dim / 2))
    new_y = int(max(0, center_y - new_dim / 2))
    new_w = min(frame_width - new_x, new_dim)
    new_h = min(frame_height - new_y, new_dim)
    return new_x, new_y, new_w, new_h

def main():
    # Initialize the webcam
    cap = cv2.VideoCapture(0, cv2.CAP_V4L2)
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter.fourcc('M', 'J', 'P', 'G'))
    cap.set(cv2.CAP_PROP_FPS, TARGET_FPS)

    if not cap.isOpened():
        print("Error: Could not open webcam")
        return

    # Initialize the face detector and faceswap engine
    face_detector = YOLOv8Face('.data/models/yolov8n-face.onnx')
    engine_tuple = init_tensor()

    previous_frame_time = 0
    cummulative_time_behind = 0
    try:
        timer = Timer()
        while True:
            with timer.span('e2e'):
                with timer.span('read_frame'):
                    ret, frame = cap.read()
                    current_frame_time = time.time()
                    time_per_frame = current_frame_time - previous_frame_time
                    target_time_per_frame = 1/TARGET_FPS
                    if time_per_frame > target_time_per_frame:
                        cummulative_time_behind += time_per_frame - target_time_per_frame
                    last_fps = 1/time_per_frame
                    print("FPS: ", last_fps)
                    if cummulative_time_behind > target_time_per_frame:
                        print("Lagging too much, skipping frame!")
                        cummulative_time_behind = 0
                        previous_frame_time = current_frame_time
                        continue
                    previous_frame_time = current_frame_time
                        
                if not ret:
                    print("Failed to grab frame")
                    break

                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

                # Detect faces
                objects = []
                with timer.span('detect_faces'):
                    detections, confidences, classes, kpts = face_detector.detect(frame_rgb)
                    for detection in detections:
                        expanded = expand_bounding_box(detection, frame.shape[1], frame.shape[0])
                        objects.append(BoundingBox(left=expanded[0], top=expanded[1], width=expanded[2], height=expanded[3]))

                # Run faceswap on detected faces
                
                if len(objects) > 0:
                    with timer.span('run_faceswap'):
                        frame_rgb = run_faceswap(engine_tuple, frame_rgb, objects)
                        

                for object in objects:
                    frame_rgb[
                        object.top : object.top + 10,
                        object.left : object.left + 10,
                    ] = 0

                # Convert back to BGR for OpenCV display and save
                frame_bgr = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)
                # cv2.imwrite("latest.jpg", frame_bgr)

                # Display the frame
                cv2.imshow('Faceswap', frame_bgr)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    finally:
        print(timer)
        cap.release()
        cv2.destroyAllWindows()
        engine_tuple[1].pop()

if __name__ == "__main__":
    main()


# e2e: p50=38.27ms, p95=111.75ms, p99=125.58ms
# read_frame: p50=0.12ms, p95=7.66ms, p99=23.14ms
# detect_faces: p50=30.86ms, p95=45.05ms, p99=68.60ms
# run_faceswap: p50=75.22ms, p95=77.44ms, p99=132.64ms