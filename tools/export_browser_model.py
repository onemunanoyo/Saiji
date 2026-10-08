"""Export the exact HF classifier to a static 128-token ONNX graph."""
from pathlib import Path
import hashlib
import json
import shutil
import torch
from transformers import AutoModelForSequenceClassification
root = Path(__file__).resolve().parents[1]
source = root / 'models/Saiji-Toxic-v2'
output = root / 'models/browser'
output.mkdir(exist_ok=True)
model = AutoModelForSequenceClassification.from_pretrained(source, local_files_only=True).float().eval()
class Wrapper(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model
    def forward(self, input_ids, attention_mask):
        return self.model(input_ids=input_ids, attention_mask=attention_mask).logits
ids = torch.zeros((1, 128), dtype=torch.int64)
mask = torch.ones_like(ids)
with torch.inference_mode():
    torch.onnx.export(Wrapper(model), (ids, mask), str(output / 'model.onnx'), input_names=['input_ids','attention_mask'], output_names=['logits'], opset_version=17, dynamo=False)
for name in ['tokenizer.json','tokenizer_config.json','LICENSE']:
    shutil.copy2(source / name, output / name)
manifest = json.loads((source / 'download-manifest.json').read_text())
manifest.update(format='ONNX FP32', max_length=128, threshold=0.005039215087890625, files={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in output.iterdir() if p.is_file()})
(output / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print('Exported browser model: ' + str(output), flush=True)
