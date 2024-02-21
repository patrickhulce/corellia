from common.structs import BoundingBox, Frame, PixelArrangement, PixelFormat
from processors.face_detector.yolov8_face import YOLOv8Face


class FaceDetector:
    def __init__(self, model_path: str):
        self.model_path = model_path

    def open(self):
        self.detector = YOLOv8Face(self.model_path)

    def close(self):
        pass

    def _expand_bounding_box(self, frame: Frame, bbox: BoundingBox, scale: float = 1.5) -> BoundingBox:
        x, y, w, h = bbox
        center_x, center_y = x + w / 2, y + h / 2
        max_dim = max(w, h)
        new_dim = int(max_dim * scale)
        new_x = int(max(0, center_x - new_dim / 2))
        new_y = int(max(0, center_y - new_dim / 2))
        new_w = min(frame.width - new_x, new_dim)
        new_h = min(frame.height - new_y, new_dim)
        return BoundingBox(new_x, new_y, new_w, new_h)

    def __call__(self, frame: Frame) -> Frame:
        assert frame.pixel_arrangement == PixelArrangement.HWC
        assert frame.pixel_format == PixelFormat.RGB_uint8
        
        output_frame = frame.copy()
        detections, confidences, classes, kpts = self.detector.detect(frame.pixels)
        for detection in detections:
            bbox = self._expand_bounding_box(frame, detection)
            output_frame.objects.append(bbox)
        return output_frame