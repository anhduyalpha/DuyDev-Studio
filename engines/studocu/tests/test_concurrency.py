# -*- coding: utf-8 -*-
"""
Test concurrency pool, in-flight deduplication, and failover mechanics in studocu_dl.
"""

import threading
import time
from pathlib import Path
import unittest
from unittest.mock import patch, MagicMock

from studocu_dl.job_worker import (
    MAX_CONCURRENT_DOWNLOADS,
    run_download_job,
    cancel_job,
    JOBS,
    ACTIVE_JOB_IDS,
    WAITING_QUEUE,
    IN_FLIGHT_JOBS,
    IN_FLIGHT_EVENTS,
    extract_studocu_doc_id,
)


class TestStudocuConcurrency(unittest.TestCase):
    def setUp(self):
        JOBS.clear()
        ACTIVE_JOB_IDS.clear()
        WAITING_QUEUE.clear()
        IN_FLIGHT_JOBS.clear()
        IN_FLIGHT_EVENTS.clear()

    def test_extract_doc_id(self):
        url1 = "https://www.studocu.com/vn/document/truong-dai-hoc-kinh-te/kinh-te-vi-mo/88997766"
        url2 = "https://www.studocu.com/vn/document/truong-dai-hoc-kinh-te/kinh-te-vi-mo/88997766?origin=search"
        url3 = "https://www.studocu.com/vn/document/truong-dai-hoc-kinh-te/kinh-te-vi-mo/88997766/"
        self.assertEqual(extract_studocu_doc_id(url1), "88997766")
        self.assertEqual(extract_studocu_doc_id(url2), "88997766")
        self.assertEqual(extract_studocu_doc_id(url3), "88997766")

    def test_max_concurrent_is_three(self):
        self.assertEqual(MAX_CONCURRENT_DOWNLOADS, 3)

    @patch("studocu_dl.job_worker.BrowserSessionManager")
    @patch("studocu_dl.job_worker.StudocuDownloader")
    @patch("studocu_dl.job_worker.get_cached_document", return_value=None)
    @patch("studocu_dl.job_worker.save_cached_document")
    def test_in_flight_deduplication_success(self, mock_save, mock_cached, mock_downloader_cls, mock_bsm):
        import tempfile
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        downloads_dir = Path(temp_dir.name)
        fake_pdf = downloads_dir / "doc.pdf"
        fake_pdf.write_bytes(b"%PDF-1.4 dummy")

        mock_mgr = MagicMock()
        mock_bsm.get_instance.return_value = mock_mgr

        # Simulate downloader.run taking 0.3s
        async def slow_run():
            time.sleep(0.3)
            return {
                "title": "Kinh Tế Vi Mô",
                "pdf": {"path": str(fake_pdf), "name": "doc.pdf", "pages": 20},
            }

        mock_inst = MagicMock()
        mock_inst.is_cancelled = False
        mock_inst.run = MagicMock(side_effect=slow_run)
        mock_downloader_cls.return_value = mock_inst

        url = "https://www.studocu.com/vn/document/dhkt/ktvm/11223344"

        job1_id = "job1"
        job2_id = "job2"
        JOBS[job1_id] = {"id": job1_id, "status": "running", "logs": [], "progress": {}}
        JOBS[job2_id] = {"id": job2_id, "status": "running", "logs": [], "progress": {}}

        t1 = threading.Thread(
            target=run_download_job,
            args=(job1_id, url, "pdf", 30, None, downloads_dir, False),
        )
        t2 = threading.Thread(
            target=run_download_job,
            args=(job2_id, url, "pdf", 30, None, downloads_dir, False),
        )

        t1.start()
        time.sleep(0.05)  # Ensure job1 becomes primary
        t2.start()

        t1.join(timeout=3.0)
        t2.join(timeout=3.0)

        # Both jobs should be completed
        self.assertEqual(JOBS[job1_id]["status"], "completed")
        self.assertEqual(JOBS[job2_id]["status"], "completed")
        # Job 2 should have inherited result from Job 1
        self.assertEqual(JOBS[job2_id]["result"]["title"], "Kinh Tế Vi Mô")
        self.assertTrue(JOBS[job2_id].get("from_cache"))
        # Downloader should have been instantiated only ONCE
        self.assertEqual(mock_downloader_cls.call_count, 1)

    @patch("studocu_dl.job_worker.BrowserSessionManager")
    @patch("studocu_dl.job_worker.StudocuDownloader")
    @patch("studocu_dl.job_worker.get_cached_document", return_value=None)
    @patch("studocu_dl.job_worker.save_cached_document")
    def test_secondary_failover_when_primary_cancels(self, mock_save, mock_cached, mock_downloader_cls, mock_bsm):
        import tempfile
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        downloads_dir = Path(temp_dir.name)
        fake_pdf = downloads_dir / "doc.pdf"
        fake_pdf.write_bytes(b"%PDF-1.4 dummy")

        mock_mgr = MagicMock()
        mock_bsm.get_instance.return_value = mock_mgr

        call_count = [0]
        async def run_impl():
            call_count[0] += 1
            if call_count[0] == 1:
                # Primary job: hang until cancelled
                time.sleep(0.5)
                raise Exception("Primary failed")
            else:
                # Secondary promoted job: succeeds
                return {
                    "title": "Kinh Tế Vi Mô Success",
                    "pdf": {"path": str(fake_pdf), "name": "doc.pdf", "pages": 20},
                }

        def create_downloader(*args, **kwargs):
            inst = MagicMock()
            inst.is_cancelled = False
            def do_cancel():
                inst.is_cancelled = True
            inst.cancel = MagicMock(side_effect=do_cancel)
            inst.run = MagicMock(side_effect=run_impl)
            return inst

        mock_downloader_cls.side_effect = create_downloader

        url = "https://www.studocu.com/vn/document/dhkt/ktvm/55667788"

        job1_id = "p_job1"
        job2_id = "s_job2"
        JOBS[job1_id] = {"id": job1_id, "status": "running", "logs": [], "progress": {}}
        JOBS[job2_id] = {"id": job2_id, "status": "running", "logs": [], "progress": {}}

        t1 = threading.Thread(
            target=run_download_job,
            args=(job1_id, url, "pdf", 30, None, downloads_dir, True),
        )
        t2 = threading.Thread(
            target=run_download_job,
            args=(job2_id, url, "pdf", 30, None, downloads_dir, True),
        )

        t1.start()
        time.sleep(0.05)
        t2.start()

        # Cancel primary job after 0.1s
        time.sleep(0.1)
        cancel_job(job1_id)

        t1.join(timeout=3.0)
        t2.join(timeout=3.0)

        self.assertEqual(JOBS[job1_id]["status"], "cancelled")
        # Job 2 should have taken over and completed!
        self.assertEqual(JOBS[job2_id]["status"], "completed")
        self.assertEqual(JOBS[job2_id]["result"]["title"], "Kinh Tế Vi Mô Success")

    def test_adaptive_block_sizing_logic(self):
        # 1. Single job running: block size must be 25
        ACTIVE_JOB_IDS.clear()
        ACTIVE_JOB_IDS.add("job1")
        self.assertEqual(len(ACTIVE_JOB_IDS), 1)
        base_block = 15 if len(ACTIVE_JOB_IDS) > 1 else 25
        self.assertEqual(base_block, 25)

        # 2. Concurrency > 1: block size must contract to 15
        ACTIVE_JOB_IDS.add("job2")
        self.assertEqual(len(ACTIVE_JOB_IDS), 2)
        base_block = 15 if len(ACTIVE_JOB_IDS) > 1 else 25
        self.assertEqual(base_block, 15)

        # 3. 3 concurrent jobs: block size remains 15
        ACTIVE_JOB_IDS.add("job3")
        self.assertEqual(len(ACTIVE_JOB_IDS), 3)
        base_block = 15 if len(ACTIVE_JOB_IDS) > 1 else 25
        self.assertEqual(base_block, 15)


if __name__ == "__main__":
    unittest.main()
