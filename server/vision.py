from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
from ultralytics import YOLO


@dataclass
class VisionResult:
    chair_count: int
    average_conf: float


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
            return VisionResult(chair_count=0, average_conf=0.0)

        result = results[0]
        boxes: Any = result.boxes
        if boxes is None or boxes.cls is None or boxes.conf is None:
            return VisionResult(chair_count=0, average_conf=0.0)

        classes = boxes.cls.tolist()
        confs = boxes.conf.tolist()

        accepted = [
            conf
            for cls_id, conf in zip(classes, confs)
            if int(cls_id) == self.chair_class_id and float(conf) >= self.conf_threshold
        ]

        count = len(accepted)
        avg_conf = float(sum(accepted) / count) if count else 0.0
        return VisionResult(chair_count=count, average_conf=avg_conf)
