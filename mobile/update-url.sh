#!/bin/bash
# Resolves the production API URL and writes mobile/.env.local
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.local"

resolve_url() {
  # 1. Explicit argument
  if [ "${1:-}" != "" ]; then
    echo "$1"
    return 0
  fi

  # 2. Parent project .env / .env.local NEXT_PUBLIC_APP_URL
  for f in "$ROOT_DIR/.env.local" "$ROOT_DIR/.env"; do
    if [ -f "$f" ]; then
      url=$(grep -E '^NEXT_PUBLIC_APP_URL=' "$f" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
      if [ -n "$url" ]; then
        echo "$url"
        return 0
      fi
    fi
  done

  # 3. GitHub deployments API (qubex-tech org repos)
  for repo in "qubex-tech/VantageAI-CRM" "qubex-tech/medical-crm"; do
    url=$(curl -s "https://api.github.com/repos/$repo/deployments?per_page=20&environment=Production" \
      -H "Accept: application/vnd.github.v3+json" | python3 -c "
import json, sys, urllib.request
try:
    deps = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(0)
for d in deps:
    if 'production' not in d.get('environment', '').lower():
        continue
    dep_id = d['id']
    req = urllib.request.Request(
        f'https://api.github.com/repos/$repo/deployments/{dep_id}/statuses',
        headers={'Accept': 'application/vnd.github.v3+json'}
    )
    statuses = json.loads(urllib.request.urlopen(req).read())
    if statuses and statuses[0]['state'] == 'success':
        url = statuses[0].get('environment_url', '')
        if url:
            print(url)
            break
" 2>/dev/null || true)
    if [ -n "$url" ]; then
      echo "$url"
      return 0
    fi
  done

  return 1
}

echo "Resolving production API URL..."

LATEST_URL="$(resolve_url "${1:-}")" || {
  echo "Could not resolve production URL."
  echo "Usage: ./update-url.sh https://your-production-app.vercel.app"
  exit 1
}

LATEST_URL="${LATEST_URL%/}"
echo "EXPO_PUBLIC_API_URL=$LATEST_URL" > "$ENV_FILE"
echo "✓ Updated $ENV_FILE"
echo "  EXPO_PUBLIC_API_URL=$LATEST_URL"
echo ""
echo "For EAS production builds, also run:"
echo "  eas env:create --name EXPO_PUBLIC_API_URL --value $LATEST_URL --environment production"
