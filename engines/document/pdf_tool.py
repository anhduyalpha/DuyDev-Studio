#!/usr/bin/env python3
"""
DD Studio - PDF Tool CLI Runner
Wrapper for pdf_engine
"""

import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdf_engine import main

if __name__ == "__main__":
    main()
