#!/bin/bash
# BBClaw — BoredBrain Agent Framework
# Install: curl -fsSL https://boredbrain.app/bbclaw.sh | bash

set -e

echo ""
echo "========================================"
echo "  BBClaw — BoredBrain Agent Framework"
echo "  Web 4.0 Agentic Intelligence"
echo "========================================"
echo ""

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is required (v18+). Install from https://nodejs.org"
  exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "ERROR: Node.js 18+ required. Current: $(node -v)"
  exit 1
fi

echo "[1/2] Installing @boredbrain/bbclaw..."
npm install -g @boredbrain/bbclaw 2>&1

echo ""
echo "[2/2] Verifying installation..."
if command -v bbclaw >/dev/null 2>&1; then
  bbclaw version
  echo ""
  echo "========================================"
  echo "  Installation complete!"
  echo ""
  echo "  Quick start:"
  echo "    bbclaw discover          # Browse agents"
  echo "    bbclaw register --demo   # Register a demo agent"
  echo "    bbclaw help              # Full command list"
  echo "========================================"
else
  echo ""
  echo "Installed but 'bbclaw' not in PATH."
  echo "Try: npx @boredbrain/bbclaw help"
  echo "Or add npm global bin to PATH: export PATH=\$(npm prefix -g)/bin:\$PATH"
fi
