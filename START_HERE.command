#!/bin/bash
set -Eeuo pipefail
cd "$(dirname "$0")"
SITE_ID="3cfe75c9-5913-46a0-953f-eeae1a288a52"
SITE_URL="https://elegant-swan-98c20a.netlify.app"
VERSION="4.7.9"
LIVE_BASELINE_VERSION="4.7.8"

printf '\nX TRACKER - SAFE PRODUCTION UPDATE v%s\n' "$VERSION"
printf 'Existing site only: %s\n' "$SITE_URL"
printf 'This deployment DOES NOT modify the Google Sheet or reset click data.\n\n'

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js 22.13+ is needed for Netlify deployment (not for routine sheet syncing)."
  echo "Install Node.js LTS from https://nodejs.org/ and run this file again."
  exit 1
fi
node -e 'const v=process.versions.node.split(".").map(Number);if(v[0]<22||(v[0]===22&&v[1]<13))process.exit(1)' || { echo 'Node.js 22.13+ required; update at https://nodejs.org/';exit 1;}
for f in public/app.js public/styles.css public/index.html netlify.toml netlify/functions/dashboard.mjs netlify/functions/redirect.mjs; do
  if [ ! -f "$f" ]; then echo "ERROR: Complete source missing $f. No deployment.";exit 1;fi
done

if ! command -v shasum >/dev/null 2>&1; then echo 'shasum not available; refusing unsafe deploy.'; exit 1;fi
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
printf '\n1/5  Checking the existing live website against the expected prior version...\n'
curl --fail --silent --show-error --location --max-time 25 "$SITE_URL/app.js?v=$LIVE_BASELINE_VERSION" > "$TMP_DIR/app.js" || { echo 'Could not inspect existing live JS; cancelled.';exit 1;}
curl --fail --silent --show-error --location --max-time 25 "$SITE_URL/styles.css?v=$LIVE_BASELINE_VERSION" > "$TMP_DIR/styles.css" || { echo 'Could not inspect existing live CSS; cancelled.';exit 1;}
curl --fail --silent --show-error --location --max-time 25 "$SITE_URL/.netlify/functions/dashboard" > "$TMP_DIR/live-dashboard.json" || { echo 'Cannot check live dashboard; cancelled.';exit 1; }
if ! grep -q '"uiVersion":"4.7.8"' "$TMP_DIR/live-dashboard.json" || ! grep -q '"ok":true' "$TMP_DIR/live-dashboard.json"; then
  echo 'STOP: This site is not on expected v4.7.8 or its dashboard is unhealthy. No deployment.'
  exit 1
fi
if ! grep -q "const APP_VERSION='4.7.8'" "$TMP_DIR/app.js"; then
  echo 'STOP: The live frontend does not match expected v4.7.8. No deployment.'
  exit 1
fi
printf 'Verified: site is on v4.7.8 and healthy. Backup will be saved before publishing.\n'

printf '\n2/5  Backing up live site files and click feed locally...\n'
BACKUP_DIR="$(pwd)/local-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp "$TMP_DIR/app.js" "$BACKUP_DIR/app.js"
cp "$TMP_DIR/styles.css" "$BACKUP_DIR/styles.css"
curl --fail --silent --show-error --location --max-time 25 "$SITE_URL/" -o "$BACKUP_DIR/index.html" || { echo 'Could not back up the current HTML; cancelled.';exit 1;}
curl --fail --silent --show-error --location --max-time 25 "$SITE_URL/.netlify/functions/events?source=backup" -o "$BACKUP_DIR/events-before.csv" || { echo 'Could not back up current click feed; cancelled.';exit 1;}
BEFORE_LINES=$(wc -l < "$BACKUP_DIR/events-before.csv" | tr -d ' ')
echo "Backup saved to $BACKUP_DIR"

printf '\n3/5  Installing dependencies and running the checks...\n'
npm ci --no-audit --no-fund
npm test

printf '\n4/5  Connecting to YOUR existing Netlify site (no GitHub)...\n'
if ! npx --yes netlify-cli@27.13.0 link --id "$SITE_ID"; then
  echo 'Log in to Netlify in the browser that opens, then come back here.'
  npx --yes netlify-cli@27.13.0 login
  npx --yes netlify-cli@27.13.0 link --id "$SITE_ID"
fi
printf '\nTarget locked to: %s\n' "$SITE_URL"
printf 'This will deploy the complete frontend AND the eight serverless functions.\n'
printf 'All existing Netlify environment variables and stored click events stay on the same site.\n'
printf 'Type DEPLOY and press Return to publish, or anything else to cancel: '
read -r REPLY
if [ "$REPLY" != "DEPLOY" ]; then echo 'Cancelled. No changes to the live website.';exit 0;fi
npx --yes netlify-cli@27.13.0 deploy --prod --site "$SITE_ID" --dir public --functions netlify/functions --no-build --skip-functions-cache --message "X Tracker v4.7.9 - stacked click/spend KPIs and live count"

printf '\n5/5  Checking the production deployment without triggering UTM clicks...\n'
OK=0
for I in 1 2 3 4 5 6 7 8; do
  curl --fail --silent --show-error --max-time 35 "$SITE_URL/.netlify/functions/dashboard" > "$TMP_DIR/dashboard.json" || true
  if grep -q '"uiVersion":"4.7.9"' "$TMP_DIR/dashboard.json" && grep -q '"ok":true' "$TMP_DIR/dashboard.json"; then OK=1;break;fi
  sleep 8
done
if [ "$OK" -ne 1 ]; then
  echo 'The deployment command completed, but the live dashboard has not yet verified.'
  echo 'Inspect the latest Deploy in Netlify before making any other changes.'
  exit 1
fi
curl --fail --silent --show-error --max-time 25 "$SITE_URL/.netlify/functions/health" > "$TMP_DIR/health.json"
curl --fail --silent --show-error --max-time 25 "$SITE_URL/.netlify/functions/events?source=post-deploy-check" > "$BACKUP_DIR/events-after.csv"
AFTER_LINES=$(wc -l < "$BACKUP_DIR/events-after.csv" | tr -d ' ')
if [ "$AFTER_LINES" -lt "$BEFORE_LINES" ]; then
  echo 'WARNING: The click feed appears shorter; inspect Netlify immediately. Backup saved.'
  exit 1
fi
if ! grep -q '"ok":true' "$TMP_DIR/health.json";then
  echo 'WARNING: Health endpoint did not confirm OK; inspect Netlify.';exit 1
fi
if ! grep -Eq '"sourceStatus":"SHEET_(LIVE|FRESH)"' "$TMP_DIR/dashboard.json";then
  echo 'WARNING: The live Sheet source is not verified as current; inspect the health endpoint.';exit 1
fi
printf '\nSUCCESS. X Tracker v%s is on the SAME website:\n%s/\n' "$VERSION" "$SITE_URL"
echo 'Publisher data will continue to refresh directly from Google Sheets (no further uploads).'
echo 'No UTM redirect URL was visited during verification.'
echo "A local backup was saved at $BACKUP_DIR"
