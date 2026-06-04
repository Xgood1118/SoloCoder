"""Test configuration and fixtures."""

import os
import tempfile
import shutil
from pathlib import Path

import pytest


@pytest.fixture
def temp_workdir():
    """Create a temporary working directory for tests."""
    workdir = tempfile.mkdtemp(prefix="buildforge_test_")
    original_cwd = os.getcwd()
    os.chdir(workdir)
    yield Path(workdir)
    os.chdir(original_cwd)
    shutil.rmtree(workdir, ignore_errors=True)


@pytest.fixture
def sample_pipeline_data():
    """Provide a sample pipeline data structure for testing."""
    return {
        "version": "1.0",
        "name": "Test Pipeline",
        "defaults": {
            "build_dir": "build",
            "output_dir": "dist",
            "timeout": 300,
        },
        "environments": {
            "dev": {
                "log_level": "debug",
                "optimize": False,
            },
            "prod": {
                "log_level": "warn",
                "optimize": True,
                "timeout": 600,
            },
        },
        "stages": [
            {
                "name": "build",
                "mode": "serial",
                "steps": [
                    {
                        "name": "compile",
                        "command": ["echo", "compiling"],
                    },
                    {
                        "name": "package",
                        "command": ["echo", "packaging"],
                        "depends_on": ["compile"],
                    },
                ],
            },
        ],
        "artifacts": [
            {
                "name": "test-app",
                "type": "zip",
                "source": ["src"],
            },
        ],
    }


@pytest.fixture
def sample_files(temp_workdir):
    """Create sample source files for testing."""
    src_dir = temp_workdir / "src"
    src_dir.mkdir()

    (src_dir / "main.py").write_text('print("Hello")\n')
    (src_dir / "utils.py").write_text('def util(): pass\n')
    (src_dir / "config.json").write_text('{"version": "1.0"}\n')

    sub_dir = src_dir / "sub"
    sub_dir.mkdir()
    (sub_dir / "helper.py").write_text('def helper(): pass\n')

    return temp_workdir
