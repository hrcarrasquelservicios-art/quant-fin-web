#!/usr/bin/env python3
"""
patch_live_signals.py
Agrega el campo 'mode': 'DEMO' a todas las señales en live_signals.json
que no lo tengan, y copia al dist/ también.
"""
import json, shutil, sys
from pathlib import Path

BASE = Path(__file__).parent
SRC  = BASE / "public" / "live_signals.json"
DIST = BASE / "dist"   / "live_signals.json"

with open(SRC, encoding="utf-8") as f:
    signals = json.load(f)

patched = 0
for sig in signals:
    if "mode" not in sig:
        sig["mode"] = "DEMO"
        patched += 1

with open(SRC, "w", encoding="utf-8") as f:
    json.dump(signals, f, indent=2, ensure_ascii=False)

print(f"[patch] {patched} señales actualizadas con mode=DEMO en {SRC}")

# Copiar al dist si existe
if DIST.parent.exists():
    shutil.copy(SRC, DIST)
    print(f"[patch] Copiado también a {DIST}")
else:
    print(f"[patch] {DIST.parent} no existe, saltando copia a dist/")

print(f"[patch] Total señales: {len(signals)}")
