#!/usr/bin/env python3
"""
RAG System - Main Entry Point

This is the main entry point for the RAG system command-line interface.
It provides access to all document processing and retrieval functionality.

Usage:
    python main.py --help
    python main.py pipeline data/input
    python main.py search "your query here"
    python main.py list
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from rag_system.cli import main


if __name__ == "__main__":
    sys.exit(main())
