"""
Synthetic dataset for QLoRA fine-tune.
Clear decision rules:
  - streak >= 6 AND conf >= 0.40 → trigger_alert
  - streak >= 20              → rebaseline (count stable for too long)
  - streak < 6                → ignore_event (too early)
  - conf < 0.40               → ignore_event (unreliable)
"""
import json, random
from pathlib import Path

SYSTEM = """You are an on-device inventory agent monitoring cups in a staging area.
Decision rules:
- If streak >= 6 AND confidence >= 0.40: trigger_alert
- If streak >= 20: rebaseline (scene has been reorganized)
- If streak < 6: ignore_event (too early to be sure)
- If confidence < 0.40: ignore_event (detection unreliable)
Call exactly one function. Reply with ONLY the function call."""

def scene(count, baseline, streak, conf, history):
    diff = count - baseline
    return (
        f"Cups visible: {count}\n"
        f"Baseline: {baseline}\n"
        f"Diff: {diff:+d}\n"
        f"Streak: {streak} consecutive discrepant frames\n"
        f"Confidence: {conf:.2f}\n"
        f"History: {history}"
    )

def fmt(user, assistant):
    return {"text": (
        f"<start_of_turn>system\n{SYSTEM}<end_of_turn>\n"
        f"<start_of_turn>user\n{user}<end_of_turn>\n"
        f"<start_of_turn>model\n{assistant}<end_of_turn>"
    )}

def generate(n=500):
    examples = []

    # trigger_alert: streak 6-19, conf >= 0.40
    for _ in range(n // 3):
        baseline = random.choice([3, 4, 5, 6, 8, 10])
        diff = random.choice([-1, -2, -3, 1, 2])
        count = max(0, baseline + diff)
        streak = random.randint(6, 19)
        conf = round(random.uniform(0.40, 0.97), 2)
        history = [baseline] * 2 + [count] * min(streak, 6)
        n_word = abs(diff)
        item = "cup" if n_word == 1 else "cups"
        direction = "removed" if diff < 0 else "added"
        sev = "high" if abs(diff) > 1 or streak > 12 else "medium"
        call = f'trigger_alert(severity="{sev}", message="Mr. Richard, {n_word} {item} {direction} from staging area.")'
        examples.append(fmt(scene(count, baseline, streak, conf, str(history[-8:])), call))

    # rebaseline: streak >= 20
    for _ in range(n // 5):
        baseline = random.choice([3, 4, 5, 6, 8, 10])
        diff = random.choice([-2, -3, 2, 3, -1, 1])
        count = max(0, baseline + diff)
        streak = random.randint(20, 40)
        conf = round(random.uniform(0.50, 0.95), 2)
        history = [baseline] * 2 + [count] * 6
        call = f'rebaseline(new_count={count})'
        examples.append(fmt(scene(count, baseline, streak, conf, str(history[-8:])), call))

    # ignore — low streak (< 6)
    for _ in range(n // 4):
        baseline = random.choice([3, 4, 5, 6, 8, 10])
        diff = random.choice([-1, 1, -2, 2])
        count = max(0, baseline + diff)
        streak = random.randint(1, 5)
        conf = round(random.uniform(0.40, 0.96), 2)
        history = [baseline, baseline, count, baseline, count, count]
        call = f'ignore_event(reason="Only {streak} discrepant frames. Waiting for confirmation.")'
        examples.append(fmt(scene(count, baseline, streak, conf, str(history[-8:])), call))

    # ignore — low confidence (< 0.40)
    for _ in range(n // 4):
        baseline = random.choice([3, 4, 5, 6, 8, 10])
        diff = random.choice([-1, 1, -2, 2])
        count = max(0, baseline + diff)
        streak = random.randint(1, 15)
        conf = round(random.uniform(0.10, 0.39), 2)
        history = [baseline, count, baseline, count, count]
        call = f'ignore_event(reason="Confidence too low ({conf:.2f}). Detection unreliable.")'
        examples.append(fmt(scene(count, baseline, streak, conf, str(history[-8:])), call))

    return examples

if __name__ == "__main__":
    data = generate(500)
    random.shuffle(data)
    split = int(len(data) * 0.9)

    Path("data").mkdir(exist_ok=True)
    with open("data/train.jsonl", "w") as f:
        for ex in data[:split]: f.write(json.dumps(ex) + "\n")
    with open("data/eval.jsonl", "w") as f:
        for ex in data[split:]: f.write(json.dumps(ex) + "\n")

    print(f"Generated {split} train + {len(data)-split} eval examples")
    # Count by class
    calls = [json.loads(l)["text"].split("<start_of_turn>model\n")[1] for l in open("data/train.jsonl")]
    alerts = sum(1 for c in calls if c.startswith("trigger"))
    rebases = sum(1 for c in calls if c.startswith("rebase"))
    ignores = sum(1 for c in calls if c.startswith("ignore"))
    print(f"  trigger_alert: {alerts}, rebaseline: {rebases}, ignore_event: {ignores}")
