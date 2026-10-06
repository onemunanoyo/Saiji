"""Opt-in CPU smoke with user-supplied private weights; never run in CI."""
import importlib.util
import json
import threading
import time
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('toxic_server', root / 'local-toxic/server.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
classifier = module.Classifier(root / 'Toxic.v2')
server = ThreadingHTTPServer(('127.0.0.1', 0), module.make_handler(classifier))
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
results = []
try:
    for text in ['配信ありがとう！楽しかった', 'お前は本当に最低だ。死ね', '右に行ってその武器を使ってください']:
        start = time.perf_counter()
        connection = HTTPConnection('127.0.0.1', server.server_port, timeout=10)
        connection.request('POST', '/judge', json.dumps({'text': text}), {'Content-Type': 'application/json'})
        response = connection.getresponse()
        body = json.loads(response.read())
        connection.close()
        assert response.status == 200, body
        assert set(body['scores']) == set(module.LABELS)
        assert all(0 <= value <= 1 for value in body['scores'].values())
        results.append({'text': text, 'seconds': round(time.perf_counter() - start, 3), **body})
finally:
    server.shutdown()
    server.server_close()
    thread.join()
(root / 'logs').mkdir(exist_ok=True)
(root / 'logs/toxic-smoke.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(results, ensure_ascii=True, indent=2))
