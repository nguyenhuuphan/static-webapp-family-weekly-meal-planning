#!/usr/bin/env bash
# Called during the Codex setup phase, where environment Secrets are available.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo 'Cloudflare deployment not started: token is unavailable during setup.'
  exit 0
fi
cloudflare_report=/workspace/scratch/cloudflare-migration-status.json
python3 scripts/cloudflare-setup.py \
  --email "${CLOUDFLARE_ALLOWED_EMAIL:?Set the approved owner email for setup}" \
  --seed-defaults \
  --provision-without-secrets \
  --report "$cloudflare_report"
