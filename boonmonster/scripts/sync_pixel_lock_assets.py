#!/usr/bin/env python3
"""Materialize immutable PIXEL LOCK copies and a runtime registry for /boonmonster/."""
from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

AUDIT_ROOT = Path("/Users/ikegamiryuusuke/BOON_MONSTER_FULL_AUDIT_WORK")
REPO_ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = REPO_ROOT / "boonmonster/assets/pixel-lock"
REGISTRY_PATH = REPO_ROOT / "boonmonster/data/pixel_lock_registry.json"
MANIFESTS = (
    AUDIT_ROOT / "REMAINING_9_PIXEL_MASTER_2026-08-28/99_REPORTS/remaining_9_PIXEL_LOCK_manifest.json",
    AUDIT_ROOT / "CATEGORY_PIXEL_MASTER_REDESIGN_2026-08-27/99_REPORTS/category_36_PIXEL_LOCK_manifest.json",
    AUDIT_ROOT / "CATEGORY_PIXEL_MASTER_REDESIGN_2026-08-27/99_REPORTS/final_72_PIXEL_LOCK_manifest.json",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    records = []
    seen = set()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for manifest_path in MANIFESTS:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        for item in payload["items"]:
            spec_id = item["spec_id"]
            if spec_id in seen:
                raise RuntimeError(f"duplicate locked Spec ID: {spec_id}")
            seen.add(spec_id)
            source = AUDIT_ROOT / item["locked_pixel_path"]
            if not source.is_file():
                raise FileNotFoundError(source)
            actual_sha = sha256(source)
            if actual_sha != item["sha256"]:
                raise RuntimeError(f"SHA mismatch for {spec_id}")
            target = OUT_DIR / source.name
            if target.exists() and sha256(target) != actual_sha:
                raise RuntimeError(f"refusing to overwrite changed runtime asset: {target}")
            if not target.exists():
                shutil.copy2(source, target)
            records.append({
                "specId": spec_id,
                "fileKey": item.get("file_key") or source.name,
                "runtimePath": f"./assets/pixel-lock/{target.name}",
                "sha256": actual_sha,
                "width": 96,
                "height": 96,
                "stage": item.get("stage") or ("final" if spec_id.endswith(("-L", "-D")) else "category"),
                "sourceLockManifest": str(manifest_path.relative_to(AUDIT_ROOT)),
            })
    if len(records) != 117:
        raise RuntimeError(f"expected 117 lock records, got {len(records)}")
    REGISTRY_PATH.write_text(json.dumps({
        "registryVersion": "2026-08-29",
        "lockStatus": "PIXEL_LOCK",
        "assetCount": len(records),
        "assets": records,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"assetCount": len(records), "registry": str(REGISTRY_PATH), "assetDir": str(OUT_DIR)}))


if __name__ == "__main__":
    main()
