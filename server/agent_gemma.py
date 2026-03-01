"""
Fine-tuned Gemma agent for inventory function calling.

Loads gemma-2-2b-it + QLoRA adapter and decides one of:
  - trigger_alert(severity, message)
  - ignore_event(reason)
  - rebaseline(new_count)

Runs as a background thread so it never blocks the WebSocket loop.
Falls back gracefully if model is not loaded.
"""
from __future__ import annotations

import re
import threading
from dataclasses import dataclass
from typing import Any, Callable


SYSTEM_PROMPT = (
    "You are an on-device inventory agent monitoring cups in a staging area.\n"
    "Decision rules:\n"
    "- If streak >= 6 AND confidence >= 0.40: trigger_alert\n"
    "- If streak >= 20: rebaseline (scene has been reorganized)\n"
    "- If streak < 6: ignore_event (too early to be sure)\n"
    "- If confidence < 0.40: ignore_event (detection unreliable)\n"
    "Call exactly one function. Reply with ONLY the function call."
)


@dataclass
class GemmaDecision:
    action: str            # "trigger_alert" | "ignore_event" | "rebaseline"
    severity: str | None   # for trigger_alert
    message: str | None    # for trigger_alert
    reason: str | None     # for ignore_event
    new_count: int | None  # for rebaseline
    raw_output: str = ""


def _parse_output(text: str, observed_count: int) -> GemmaDecision:
    """Parse Gemma function call output into a structured decision."""
    text = text.strip()

    if text.startswith("trigger_alert"):
        sev_m = re.search(r'severity=["\']([^"\']+)["\']', text)
        msg_m = re.search(r'message=["\']([^"\']+)["\']', text)
        return GemmaDecision(
            action="trigger_alert",
            severity=sev_m.group(1) if sev_m else "medium",
            message=msg_m.group(1) if msg_m else "Inventory change detected.",
            reason=None,
            new_count=None,
            raw_output=text,
        )

    if text.startswith("rebaseline"):
        cnt_m = re.search(r'new_count=(\d+)', text)
        return GemmaDecision(
            action="rebaseline",
            severity=None,
            message=None,
            reason=None,
            new_count=int(cnt_m.group(1)) if cnt_m else observed_count,
            raw_output=text,
        )

    # ignore_event (default fallback)
    reason_m = re.search(r'reason=["\']([^"\']+)["\']', text)
    return GemmaDecision(
        action="ignore_event",
        severity=None,
        message=None,
        reason=reason_m.group(1) if reason_m else "No significant change.",
        new_count=None,
        raw_output=text,
    )


class GemmaAgent:
    def __init__(self, base_model_id: str, adapter_path: str, hf_token: str | None):
        self.base_model_id = base_model_id
        self.adapter_path = adapter_path
        self.hf_token = hf_token
        self._model = None
        self._tokenizer = None
        self._lock = threading.Lock()
        self._loaded = False
        self._load_error: str | None = None

    def load(self) -> bool:
        """Load model in background thread. Returns True if successful."""
        if self._loaded:
            return True
        if self._load_error:
            return False

        try:
            import torch
            from transformers import AutoTokenizer, AutoModelForCausalLM
            from peft import PeftModel

            print(f"[GemmaAgent] Loading {self.base_model_id} + adapter...")
            device = "mps" if torch.backends.mps.is_available() else "cpu"

            self._tokenizer = AutoTokenizer.from_pretrained(
                self.adapter_path,
                token=self.hf_token,
            )
            base = AutoModelForCausalLM.from_pretrained(
                self.base_model_id,
                token=self.hf_token,
                torch_dtype=torch.bfloat16,
                device_map=device,
            )
            self._model = PeftModel.from_pretrained(base, self.adapter_path)
            self._model.eval()
            self._loaded = True
            print(f"[GemmaAgent] Ready on {device}")
            return True

        except Exception as e:
            self._load_error = str(e)
            print(f"[GemmaAgent] Load failed: {e}")
            return False

    def load_async(self) -> None:
        """Start loading model in background thread."""
        t = threading.Thread(target=self.load, daemon=True)
        t.start()

    @property
    def is_ready(self) -> bool:
        return self._loaded

    def decide(
        self,
        item_count: int,
        baseline_count: int,
        streak: int,
        avg_conf: float,
        history: list[int],
    ) -> GemmaDecision | None:
        """Run inference. Returns None if model not ready."""
        if not self._loaded:
            return None

        diff = item_count - baseline_count
        scene = (
            f"Cups visible: {item_count}\n"
            f"Baseline: {baseline_count}\n"
            f"Diff: {diff:+d}\n"
            f"Streak: {streak} consecutive discrepant frames\n"
            f"Confidence: {avg_conf:.2f}\n"
            f"History: {history[-8:]}"
        )
        prompt = (
            f"<start_of_turn>system\n{SYSTEM_PROMPT}<end_of_turn>\n"
            f"<start_of_turn>user\n{scene}<end_of_turn>\n"
            f"<start_of_turn>model\n"
        )

        try:
            import torch
            with self._lock:
                inputs = self._tokenizer(prompt, return_tensors="pt").to(self._model.device)
                with torch.no_grad():
                    out = self._model.generate(
                        **inputs,
                        max_new_tokens=40,
                        do_sample=False,
                        temperature=1.0,
                    )
                decoded = self._tokenizer.decode(
                    out[0][inputs["input_ids"].shape[1]:],
                    skip_special_tokens=True,
                ).strip()
            return _parse_output(decoded, item_count)
        except Exception as e:
            print(f"[GemmaAgent] Inference error: {e}")
            return None

    def decide_async(
        self,
        item_count: int,
        baseline_count: int,
        streak: int,
        avg_conf: float,
        history: list[int],
        callback: Callable[[GemmaDecision], Any],
    ) -> None:
        """Run inference in background thread, call callback with result."""
        def _run():
            decision = self.decide(item_count, baseline_count, streak, avg_conf, history)
            if decision:
                callback(decision)

        threading.Thread(target=_run, daemon=True).start()
