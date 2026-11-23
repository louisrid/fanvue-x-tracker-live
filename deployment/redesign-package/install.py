#!/usr/bin/env python3
"""Idempotently install the unified XTRACKER UI onto the CURRENT existing source.

Run from current project root:
    python3 xtracker-redesign/install.py .

Fails closed unless current X Tracker index.html is present. Never deploy the
contents of this ZIP by themselves. All Netlify Functions and env vars are untouched.
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
import shutil
from pathlib import Path

ASSETS = ('xtracker-polish.css', 'xtracker-polish.js', 'xtracker-tables.js')
VERSION = '20261116-unified-tables-v1'
CSS_LINK = f'<link rel="stylesheet" href="/xtracker-polish.css?v={VERSION}">'
JS_LINKS = [f'<script src="/{name}?v={VERSION}" defer></script>' for name in ASSETS[1:]]


def resolve_index(root: Path) -> Path:
    candidates = (
        root / 'index.html',
        root / 'public' / 'index.html',
        root / 'site' / 'index.html',
        root / 'dist' / 'index.html',
        root / 'build' / 'index.html',
    )
    matches = []
    for path in candidates:
        if not path.is_file():
            continue
        data = path.read_text(encoding='utf-8')
        if all(marker in data for marker in ('id="page-placements"', 'id="page-of"', 'id="page-x-rts"', 'id="page-gta-vi"')):
            matches.append(path)
    if not matches:
        raise RuntimeError('Current production X Tracker index.html not found. NO FILES CHANGED.')
    if len(matches) > 1:
        raise RuntimeError('Multiple X Tracker HTML files found. Select actual Netlify publish root manually. NO FILES CHANGED.')
    return matches[0]


def install(root: Path, archive_root: Path) -> dict:
    root = root.resolve()
    index = resolve_index(root)
    asset_source = archive_root / 'source'
    missing = [f for f in ASSETS if not (asset_source / f).is_file()]
    if missing:
        raise RuntimeError('Missing patch assets: ' + ', '.join(missing) + '. NO FILES CHANGED.')
    original = index.read_text(encoding='utf-8')
    if '</head>' not in original or '</body>' not in original:
        raise RuntimeError('Unexpected index.html structure. NO FILES CHANGED.')
    assets_dir = index.parent
    asset_changes = any(not (assets_dir / name).exists() or (assets_dir / name).read_bytes() != (asset_source / name).read_bytes() for name in ASSETS)
    if all(original.count(tag) == 1 for tag in [CSS_LINK] + JS_LINKS) and not asset_changes:
        return {'status': 'already current', 'index': str(index), 'backup': None}
    # Previous overlay files may already exist. Update only our own three tags.
    updated = original
    for name in ASSETS:
        if name.endswith('.css'):
            pattern = rf'<link\b[^>]*href=["\'][^"\']*{re.escape(name)}(?:\?[^"\']*)?["\'][^>]*>\s*'
        else:
            pattern = rf'<script\b[^>]*src=["\'][^"\']*{re.escape(name)}(?:\?[^"\']*)?["\'][^>]*>\s*</script>\s*'
        updated = re.sub(pattern, '', updated, flags=re.I)
    updated = updated.replace('</head>', '  ' + CSS_LINK + '\n</head>', 1)
    updated = updated.replace('</body>', '\n  ' + '\n  '.join(JS_LINKS) + '\n</body>', 1)
    for tag in [CSS_LINK] + JS_LINKS:
        if updated.count(tag) != 1:
            raise RuntimeError('Install tag verification failed. NO FILES CHANGED.')
    if updated == original and not asset_changes:
        return {'status': 'already current', 'index': str(index), 'backup': None}
    # Save the existing live page and any existing overlay outside the deployed site root.
    timestamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%d_%H%M%S')
    backup = root.parent / f'_XTRACKER_BEFORE_REDESIGN_{timestamp}'
    suffix = 1
    while backup.exists():
        backup = root.parent / f'_XTRACKER_BEFORE_REDESIGN_{timestamp}_{suffix}'
        suffix += 1
    backup.mkdir(parents=True)
    shutil.copy2(index, backup / 'index.html')
    for asset in ASSETS:
        existing = assets_dir / asset
        if existing.exists():
            shutil.copy2(existing, backup / asset)
    # Stage files in the same directory; replace only after all checks above.
    for name in ASSETS:
        shutil.copy2(asset_source / name, assets_dir / name)
    index.write_text(updated, encoding='utf-8')
    assert all(updated.count(tag) == 1 for tag in [CSS_LINK] + JS_LINKS)
    return {'status': 'installed', 'index': str(index), 'backup': str(backup), 'assets': list(ASSETS)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('project_root', help='CURRENT source project root, not an empty directory')
    args = parser.parse_args()
    result = install(Path(args.project_root), Path(__file__).resolve().parent)
    print(result)
    print('All existing Netlify Functions, redirect rules, environment variables and tracking histories untouched.')
