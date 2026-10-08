"""Local-only, offline classifier for Saiji. No comment logging or model downloads."""
import argparse
import json
import re
import threading
import unicodedata
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

LABELS = (
    'toxicity', 'harassment', 'obscene', 'discrimination', 'threat',
    'spoiler', 'instruction', 'pigeon', 'self_promotion', 'spam',
)


class Classifier:
    def __init__(self, model_dir, device='cpu'):
        import torch
        from transformers import AutoModelForSequenceClassification, PreTrainedTokenizerFast
        self.torch = torch
        torch.set_num_threads(4)
        if device == 'auto':
            device = 'cuda' if torch.cuda.is_available() else ('mps' if torch.backends.mps.is_available() else 'cpu')
        if device == 'cuda' and not torch.cuda.is_available():
            raise RuntimeError('CUDA is unavailable; install CUDA PyTorch or select cpu')
        if device == 'mps' and not torch.backends.mps.is_available():
            raise RuntimeError('Apple Silicon MPS is unavailable; select cpu')
        self.device = device
        self.tokenizer = PreTrainedTokenizerFast(
            tokenizer_file=str(Path(model_dir) / 'tokenizer.json'),
            unk_token='[UNK]', pad_token='[PAD]', cls_token='[CLS]',
            sep_token='[SEP]', mask_token='[MASK]',
        )
        self.model = AutoModelForSequenceClassification.from_pretrained(
            model_dir, local_files_only=True, trust_remote_code=False,
        ).to(device).eval()
        if device == 'cuda':
            self.model.half()
        self.labels = [self.model.config.id2label[i] for i in range(self.model.config.num_labels)]
        if set(self.labels) != set(LABELS):
            raise ValueError('Model must have the ten Saiji toxicity labels')
        self.lock = threading.Lock()

    def judge(self, text):
        if not self.lock.acquire(timeout=0.5):
            raise TimeoutError('busy')
        try:
            inputs = self.tokenizer(
                unicodedata.normalize('NFKC', text), return_tensors='pt',
                truncation=True, max_length=128, return_token_type_ids=False,
            ).to(self.device)
            with self.torch.inference_mode():
                scores = self.torch.sigmoid(self.model(**inputs).logits)[0].cpu().tolist()
            return dict(zip(self.labels, scores))
        finally:
            self.lock.release()


def make_handler(classifier):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def setup(self):
            super().setup()
            self.connection.settimeout(5)

        def allowed(self):
            # Host validation blocks DNS rebinding; website requests are rejected.
            host = self.headers.get('Host', '')
            origin = self.headers.get('Origin')
            return host == f'127.0.0.1:{self.server.server_port}' and (
                origin is None or re.fullmatch(r'chrome-extension://[a-p]{32}', origin) is not None
            )

        def reply(self, status, body):
            payload = json.dumps(body, allow_nan=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            try:
                self.wfile.write(payload)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def do_GET(self):
            if not self.allowed():
                self.reply(403, {'error': 'forbidden'})
            elif self.path == '/health':
                self.reply(200, {'service': 'saiji-toxic', 'ready': True, 'labels': list(LABELS), 'device': getattr(classifier, 'device', 'unknown')})
            else:
                self.reply(404, {'error': 'not_found'})

        def do_POST(self):
            if not self.allowed():
                self.reply(403, {'error': 'forbidden'})
                return
            if self.path != '/judge':
                self.reply(404, {'error': 'not_found'})
                return
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if length <= 0 or length > 16000:
                    raise ValueError('size')
                payload = self.rfile.read(length)
                if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
                    self.reply(415, {'error': 'json_required'})
                    return
                body = json.loads(payload)
                text = body.get('text') if isinstance(body, dict) else None
                if not isinstance(text, str) or not text.strip() or len(text) > 2000:
                    raise ValueError('text')
            except (ValueError, UnicodeError):
                self.reply(400, {'error': 'invalid_request'})
                return
            try:
                self.reply(200, {'scores': classifier.judge(text)})
            except TimeoutError:
                self.reply(503, {'error': 'busy'})
            except Exception:
                self.reply(500, {'error': 'inference_failed'})
    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model-dir', type=Path, default=Path(__file__).resolve().parents[1] / 'models' / 'Saiji-Toxic-v2')
    parser.add_argument('--device', choices=('auto', 'cpu', 'cuda', 'mps'), default='auto')
    args = parser.parse_args()
    classifier = Classifier(args.model_dir, args.device)
    server = ThreadingHTTPServer(('127.0.0.1', 8765), make_handler(classifier))
    print(f'Saiji classifier ready: http://127.0.0.1:8765 ({classifier.device})', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
