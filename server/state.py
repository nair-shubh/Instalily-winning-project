from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
import time


class SystemState(str, Enum):
    IDLE = "IDLE"
    STREAMING = "STREAMING"
    BASELINED = "BASELINED"
    ARMED = "ARMED"
    COOLDOWN = "COOLDOWN"


@dataclass
class FrameEvaluation:
    state: SystemState
    baseline_count: int | None
    observed_count: int | None
    diff: int
    discrepancy_streak: int
    cooldown_remaining_sec: float
    should_alert: bool


class InventoryStateMachine:
    def __init__(self, debounce_k: int, cooldown_sec: int):
        self.debounce_k = debounce_k
        self.cooldown_sec = cooldown_sec
        self.state = SystemState.IDLE
        self.baseline_count: int | None = None
        self.last_observed_count: int | None = None
        self.discrepancy_streak = 0
        self.cooldown_until_monotonic = 0.0

    def on_stream_started(self) -> None:
        if self.state == SystemState.IDLE:
            self.state = SystemState.STREAMING

    def set_baseline(self, count: int) -> None:
        self.baseline_count = count
        self.discrepancy_streak = 0
        self.cooldown_until_monotonic = 0.0
        self.state = SystemState.BASELINED

    def arm(self) -> None:
        if self.baseline_count is None:
            return
        self.discrepancy_streak = 0
        if self.state != SystemState.COOLDOWN:
            self.state = SystemState.ARMED

    def disarm(self) -> None:
        if self.baseline_count is not None:
            self.state = SystemState.BASELINED
            self.discrepancy_streak = 0

    def reset(self) -> None:
        self.state = SystemState.IDLE
        self.baseline_count = None
        self.last_observed_count = None
        self.discrepancy_streak = 0
        self.cooldown_until_monotonic = 0.0

    def evaluate(self, observed_count: int) -> FrameEvaluation:
        now = time.monotonic()
        self.last_observed_count = observed_count
        baseline = self.baseline_count
        diff = 0 if baseline is None else observed_count - baseline

        cooldown_remaining = max(0.0, self.cooldown_until_monotonic - now)
        if self.state == SystemState.COOLDOWN and cooldown_remaining <= 0:
            self.state = SystemState.ARMED

        should_alert = False

        if self.state in (SystemState.IDLE, SystemState.STREAMING):
            self.discrepancy_streak = 0
        elif self.state in (SystemState.BASELINED,):
            self.discrepancy_streak = 0
        elif self.state == SystemState.ARMED:
            if diff == 0:
                self.discrepancy_streak = 0
            else:
                self.discrepancy_streak += 1
                if self.discrepancy_streak >= self.debounce_k:
                    should_alert = True
                    self.discrepancy_streak = 0
                    self.state = SystemState.COOLDOWN
                    self.cooldown_until_monotonic = now + self.cooldown_sec
                    cooldown_remaining = float(self.cooldown_sec)
        elif self.state == SystemState.COOLDOWN:
            self.discrepancy_streak = 0

        return FrameEvaluation(
            state=self.state,
            baseline_count=self.baseline_count,
            observed_count=observed_count,
            diff=diff,
            discrepancy_streak=self.discrepancy_streak,
            cooldown_remaining_sec=cooldown_remaining,
            should_alert=should_alert,
        )
