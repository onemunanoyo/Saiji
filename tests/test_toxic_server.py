import importlib.util
import json
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path

spec = importlib.util.spec_from_file_location('toxic_server', Path(__file__).resolve().parents[1] / 'local-toxic/server.py')
server_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server_module)


class FakeClassifier:
    def judge(self, text):
        return {label: 0.1 for label in server_module.LABELS}


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), server_module.make_handler(FakeClassifier()))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, method, path, body=None, headers=None):
        connection = HTTPConnection('127.0.0.1', self.server.server_port, timeout=3)
        connection.request(method, path, body, headers or {})
        response = connection.getresponse()
        result = response.status, json.loads(response.read())
        connection.close()
        return result

    def test_health_and_ten_scores(self):
        self.assertTrue(self.request('GET', '/health')[1]['ready'])
        status, body = self.request('POST', '/judge', json.dumps({'text': 'こんにちは'}), {'Content-Type': 'application/json'})
        self.assertEqual(status, 200)
        self.assertEqual(set(body['scores']), set(server_module.LABELS))

    def test_invalid_payloads(self):
        for body in ['{}', '[]', 'bad json', json.dumps({'text': 'x' * 2001}), json.dumps({'text': 1})]:
            self.assertEqual(self.request('POST', '/judge', body, {'Content-Type': 'application/json'})[0], 400)
        self.assertEqual(self.request('POST', '/judge', '{}')[0], 415)

    def test_web_origins_and_dns_rebinding_blocked(self):
        self.assertEqual(self.request('GET', '/health', headers={'Origin': 'https://youtube.com'})[0], 403)
        self.assertEqual(self.request('GET', '/health', headers={'Host': 'evil.example'})[0], 403)
        self.assertEqual(self.request('GET', '/health', headers={'Origin': 'chrome-extension://' + 'a' * 32})[0], 200)


if __name__ == '__main__':
    unittest.main()
