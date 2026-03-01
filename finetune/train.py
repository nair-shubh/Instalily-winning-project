"""
QLoRA fine-tune of gemma-2-9b-it for inventory function calling.

Fine-tuning type: QLoRA (Quantized LoRA / SFT)
- Base model loaded in 4-bit NF4 quantization (frozen)
- LoRA adapters trained on top (~0.5% of params)
- Output: lora adapter folder you copy to MacBook for inference

Usage:
  HF_TOKEN=hf_xxx python train.py
"""
import os
from datasets import Dataset
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer, SFTConfig
import torch, json

HF_TOKEN   = os.environ["HF_TOKEN"]
MODEL_ID   = "google/gemma-2-2b-it"
OUTPUT_DIR = "./gemma-inventory-agent"

# ── 4-bit quantization config (QLoRA) ─────────────────────────────────────────
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)

# ── LoRA config ────────────────────────────────────────────────────────────────
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

def load_jsonl(path):
    with open(path) as f:
        return [json.loads(l) for l in f]

print("Loading model...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, token=HF_TOKEN)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    token=HF_TOKEN,
    quantization_config=bnb_config,
    device_map="auto",
)
model = prepare_model_for_kbit_training(model)
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

train_ds = Dataset.from_list(load_jsonl("data/train.jsonl"))
eval_ds  = Dataset.from_list(load_jsonl("data/eval.jsonl"))

training_args = SFTConfig(
    output_dir=OUTPUT_DIR,
    num_train_epochs=10,
    per_device_train_batch_size=16,
    gradient_accumulation_steps=1,
    warmup_steps=10,
    learning_rate=2e-4,
    bf16=True,
    logging_steps=10,
    eval_strategy="steps",
    eval_steps=50,
    save_steps=100,
    save_total_limit=1,
    load_best_model_at_end=True,
    report_to="none",
    dataset_text_field="text",
)

trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=train_ds,
    eval_dataset=eval_ds,
    processing_class=tokenizer,
)

print("Training...")
trainer.train()
trainer.model.save_pretrained(f"{OUTPUT_DIR}/final")
tokenizer.save_pretrained(f"{OUTPUT_DIR}/final")
print(f"Saved to {OUTPUT_DIR}/final")
