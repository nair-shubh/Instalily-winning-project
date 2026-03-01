from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
from ultralytics import YOLO


@dataclass
class DetectionBox:
    x1_norm: float
    y1_norm: float
    x2_norm: float
    y2_norm: float
    conf: float


@dataclass
class VisionResult:
    chair_count: int
    average_conf: float
    detections: list[DetectionBox]


class ChairCounter:
    def __init__(self, model_name: str, chair_class_name: str, conf_threshold: float):
        self.model = YOLO(model_name)
        self.conf_threshold = conf_threshold
        self.class_name_to_id = {name: idx for idx, name in self.model.names.items()}
        if chair_class_name not in self.class_name_to_id:
            raise ValueError(f"Class '{chair_class_name}' not found in model labels")
        self.chair_class_id = self.class_name_to_id[chair_class_name]

    def count_chairs(self, frame_bgr: np.ndarray) -> VisionResult:
        results = self.model.predict(frame_bgr, verbose=False)
        if not results:
            return VisionResult(chair_count=0, average_conf=0.0, detections=[])

        result = results[0]
        boxes: Any = result.boxes
        if boxes is None or boxes.cls is None or boxes.conf is None or boxes.xyxy is None:
            return VisionResult(chair_count=0, average_conf=0.0, detections=[])

        classes = boxes.cls.tolist()
        confs = boxes.conf.tolist()
        xyxy = boxes.xyxy.tolist()
        frame_h, frame_w = frame_bgr.shape[:2]

        accepted_confs: list[float] = []
        accepted_boxes: list[DetectionBox] = []
        for cls_id, conf, coords in zip(classes, confs, xyxy):
            if int(cls_id) != self.chair_class_id or float(conf) < self.conf_threshold:
                continue
            x1, y1, x2, y2 = [float(v) for v in coords]
            accepted_confs.append(float(conf))
            accepted_boxes.append(
                DetectionBox(
                    x1_norm=max(0.0, min(1.0, x1 / frame_w)),
                    y1_norm=max(0.0, min(1.0, y1 / frame_h)),
                    x2_norm=max(0.0, min(1.0, x2 / frame_w)),
                    y2_norm=max(0.0, min(1.0, y2 / frame_h)),
                    conf=float(conf),
                )
            )

        count = len(accepted_boxes)
        avg_conf = float(sum(accepted_confs) / count) if count else 0.0
        return VisionResult(chair_count=count, average_conf=avg_conf, detections=accepted_boxes)
