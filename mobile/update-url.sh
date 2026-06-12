#!/bin/bash
# Fetches the latest successful Vercel PRODUCTION deployment URL and updates .env.local
set -e

echo "Fetching latest production deployment URL..."

LATEST_URL=$(curl -s "https://api.github.com/repos/qubex-tech/VantageAI-CRM/deployments?per_page=20&environment=Production" \
  -H "Accept: application/vnd.github.v3+json" | python3 -c "
import json, sys, urllib.request

deps = json.load(sys.stdin)
for d in deps:
    env = d.get('environment', '')
    if 'production' not in env.lower():
        continue
    dep_id = d['id']
    resp = urllib.request.urlopen(
        urllib.request.Request(
            f'https://api.github.com/repos/qubex-tech/VantageAI-CRM/deployments/{dep_id}/statuses',
            headers={'Accept': 'application/vnd.github.v3+json'}
        )
    )
    statuses = json.loads(resp.read())
    if statuses and statuses[0]['state'] == 'success':
        url = statuses[0].get('environment_url', '')
        if url:
            print(url)
            break
")

if [ -z "$LATEST_URL" ]; then
  echo "Could not find latest production deployment URL"
  exit 1
fi

echo "EXPO_PUBLIC_API_URL=$LATEST_URL" > .env.local
echo "✓ Updated .env.local to: $LATEST_URL"
echo ""
echo "Now run: npx expo start --clear"
