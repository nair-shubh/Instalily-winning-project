from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class EventDB:
    def __init__(self, db_path: str):
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts_utc TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def log_event(self, event_type: str, payload: dict[str, Any]) -> None:
        ts = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO events(ts_utc, event_type, payload_json) VALUES (?, ?, ?)",
                (ts, event_type, json.dumps(payload)),
            )
            conn.commit()

    def recent_events(self, limit: int = 50) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT id, ts_utc, event_type, payload_json FROM events ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()

        out = []
        for row in rows:
            out.append(
                {
                    "id": row["id"],
                    "ts_utc": row["ts_utc"],
                    "event_type": row["event_type"],
                    "payload": json.loads(row["payload_json"]),
                }
            )
        return out
