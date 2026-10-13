"""
Unit Tests for Quiz Classifier Daemon (e5-small ONNX + HTTP API)
"""

import unittest
import urllib.request
import json
import time
import subprocess
import sys
import os

TEST_PORT = 3008

class TestClassifierDaemon(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Start daemon on test port with 5s TTL
        daemon_script = os.path.abspath(os.path.join(os.path.dirname(__file__), "../recognition/classifier_daemon.py"))
        cls.proc = subprocess.Popen(
            [sys.executable, daemon_script, "--port", str(TEST_PORT), "--ttl", "10"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"}
        )

        # Wait up to 10s for /health
        ready = False
        for _ in range(20):
            time.sleep(0.5)
            try:
                req = urllib.request.urlopen(f"http://127.0.0.1:{TEST_PORT}/health", timeout=1)
                if req.status == 200:
                    ready = True
                    break
            except Exception:
                pass

        if not ready:
            cls.proc.kill()
            raise RuntimeError("Classifier daemon failed to become ready in 10s")

    @classmethod
    def tearDownClass(cls):
        try:
            req = urllib.request.Request(f"http://127.0.0.1:{TEST_PORT}/shutdown", method="POST")
            urllib.request.urlopen(req, timeout=2)
        except Exception:
            pass
        if cls.proc.poll() is None:
            cls.proc.terminate()
            cls.proc.wait(timeout=3)

    def test_health_check(self):
        req = urllib.request.urlopen(f"http://127.0.0.1:{TEST_PORT}/health", timeout=2)
        self.assertEqual(req.status, 200)
        data = json.loads(req.read().decode())
        self.assertEqual(data.get("status"), "ok")

    def test_classify_section_part_ii(self):
        payload = json.dumps({"text": "lấy phần trắc nghiệm đúng sai trang 14"}).encode("utf-8")
        req = urllib.request.Request(
            f"http://127.0.0.1:{TEST_PORT}/classify",
            data=payload,
            headers={"Content-Type": "application/json"}
        )
        resp = urllib.request.urlopen(req, timeout=3)
        self.assertEqual(resp.status, 200)
        body = json.loads(resp.read().decode())
        self.assertTrue(body.get("success"))
        res = body["data"]
        self.assertEqual(res["section_filter"], "part_ii")
        self.assertEqual(res["pages"], "14")
        self.assertIn("latency_ms", res)
        self.assertLess(res["latency_ms"], 200)

    def test_classify_relative_slang(self):
        payload = json.dumps({"text": "5 câu cuối trang 40"}).encode("utf-8")
        req = urllib.request.Request(
            f"http://127.0.0.1:{TEST_PORT}/classify",
            data=payload,
            headers={"Content-Type": "application/json"}
        )
        resp = urllib.request.urlopen(req, timeout=3)
        self.assertEqual(resp.status, 200)
        body = json.loads(resp.read().decode())
        res = body["data"]
        self.assertEqual(res["relative"], "last_5")
        self.assertEqual(res["pages"], "40")


if __name__ == "__main__":
    unittest.main()
