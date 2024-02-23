import os
from typing import Tuple
import numpy as np
import onnxruntime
import cv2

class SCRFD:
    def __init__(self, model_file):
        assert os.path.isfile(model_file)
        self.session = onnxruntime.InferenceSession(
            model_file,
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )

        self.input_name = self.session.get_inputs()[0].name
        self.output_names = [o.name for o in self.session.get_outputs()]

        self.nms_thresh = 0.4
        self.features_per_stride = 3
        self.input_size = 640
        self.strides = [8, 16, 32]
        self.anchor_centers = SCRFD.build_anchor_centers(640, [8, 16, 32], 2)

    def forward(self, img: np.ndarray, thresh: float) -> Tuple[list[np.ndarray], list[np.ndarray], list[np.ndarray]]:
        scores_list = []
        bboxes_list = []
        keypoints_list = []

        _, input_height, input_width = img.shape
        assert input_height == self.input_size
        assert input_width == self.input_size

        img = np.expand_dims(img, axis=0).astype(np.float32) * 2 - 1
        net_outs = self.session.run(self.output_names, {self.input_name: img})
        
        # If the output is 3D, remove the batch dimension.
        if len(net_outs[0].shape) == 3:
            net_outs = [x[0] for x in net_outs]

        for idx, stride in enumerate(self.strides):
            scores = net_outs[idx]
            bbox_preds = net_outs[idx + self.features_per_stride] * stride
            kps_preds = net_outs[idx + self.features_per_stride * 2] * stride
            anchor_centers = self.anchor_centers[stride]

            bboxes = bboxes_from_anchor_distances(anchor_centers, bbox_preds)
            keypoints = keypoints_from_anchor_distances(anchor_centers, kps_preds)
            keypoints = keypoints.reshape(keypoints.shape[0], -1, 2)

            indices_to_keep = np.where(scores >= thresh)[0]
            kept_scores = scores[indices_to_keep]
            kept_bboxes = bboxes[indices_to_keep]
            kept_keypoints = keypoints[indices_to_keep]

            scores_list.append(kept_scores)
            bboxes_list.append(kept_bboxes)
            keypoints_list.append(kept_keypoints)

        return scores_list, bboxes_list, keypoints_list


    @staticmethod
    def build_anchor_centers(size: int, strides: list[int], num_anchors: int = 1):
        anchor_centers_by_stride = dict()
        for stride in strides:
            size_for_stride = size // stride
            xs, ys = np.meshgrid(np.arange(size_for_stride), np.arange(size_for_stride))
            anchor_centers = np.stack([xs, ys], axis=-1) * stride
            anchor_centers = anchor_centers.reshape(-1, 2)
            if num_anchors > 1:
                anchor_centers = np.repeat(anchor_centers, num_anchors, axis=0)
            anchor_centers_by_stride[stride] = anchor_centers
        return anchor_centers_by_stride

    def detect(self, img: np.ndarray, thresh: float = 0.3):
        detection_scale, detection_image = self.preprocess(img)
        scores_list, bboxes_list, keypoints_list = self.forward(detection_image, thresh)
        return self.postprocess(detection_scale, scores_list, bboxes_list, keypoints_list)

    def preprocess(self, img: np.ndarray) -> Tuple[float, np.ndarray]:
        orig_height, orig_width, _ = img.shape
        aspect_ratio = orig_height / orig_width
        if orig_height > orig_width:
            new_height = self.input_size
            new_width = int(new_height / aspect_ratio)
        else:
            new_width = self.input_size
            new_height = int(new_width * aspect_ratio)
        detection_scale = float(new_height) / orig_height

        resized_img = cv2.resize(img, (new_width, new_height))
        resized_img = resized_img.transpose(2, 0, 1)
        resized_img = resized_img.astype(np.float32) / 127.5 - 1

        detection_image = np.zeros((3, self.input_size, self.input_size), dtype=np.float32)
        detection_image[:, :new_height, :new_width] = resized_img
        return detection_scale, detection_image

    def postprocess(self, detection_scale: float, scores_list: np.ndarray, bboxes_list: np.ndarray, keypoints_list: np.ndarray):
        scores = np.concatenate(scores_list, axis=0)
        bboxes = np.concatenate(bboxes_list, axis=0) / detection_scale
        keypoints = np.concatenate(keypoints_list, axis=0) / detection_scale
        detections = np.concatenate([bboxes, scores], axis=1)
        order = np.argsort(-scores.flatten())
        detections = detections[order]
        keypoints = keypoints[order]

        indices_to_keep = self.nms(detections)
        detections = [self.ltrb2ltwh(x) for x in detections[indices_to_keep]]
        keypoints = keypoints[indices_to_keep]
        return detections, keypoints

    def ltrb2ltwh(self, ltrb):
        """
        Converts a bounding box from (left, top, right, bottom) to (left, top, width, height) format.
        """
        l, t, r, b, _ = ltrb
        return [l, t, r - l, b - t]

    def nms(self, detections: np.ndarray):
        """
        Performs non-maximum suppression on the detected faces.
        Returns the indices of the detections to keep.
        """
        thresh = self.nms_thresh
        x1 = detections[:, 0]
        y1 = detections[:, 1]
        x2 = detections[:, 2]
        y2 = detections[:, 3]
        scores = detections[:, 4]

        areas = (x2 - x1) * (y2 - y1)
        order = scores.argsort()[::-1]

        keep = []
        while order.size > 0:
            i = order[0]
            keep.append(i)
            xx1 = np.maximum(x1[i], x1[order[1:]])
            yy1 = np.maximum(y1[i], y1[order[1:]])
            xx2 = np.minimum(x2[i], x2[order[1:]])
            yy2 = np.minimum(y2[i], y2[order[1:]])

            w = np.maximum(0, xx2 - xx1)
            h = np.maximum(0, yy2 - yy1)
            intersection = w * h
            IoU = intersection / (areas[i] + areas[order[1:]] - intersection + 1e-10)

            kept_indices = np.where(IoU <= thresh)[0]
            order = order[kept_indices + 1]

        return keep

def bboxes_from_anchor_distances(points: np.ndarray, distance: np.ndarray):
    """
    Converts bounding box distances from anchor points into bounding boxes in absolute coordinates.
    """
    x1 = points[:, 0] - distance[:, 0]
    y1 = points[:, 1] - distance[:, 1]
    x2 = points[:, 0] + distance[:, 2]
    y2 = points[:, 1] + distance[:, 3]
    return np.stack([x1, y1, x2, y2], axis=-1)

def keypoints_from_anchor_distances(points: np.ndarray, distance: np.ndarray):
    """
    Converts keypoint distances from anchor points into keypoints in absolute coordinates.
    """
    keypoints = []
    for i in range(0, distance.shape[1], 2):
        px = points[:, i % 2] + distance[:, i]
        py = points[:, i % 2 + 1] + distance[:, i + 1]
        keypoints.append(px)
        keypoints.append(py)
    return np.stack(keypoints, axis=-1)