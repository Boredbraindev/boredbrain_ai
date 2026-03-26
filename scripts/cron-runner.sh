#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# BBClaw Cron Runner — runs on dev server, calls Vercel API endpoints
#
# Setup on dev server:
#   1. Copy this file to ~/boredbrain/cron-runner.sh
#   2. chmod +x ~/boredbrain/cron-runner.sh
#   3. Set CRON_SECRET in ~/boredbrain/.env
#   4. Add crontab entries (see bottom of this file)
#
# This replaces all Vercel crons → saves ~$130+/month in function costs
# ─────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

# Load environment
if [ -f "$ENV_FILE" ]; then
  source "$ENV_FILE"
fi

BASE_URL="${BASE_URL:-https://boredbrain.app}"
CRON_SECRET="${CRON_SECRET:?CRON_SECRET is required — set it in $ENV_FILE}"
LOG_DIR="${SCRIPT_DIR}/logs"
mkdir -p "$LOG_DIR"

# ─── Helper ──────────────────────────────────────────────────────

call_api() {
  local endpoint="$1"
  local label="$2"
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"

  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    --max-time 65 \
    "${BASE_URL}${endpoint}" 2>/dev/null || echo "000")

  echo "[${timestamp}] ${label}: ${status}" >> "${LOG_DIR}/cron.log"

  if [ "$status" != "200" ]; then
    echo "[${timestamp}] WARN ${label} returned ${status}" >> "${LOG_DIR}/cron-errors.log"
  fi
}

# ─── Commands ────────────────────────────────────────────────────

case "${1:-help}" in
  heartbeat)
    call_api "/api/agents/heartbeat" "heartbeat"
    ;;
  participate)
    call_api "/api/topics/participate" "participate"
    ;;
  collect)
    call_api "/api/topics/collect" "collect"
    ;;
  qc)
    call_api "/api/qc" "qc"
    ;;
  all)
    # Run all crons sequentially (for testing)
    call_api "/api/agents/heartbeat" "heartbeat"
    call_api "/api/topics/participate" "participate"
    call_api "/api/topics/collect" "collect"
    call_api "/api/qc" "qc"
    ;;
  status)
    echo "=== Last 20 cron runs ==="
    tail -20 "${LOG_DIR}/cron.log" 2>/dev/null || echo "(no logs yet)"
    echo ""
    echo "=== Recent errors ==="
    tail -10 "${LOG_DIR}/cron-errors.log" 2>/dev/null || echo "(none)"
    ;;
  help|*)
    echo "Usage: $0 {heartbeat|participate|collect|qc|all|status}"
    echo ""
    echo "Crontab entries (paste with: crontab -e):"
    echo "──────────────────────────────────────────"
    echo "*/10 * * * * ${SCRIPT_DIR}/cron-runner.sh heartbeat"
    echo "*/15 * * * * ${SCRIPT_DIR}/cron-runner.sh participate"
    echo "0 */2 * * *  ${SCRIPT_DIR}/cron-runner.sh collect"
    echo "0 */12 * * * ${SCRIPT_DIR}/cron-runner.sh qc"
    echo "──────────────────────────────────────────"
    ;;
esac
