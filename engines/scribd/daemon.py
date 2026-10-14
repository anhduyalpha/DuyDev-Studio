# -*- coding: utf-8 -*-
import sys
from pathlib import Path

# Thêm thư mục hiện tại vào sys.path để import scribd_dl
sys.path.insert(0, str(Path(__file__).resolve().parent))

from scribd_dl.server import main

if __name__ == "__main__":
    main()
