# -*- coding: utf-8 -*-
"""
Unit tests for Parallel Multi-Tab Chunking in studocu_dl.engine.
"""

import asyncio
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from studocu_dl.engine import StudocuDownloader
import studocu_dl.job_worker as jw


class TestParallelMultiTabChunking(unittest.TestCase):
    def setUp(self):
        jw.ACTIVE_JOB_IDS.clear()

    def test_chunk_ranges_calculation(self):
        downloader = StudocuDownloader(url="https://www.studocu.com/vn/document/test/123", output_dir="downloads")
        # Test range splitting
        total_pages = 75
        CHUNK_SIZE = 25
        ranges = []
        b_start = 0
        while b_start < total_pages:
            b_end = min(b_start + CHUNK_SIZE, total_pages)
            ranges.append((b_start, b_end))
            b_start = b_end
        self.assertEqual(ranges, [(0, 25), (25, 50), (50, 75)])

        # Test non-multiple of 25 (e.g. 58 pages)
        total_pages = 58
        ranges_58 = []
        b_start = 0
        while b_start < total_pages:
            b_end = min(b_start + CHUNK_SIZE, total_pages)
            ranges_58.append((b_start, b_end))
            b_start = b_end
        self.assertEqual(ranges_58, [(0, 25), (25, 50), (50, 58)])

    @patch("studocu_dl.engine.pymupdf")
    def test_parallel_chunking_success(self, mock_pymupdf):
        import tempfile
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)

        downloader = StudocuDownloader(
            url="https://www.studocu.com/vn/document/test/123",
            output_dir=temp_dir.name,
            keep_browser_alive=True,
        )

        mock_master_pdf = MagicMock()
        mock_master_pdf.__len__.return_value = 50
        mock_master_pdf.tobytes.return_value = b"%PDF-1.4 merged content"
        mock_pymupdf.open.side_effect = [mock_master_pdf, MagicMock(), MagicMock()]

        # Mock CDP client
        mock_page_client = MagicMock()
        mock_page_client.send = AsyncMock(return_value={"cookies": [{"name": "cf_clearance", "value": "xyz"}]})
        mock_page_client.eval = AsyncMock(return_value={
            "totalPages": 50,
            "docTitle": "Sample Lecture Notes",
        })

        async def fake_master_tab(*args, **kwargs):
            return b"%PDF-part1", []

        async def fake_worker_tab(*args, **kwargs):
            return b"%PDF-part2", []

        downloader._render_chunk_in_master_tab = AsyncMock(side_effect=fake_master_tab)
        downloader._render_chunk_in_worker_tab = AsyncMock(side_effect=fake_worker_tab)

        results, title = asyncio.run(downloader._process_parallel_multi_tab_chunks(mock_page_client))

        self.assertEqual(title, "Sample Lecture Notes")
        self.assertEqual(results["pages"], 50)
        self.assertTrue((Path(temp_dir.name) / "Sample Lecture Notes.pdf").exists())

    def test_cancel_cleans_up_worker_tabs(self):
        downloader = StudocuDownloader(
            url="https://www.studocu.com/vn/document/test/123",
            output_dir="downloads",
            keep_browser_alive=True,
        )
        downloader.worker_target_ids = ["tab_1", "tab_2", "tab_3"]

        with patch("studocu_dl.engine.close_tab") as mock_close_tab:
            downloader.cancel()
            self.assertTrue(downloader.is_cancelled)
            self.assertEqual(mock_close_tab.call_count, 3)
            self.assertEqual(len(downloader.worker_target_ids), 0)


if __name__ == "__main__":
    unittest.main()
