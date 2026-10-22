#!/usr/bin/env python3
"""Build the self-contained offline app using only Python's standard library."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'data/INPUTS.json').read_text(encoding='utf-8'))
for entry in manifest['files']:
    raw = (ROOT / entry['path']).read_bytes()
    if len(raw) != entry['bytes'] or hashlib.sha256(raw).hexdigest() != entry['sha256']:
        raise ValueError('Frozen input changed: ' + entry['path'])
data = json.loads((ROOT / 'data/frozen-results.json').read_text(encoding='utf-8'))
page = (ROOT / 'src/index.template.html').read_text(encoding='utf-8')
replacements = {
    '/*__STYLES__*/': (ROOT / 'src/styles.css').read_text(encoding='utf-8'),
    '/*__DATA__*/': json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c'),
    '/*__ENGINE__*/': (ROOT / 'src/engine.js').read_text(encoding='utf-8'),
    '/*__APP__*/': (ROOT / 'src/app.js').read_text(encoding='utf-8'),
}
for token, content in replacements.items():
    if page.count(token) != 1:
        raise ValueError('Expected one build token: ' + token)
    page = page.replace(token, content)
if '/*__' in page:
    raise ValueError('Unreplaced build token')
raw = page.encode('utf-8')
(ROOT / 'index.html').write_bytes(raw)
print(json.dumps({'output': 'index.html', 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'frozen_inputs_verified': len(manifest['files'])}, indent=2))
