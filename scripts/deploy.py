#!/usr/bin/env python3
"""Deploy X Tracker's existing source to its original Netlify site with the CLI.

Requires an authenticated Netlify CLI session or NETLIFY_AUTH_TOKEN. This script
never creates projects, changes Netlify environment variables, or calls a live
tracking redirect. Default is a draft deploy unless --production is supplied.
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

SITE_ID = '3cfe75c9-5913-46a0-953f-eeae1a288a52'
SITE_URL = 'https://elegant-swan-98c20a.netlify.app'
ROOT = Path(__file__).resolve().parents[1]

parser = argparse.ArgumentParser()
parser.add_argument('--production', action='store_true')
parser.add_argument('--title', default='X Tracker verified source update')
parser.add_argument('--status-file')
args = parser.parse_args()

# Netlify CLI supports either a secure token in the environment or an OAuth
# login already stored in the execution environment. Never embed credentials.
if not os.environ.get('NETLIFY_AUTH_TOKEN') and not (Path.home() / '.netlify' / 'config.json').exists():
    sys.exit('Netlify authentication is required. Use a secure NETLIFY_AUTH_TOKEN or authenticate this execution environment with netlify login; do not paste the token into chat.')

# When a token is available, fail closed on the wrong account or target site.
if os.environ.get('NETLIFY_AUTH_TOKEN'):
    request = urllib.request.Request(
        'https://api.netlify.com/api/v1/sites/' + SITE_ID,
        headers={'Authorization': 'Bearer ' + os.environ['NETLIFY_AUTH_TOKEN']},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            site = json.load(response)
    except (urllib.error.HTTPError, urllib.error.URLError) as exc:
        sys.exit('Unable to verify existing Netlify site: ' + str(exc))
    if site.get('ssl_url', '').rstrip('/') != SITE_URL:
        sys.exit('Netlify site mismatch. Refusing to deploy.')

subprocess.run(['npm', 'test'], cwd=ROOT, check=True)
command = [
    'npx', '--yes', 'netlify-cli', 'deploy',
    '--site', SITE_ID,
    '--dir', 'public',
    '--functions', 'netlify/functions',
    '--message', args.title,
    '--json',
]
if args.production:
    command.append('--prod')

# The Netlify CLI packages serverless functions and static files together.
# Unlike the previous deploy.py, this does not post a source ZIP to the
# /sites/{id}/builds endpoint (which triggers a build, not a ZIP deploy).
result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
if result.returncode:
    error = (result.stderr or result.stdout).strip()
    sys.exit('Netlify CLI deployment failed: ' + error[-1500:])

try:
    output = json.loads(result.stdout)
except json.JSONDecodeError:
    sys.exit('Netlify CLI completed but returned an unreadable result; inspect Netlify deploy history before retrying.')

if args.status_file:
    Path(args.status_file).write_text(json.dumps(output, indent=2))
print(json.dumps({
    'site_id': SITE_ID,
    'production': args.production,
    'deploy_id': output.get('deploy_id') or output.get('deployId'),
    'url': output.get('url') or output.get('deploy_url'),
    'state': output.get('state'),
}), flush=True)
