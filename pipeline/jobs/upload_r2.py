"""Upload a built data folder (data/out_us) to the Cloudflare R2 bucket under a prefix (default "us/").

Credentials come from .env (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET) and are never
printed. Files whose size and MD5 already match the bucket are skipped, so a rerun uploads only changes.
Usage: uv run python jobs/upload_r2.py [folder] [prefix] [--workers 16]
"""

from __future__ import annotations

import argparse
import hashlib
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

TYPES = {".pmtiles": "application/octet-stream", ".gz": "application/gzip", ".json": "application/json"}


def client():
    import boto3

    from lan.config import load_env

    load_env()
    return boto3.client("s3", endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
                        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"], aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
                        region_name="auto")


def main() -> int:
    from lan.config import DATA_DIR

    ap = argparse.ArgumentParser()
    ap.add_argument("folder", nargs="?", default=str(DATA_DIR / "out_us"))
    ap.add_argument("prefix", nargs="?", default="us/")
    ap.add_argument("--workers", type=int, default=16)
    a = ap.parse_args()
    root = Path(a.folder)
    s3 = client()
    bucket = os.environ["R2_BUCKET"]
    existing: dict[str, tuple[int, str]] = {}
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=a.prefix):
        for o in page.get("Contents", []):
            existing[o["Key"]] = (o["Size"], o["ETag"].strip('"'))
    files = [p for p in root.rglob("*") if p.is_file()]
    t0 = time.time()
    sent = [0, 0]

    def one(p: Path):
        key = a.prefix + p.relative_to(root).as_posix()
        data = p.read_bytes()
        if key in existing and existing[key] == (len(data), hashlib.md5(data).hexdigest()):
            return
        cache = "public, max-age=300" if p.name == "meta.json" else "public, max-age=86400"
        s3.put_object(Bucket=bucket, Key=key, Body=data, ContentType=TYPES.get(p.suffix, "application/octet-stream"), CacheControl=cache)
        sent[0] += 1
        sent[1] += len(data)

    with ThreadPoolExecutor(a.workers) as pool:
        for i, _ in enumerate(pool.map(one, files), 1):
            if i % 500 == 0 or i == len(files):
                print(f"{i}/{len(files)} checked, {sent[0]} uploaded, {sent[1] / 1e6:.0f} MB, {time.time() - t0:.0f}s", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
