#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# ── Virtual environment ────────────────────────────────────────────────────────
if [[ ! -d .venv ]]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q

# Ensure torch can consume numpy arrays in this environment.
if ! python3 - <<'PYEOF'
import sys
try:
    import numpy as np
    import torch
    _ = torch.from_numpy(np.zeros((1, 1), dtype=np.float32))
except Exception:
    sys.exit(1)
PYEOF
then
  echo "Fixing NumPy/OpenCV compatibility for torch..."
  pip install --upgrade --force-reinstall numpy==1.26.4 opencv-python==4.10.0.84 -q
fi

# ── YOLO model ─────────────────────────────────────────────────────────────────
if [[ ! -f models/yolov8n.pt ]]; then
  echo "Downloading YOLOv8n model..."
  python3 -c "
from ultralytics import YOLO
import shutil, os
YOLO('yolov8n.pt')
if os.path.exists('yolov8n.pt'):
    shutil.move('yolov8n.pt', 'models/yolov8n.pt')
"
fi

# ── TLS certificate (generated once, reused forever) ──────────────────────────
if [[ ! -f certs/cert.pem ]] || [[ ! -f certs/key.pem ]]; then
  echo "Generating self-signed TLS certificate..."
  mkdir -p certs
  LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo '127.0.0.1')"
  python3 - <<PYEOF
import datetime, ipaddress, pathlib
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
import datetime as dt

lan_ip = "$LAN_IP"
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
subject = issuer = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, u'inventory-copilot')])
now = dt.datetime.now(dt.timezone.utc)
cert = (
    x509.CertificateBuilder()
    .subject_name(subject)
    .issuer_name(issuer)
    .public_key(key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(now)
    .not_valid_after(now + dt.timedelta(days=365))
    .add_extension(x509.SubjectAlternativeName([
        x509.IPAddress(ipaddress.IPv4Address(lan_ip)),
        x509.IPAddress(ipaddress.IPv4Address('127.0.0.1')),
        x509.DNSName('localhost'),
    ]), critical=False)
    .sign(key, hashes.SHA256())
)
pathlib.Path('certs/key.pem').write_bytes(
    key.private_bytes(serialization.Encoding.PEM,
                      serialization.PrivateFormat.TraditionalOpenSSL,
                      serialization.NoEncryption()))
pathlib.Path('certs/cert.pem').write_bytes(cert.public_bytes(serialization.Encoding.PEM))
print(f"Certificate generated for IP: {lan_ip}")
PYEOF
fi

# ── Print access URLs ──────────────────────────────────────────────────────────
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo '127.0.0.1')"
echo ""
echo "┌─────────────────────────────────────────────────┐"
echo "│  Server starting on HTTPS                        │"
echo "│                                                   │"
echo "│  Phone app : https://${LAN_IP}:8000              │"
echo "│  Dashboard : https://${LAN_IP}:8000/dashboard    │"
echo "│  Local     : https://localhost:8000               │"
echo "│                                                   │"
echo "│  ⚠ Accept the self-signed cert warning once      │"
echo "└─────────────────────────────────────────────────┘"
echo ""

# ── Start server ───────────────────────────────────────────────────────────────
exec uvicorn server.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --ssl-keyfile certs/key.pem \
  --ssl-certfile certs/cert.pem
