"""Create uploadable plugin ZIPs, including hidden manifests, without local dependencies."""
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
out = root / 'dist'
out.mkdir(exist_ok=True)
catalog = json.loads((root / '.claude-plugin/marketplace.json').read_text(encoding='utf-8'))
for plugin in catalog['plugins']:
    source = root / plugin['source']
    target = out / f"{plugin['name']}-{plugin['version']}.zip"
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
        for file in sorted(source.rglob('*')):
            relative = file.relative_to(source)
            if file.is_file() and not any(part in {'node_modules', '.git', '__pycache__'} for part in relative.parts):
                archive.write(file, relative.as_posix())
        archive.write(root / 'LICENSE', 'LICENSE')
    with zipfile.ZipFile(target) as archive:
        assert '.claude-plugin/plugin.json' in archive.namelist()
        assert archive.testzip() is None
        manifest = json.loads(archive.read('.claude-plugin/plugin.json'))
        assert manifest['name'] == plugin['name'] and manifest['version'] == plugin['version']
    print(f'{target.name}: {target.stat().st_size} bytes, verified')
