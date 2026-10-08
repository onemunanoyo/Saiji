"""Download the published classifier, pinning the resolved Hub revision."""
import hashlib
import json
from pathlib import Path
from huggingface_hub import HfApi, snapshot_download
repo = 'j-llm/Saiji-toxic_v2'
root = Path(__file__).resolve().parents[1] / 'models' / 'Saiji-Toxic-v2'
info = HfApi().model_info(repo)
snapshot_download(repo, revision=info.sha, local_dir=root, allow_patterns=['config.json', 'model.safetensors', 'tokenizer.json', 'tokenizer_config.json', 'README.md', 'LICENSE', 'NOTICE'])
files = ['config.json', 'model.safetensors', 'tokenizer.json', 'tokenizer_config.json']
manifest = {'repo': repo, 'revision': info.sha, 'sha256': {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in files}}
(root / 'download-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print('Downloaded ' + repo + '@' + info.sha)
