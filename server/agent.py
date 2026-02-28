from __future__ import annotations

import httpx


def deterministic_alert_text(diff: int) -> str:
    if diff == -1:
        return "Mr. Richard, one chair was removed."
    if diff < -1:
        return f"Mr. Richard, {abs(diff)} chairs were removed."
    if diff == 1:
        return "Mr. Richard, one chair was added."
    if diff > 1:
        return f"Mr. Richard, {diff} chairs were added."
    return "Mr. Richard, chair count is unchanged."


class AlertAgent:
    def __init__(self, ollama_base_url: str, ollama_model: str, timeout_sec: float):
        self.ollama_base_url = ollama_base_url.rstrip("/")
        self.ollama_model = ollama_model
        self.timeout_sec = timeout_sec

    def generate_alert_text(self, baseline_count: int, observed_count: int, diff: int) -> str:
        # Hard fallback for exact phrasing requirements.
        fallback = deterministic_alert_text(diff)
        if diff == 0:
            return fallback

        try:
            prompt = (
                "You generate one short inventory alert sentence. "
                "Do not invent counts. "
                f"Baseline={baseline_count}, Observed={observed_count}, Diff={diff}. "
                "Use this exact salutation: Mr. Richard. "
                "Respond with one sentence only."
            )
            payload = {
                "model": self.ollama_model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.1},
            }
            with httpx.Client(timeout=self.timeout_sec) as client:
                resp = client.post(f"{self.ollama_base_url}/api/generate", json=payload)
                resp.raise_for_status()
                data = resp.json()

            text = str(data.get("response", "")).strip()
            if not text:
                return fallback

            # Guardrail: if generated text does not mention expected numeric direction,
            # return deterministic template.
            if diff < 0 and "remove" not in text.lower():
                return fallback
            if diff > 0 and "add" not in text.lower():
                return fallback
            return text
        except Exception:
            return fallback
