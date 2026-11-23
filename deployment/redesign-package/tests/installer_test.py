import importlib.util
import tempfile
from pathlib import Path

HERE=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('install',HERE/'install.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

with tempfile.TemporaryDirectory() as d:
    d=Path(d);project=d/'existing-site';project.mkdir()
    html='''<!DOCTYPE html><html><head><link href="styles.css" rel="stylesheet"></head><body><header class="logo">XTRACKER</header><section id="page-placements"></section><section id="page-of"></section><section id="page-x-rts"></section><section id="page-gta-vi"></section><script src="app.js" defer></script></body></html>'''
    (project/'index.html').write_text(html)
    (project/'netlify.toml').write_text('[[redirects]]\n  from="/r/*"\n')
    functions=project/'netlify/functions';functions.mkdir(parents=True)
    (functions/'redirect.js').write_text('const keep="1";')
    result=mod.install(project,HERE)
    out=(project/'index.html').read_text()
    assert result['status']=='installed'
    assert out.count('xtracker-polish.css')==1 and out.count('xtracker-polish.js')==1 and out.count('xtracker-tables.js')==1
    assert out.index('xtracker-polish.js') < out.index('xtracker-tables.js')
    assert 'class="logo"' in out and 'src="app.js"' in out
    assert (functions/'redirect.js').read_text()=='const keep="1";'
    assert (project/'netlify.toml').read_text().startswith('[[redirects]]')
    assert (Path(result['backup'])/'index.html').read_text()==html
    again=mod.install(project,HERE)
    assert again['status']=='already current'
    print('PASS installer: validates latest X Tracker, preserves code, backs up, is idempotent')
    empty=d/'empty';empty.mkdir()
    try:mod.install(empty,HERE)
    except RuntimeError:print('PASS installer refuses to modify a wrong or empty website')
    else:raise AssertionError('should refuse empty projects')
