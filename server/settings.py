from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))

    # Vision tuning
    yolo_model: str = os.getenv("YOLO_MODEL", "./models/yolov8n.pt")
    chair_class_name: str = os.getenv("CHAIR_CLASS_NAME", "cup")
    conf_threshold: float = float(os.getenv("CONF_THRESHOLD", "0.20"))

    # Streaming controls
    max_frame_width: int = int(os.getenv("MAX_FRAME_WIDTH", "960"))
    max_frame_height: int = int(os.getenv("MAX_FRAME_HEIGHT", "540"))

    # State machine defaults
    debounce_k: int = int(os.getenv("DEBOUNCE_K", "5"))
    cooldown_sec: int = int(os.getenv("COOLDOWN_SEC", "10"))

    # Agent / Ollama
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "gemma2:2b")
    ollama_timeout_sec: float = float(os.getenv("OLLAMA_TIMEOUT_SEC", "2.5"))

    # Persistence
    sqlite_path: str = os.getenv("SQLITE_PATH", "./inventory_events.db")


settings = Settings()
