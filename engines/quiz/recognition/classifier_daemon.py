"""
Lightweight In-Memory Classifier Daemon with Inactivity Auto-Unload (TTL 45s)
Runs Xenova/multilingual-e5-small ONNX on 127.0.0.1:3005 with zero external dependencies.
Releases 100% of RAM (~550MB) after 45s of inactivity or upon receiving /shutdown.
"""

from __future__ import annotations

import os
import sys
import time
import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import socketserver

# Ensure UTF-8 stdout on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, "../../../"))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from engines.quiz.recognition.semantic_classifier import SemanticClassifier

DEFAULT_PORT = int(os.environ.get("QUIZ_CLASSIFIER_PORT", "3005"))
DEFAULT_TTL = int(os.environ.get("QUIZ_CLASSIFIER_TTL_SEC", "45"))

START_TIME = time.time()
LAST_ACTIVITY = time.time()
ACTIVITY_LOCK = threading.Lock()
SHUTDOWN_EVENT = threading.Event()

# Pre-load classifier
classifier: SemanticClassifier | None = None


def touch_activity():
    global LAST_ACTIVITY
    with ACTIVITY_LOCK:
        LAST_ACTIVITY = time.time()


def get_idle_time() -> float:
    with ACTIVITY_LOCK:
        return time.time() - LAST_ACTIVITY


class ClassifierHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Keep logs clean; suppress default HTTP request logs unless needed
        pass

    def _send_json(self, status: int, data: dict):
        response_bytes = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)

    def do_GET(self):
        touch_activity()
        if self.path == "/health":
            self._send_json(200, {
                "status": "ok",
                "uptime_sec": round(time.time() - START_TIME, 1),
                "idle_sec": round(get_idle_time(), 1),
                "ttl_sec": DEFAULT_TTL
            })
        else:
            self._send_json(404, {"error": "Not found"})

    def do_POST(self):
        touch_activity()
        if self.path == "/classify":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body_bytes = self.rfile.read(content_length)
                payload = json.loads(body_bytes.decode("utf-8"))
                text = (payload.get("text") or payload.get("prompt") or "").strip()

                if not text:
                    self._send_json(400, {"error": "Missing 'text' or 'prompt' parameter"})
                    return

                t0 = time.perf_counter()
                result = classifier.classify(text)
                dt_ms = (time.perf_counter() - t0) * 1000
                result["latency_ms"] = round(dt_ms, 2)

                self._send_json(200, {"success": True, "data": result})
            except Exception as e:
                self._send_json(500, {"success": False, "error": str(e)})

        elif self.path == "/shutdown":
            self._send_json(200, {"status": "shutting_down", "message": "Releasing RAM and exiting daemon."})
            threading.Thread(target=lambda: (time.sleep(0.1), SHUTDOWN_EVENT.set())).start()
        else:
            self._send_json(404, {"error": "Not found"})


class ThreadedHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def watchdog_thread(server: HTTPServer, ttl_sec: int):
    while not SHUTDOWN_EVENT.is_set():
        time.sleep(1.0)
        idle = get_idle_time()
        if idle >= ttl_sec:
            print(f"[Classifier Daemon] Inactive for {idle:.1f}s >= {ttl_sec}s TTL. Auto-terminating to release RAM.")
            SHUTDOWN_EVENT.set()
            break

    # Trigger server shutdown
    try:
        server.shutdown()
    except Exception:
        pass


def run_daemon(port: int = DEFAULT_PORT, ttl_sec: int = DEFAULT_TTL):
    global classifier
    print(f"[Classifier Daemon] Initializing multilingual-e5-small ONNX model...")
    t0 = time.perf_counter()
    classifier = SemanticClassifier.get_instance()
    t_load = (time.perf_counter() - t0) * 1000
    print(f"[Classifier Daemon] Model loaded in {t_load:.1f}ms. Binding to 127.0.0.1:{port} (TTL: {ttl_sec}s)...")

    server = ThreadedHTTPServer(("127.0.0.1", port), ClassifierHandler)
    touch_activity()

    w_thread = threading.Thread(target=watchdog_thread, args=(server, ttl_sec), daemon=True)
    w_thread.start()

    print(f"[Classifier Daemon] Serving on http://127.0.0.1:{port}/ (Ready for requests)")
    try:
        server.serve_forever()
    finally:
        server.server_close()
        print(f"[Classifier Daemon] Process closed cleanly. Memory released.")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Quiz Classifier Daemon")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port to listen on (default 3005)")
    parser.add_argument("--ttl", type=int, default=DEFAULT_TTL, help="Inactivity TTL in seconds (default 45)")
    args = parser.parse_args()

    run_daemon(port=args.port, ttl_sec=args.ttl)
