#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REGISTRY="$ROOT/assets/machines/machine-registry.json"

if ! command -v python3 >/dev/null 2>&1; then
  echo "FAIL: python3 is required to verify machine assets." >&2
  exit 2
fi

python3 - "$ROOT" "$REGISTRY" <<'PY'
import hashlib
import json
import os
import sys

root, registry_path = sys.argv[1], sys.argv[2]
failures = []
checks = 0


def fail(msg):
    failures.append(msg)
    print(f"FAIL  {msg}")


def ok(msg):
    print(f"PASS  {msg}")


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def require_file(path, label):
    global checks
    checks += 1
    if not os.path.isfile(path):
        fail(f"missing {label}: {os.path.relpath(path, root)}")
        return False
    ok(f"exists {label}: {os.path.relpath(path, root)}")
    return True


def compare(src, dst, label):
    global checks
    checks += 1
    if not os.path.isfile(src):
        fail(f"missing COMMON source for {label}: {os.path.relpath(src, root)}")
        return
    if not os.path.isfile(dst):
        fail(f"missing runtime copy for {label}: {os.path.relpath(dst, root)}")
        return
    a, b = sha256(src), sha256(dst)
    if a != b:
        fail(f"SHA-256 mismatch {label}: {os.path.relpath(src, root)} != {os.path.relpath(dst, root)}")
    else:
        ok(f"SHA-256 {label}: {a[:12]}…")

if not os.path.isfile(registry_path):
    print(f"FAIL: missing registry: {registry_path}", file=sys.stderr)
    sys.exit(1)

try:
    with open(registry_path, encoding="utf-8") as f:
        registry = json.load(f)
except Exception as e:
    print(f"FAIL: invalid registry JSON: {e}", file=sys.stderr)
    sys.exit(1)

machines = registry.get("machines")
if not isinstance(machines, list) or len(machines) != 9:
    fail(f"registry must contain exactly 9 machines; got {len(machines) if isinstance(machines, list) else 'invalid'}")
else:
    ok("registry contains 9 machines")
    checks += 1

ids = [m.get("id") for m in machines if isinstance(m, dict)]
if len(ids) != len(set(ids)):
    fail("registry contains duplicate machine IDs")
else:
    ok("machine IDs are unique")
    checks += 1

nums = [m.get("seriesNumber") for m in machines if isinstance(m, dict)]
if sorted(nums) != list(range(1, 10)):
    fail(f"seriesNumber must be 1..9 exactly; got {nums}")
else:
    ok("seriesNumber is exactly 1..9")
    checks += 1

jump_parts = {"body.png", "boost.png", "shadow.png", "front.png", "rear.png", "front-wheel.png", "rear-wheel.png"}
run_parts = {"body.png", "boost.png", "shadow.png", "front-wheel.png", "rear-wheel.png", "complete.png"}

for m in machines:
    mid = m["id"]
    card_rel = m["card"]
    parts = m.get("commonParts", [])
    common_dir = os.path.join(root, "assets", "machines", "common", mid)

    for part in parts:
        src = os.path.join(common_dir, part)
        require_file(src, f"COMMON {mid}/{part}")
        if part in jump_parts:
            dst = os.path.join(root, "boonjump", "assets", "cars", f"{mid}-{part}")
            compare(src, dst, f"JUMP {mid}/{part}")
        if part in run_parts:
            dst = os.path.join(root, "boonrun", "assets", "cars", f"{mid}-{part}")
            compare(src, dst, f"RUN {mid}/{part}")

    card_src = os.path.join(root, "assets", "machines", card_rel)
    card_name = os.path.basename(card_rel)
    require_file(card_src, f"COMMON card {mid}")
    compare(card_src, os.path.join(root, "boonjump", "assets", "cards", card_name), f"JUMP card {mid}")
    compare(card_src, os.path.join(root, "boonrun", "assets", "cards", f"{mid}.webp"), f"RUN card {mid}")

# Exact card counts catch stale/extra runtime card copies as well as missing files.
for label, folder in [
    ("COMMON", os.path.join(root, "assets", "machines", "cards")),
    ("JUMP", os.path.join(root, "boonjump", "assets", "cards")),
    ("RUN", os.path.join(root, "boonrun", "assets", "cards")),
]:
    global_checks = [n for n in os.listdir(folder) if n.lower().endswith(".webp")] if os.path.isdir(folder) else []
    checks += 1
    if len(global_checks) != 9:
        fail(f"{label} MACHINE CARD count must be 9; got {len(global_checks)}")
    else:
        ok(f"{label} MACHINE CARD count is 9")

# Known legacy alias must never return as a machine asset filename.
checks += 1
legacy = []
for folder in [os.path.join(root, "boonjump", "assets", "cars"), os.path.join(root, "boonrun", "assets", "cars")]:
    if os.path.isdir(folder):
        legacy.extend(os.path.join(folder, n) for n in os.listdir(folder) if n.startswith("suv-"))
if legacy:
    fail("forbidden legacy alias detected: " + ", ".join(os.path.relpath(x, root) for x in legacy))
else:
    ok("forbidden legacy alias absent: suv-*")

print("\n=== ASOBooN MACHINE ASSET VERIFY ===")
print(f"specVersion: {registry.get('specVersion', 'unknown')}")
print(f"checks: {checks}")
print(f"failures: {len(failures)}")
if failures:
    print("RESULT: FAIL")
    sys.exit(1)
print("RESULT: PASS")
PY
