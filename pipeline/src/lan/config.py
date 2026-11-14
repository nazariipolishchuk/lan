"""Paths and environment. Secrets are read from the environment only and never printed."""

from __future__ import annotations

import os
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = PIPELINE_DIR.parent
DATA_DIR = Path(os.environ.get("LAN_DATA_DIR", REPO_DIR / "data"))
RAW_DIR = DATA_DIR / "raw"
WORK_DIR = DATA_DIR / "work"
OUT_DIR = DATA_DIR / "out"


def load_env(path: Path | None = None) -> None:
    """Copy KEY=VALUE lines from the git-ignored .env into os.environ (existing values win)."""
    path = path or REPO_DIR / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def earthdata_login():
    """Log in to NASA Earthdata with the token from the environment. Returns the earthaccess Auth."""
    import earthaccess

    load_env()
    if not os.environ.get("EARTHDATA_TOKEN"):
        raise RuntimeError("EARTHDATA_TOKEN is not set")
    return earthaccess.login(strategy="environment", persist=False)
