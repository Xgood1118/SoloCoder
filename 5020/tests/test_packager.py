"""Tests for the packaging module."""

import os
import zipfile
import tarfile
from pathlib import Path

import pytest

from buildforge.packager import (
    Packager,
    ZipPackager,
    TarGzPackager,
    JarPackager,
    PackageResult,
)


class TestPackageResult:
    """Test PackageResult dataclass."""

    def test_package_result_creation(self):
        """Test creating a PackageResult."""
        result = PackageResult(
            name="test",
            success=True,
            output_path="/tmp/test.zip",
            size=1024,
            checksums={"md5": "abc", "sha256": "def"},
        )
        assert result.name == "test"
        assert result.success is True
        assert result.size == 1024
        assert result.checksums["md5"] == "abc"


class TestZipPackager:
    """Test ZipPackager class."""

    def test_package_zip(self, sample_files, temp_workdir):
        """Test creating a ZIP archive."""
        packager = ZipPackager(str(temp_workdir))
        artifact = {
            "name": "test-app",
            "type": "zip",
            "source": ["src"],
            "output": "test-app.zip",
        }

        output_dir = temp_workdir / "dist"
        result = packager.package(artifact, str(output_dir))

        assert result.success is True
        assert result.name == "test-app"
        assert "test-app.zip" in result.output_path
        assert result.size > 0

        output_file = Path(result.output_path)
        assert output_file.exists()

        with zipfile.ZipFile(output_file, "r") as zf:
            names = zf.namelist()
            assert "main.py" in names
            assert "utils.py" in names
            assert "config.json" in names
            assert "sub/helper.py" in names

    def test_package_zip_with_includes_excludes(self, sample_files, temp_workdir):
        """Test ZIP packaging with include/exclude filters."""
        packager = ZipPackager(str(temp_workdir))
        artifact = {
            "name": "filtered-app",
            "type": "zip",
            "source": ["src"],
            "output": "filtered.zip",
            "includes": ["**/*.py"],
            "excludes": ["sub/**"],
        }

        output_dir = temp_workdir / "dist"
        result = packager.package(artifact, str(output_dir))

        assert result.success is True

        output_file = Path(result.output_path)
        with zipfile.ZipFile(output_file, "r") as zf:
            names = zf.namelist()
            assert "main.py" in names
            assert "utils.py" in names
            assert "config.json" not in names
            assert "sub/helper.py" not in names

    def test_package_zip_missing_source(self, temp_workdir):
        """Test ZIP packaging with missing source fails gracefully."""
        packager = ZipPackager(str(temp_workdir))
        artifact = {
            "name": "missing",
            "type": "zip",
            "source": ["nonexistent"],
        }

        output_dir = temp_workdir / "dist"
        result = packager.package(artifact, str(output_dir))

        assert result.success is False
        assert "not found" in result.error.lower()


class TestTarGzPackager:
    """Test TarGzPackager class."""

    def test_package_tar_gz(self, sample_files, temp_workdir):
        """Test creating a TAR.GZ archive."""
        packager = TarGzPackager(str(temp_workdir))
        artifact = {
            "name": "test-app",
            "type": "tar.gz",
            "source": ["src"],
            "output": "test-app.tar.gz",
        }

        output_dir = temp_workdir / "dist"
        result = packager.package(artifact, str(output_dir))

        assert result.success is True
        assert result.name == "test-app"
        assert result.size > 0

        output_file = Path(result.output_path)
        assert output_file.exists()

        with tarfile.open(output_file, "r:gz") as tf:
            names = tf.getnames()
            assert "main.py" in names
            assert "utils.py" in names


class TestJarPackager:
    """Test JarPackager class."""

    def test_package_jar(self, sample_files, temp_workdir):
        """Test creating a JAR file."""
        packager = JarPackager(str(temp_workdir))
        artifact = {
            "name": "test-app",
            "type": "jar",
            "source": ["src"],
            "output": "test-app.jar",
        }

        output_dir = temp_workdir / "dist"
        result = packager.package(artifact, str(output_dir))

        assert result.success is True
        assert result.size > 0

        output_file = Path(result.output_path)
        assert output_file.exists()

        with zipfile.ZipFile(output_file, "r") as zf:
            names = zf.namelist()
            assert "META-INF/MANIFEST.MF" in names
            assert "main.py" in names

            manifest = zf.read("META-INF/MANIFEST.MF").decode("utf-8")
            assert "Manifest-Version: 1.0" in manifest
            assert "Created-By: BuildForge" in manifest


class TestPackager:
    """Test main Packager coordinator class."""

    def test_package_all(self, sample_files, temp_workdir):
        """Test packaging multiple artifacts."""
        packager = Packager(str(temp_workdir))
        artifacts = [
            {
                "name": "app-zip",
                "type": "zip",
                "source": ["src"],
                "output": "app.zip",
            },
            {
                "name": "app-tar",
                "type": "tar.gz",
                "source": ["src"],
                "output": "app.tar.gz",
            },
        ]

        output_dir = temp_workdir / "dist"
        results = packager.package_all(artifacts, str(output_dir))

        assert len(results) == 2
        assert all(r.success for r in results)
        assert results[0].name == "app-zip"
        assert results[1].name == "app-tar"

    def test_unsupported_artifact_type(self, temp_workdir):
        """Test unsupported artifact type returns error."""
        packager = Packager(str(temp_workdir))
        artifact = {
            "name": "test",
            "type": "unknown",
            "source": ["."],
        }

        output_dir = temp_workdir / "dist"
        result = packager.package(artifact, str(output_dir))

        assert result.success is False
        assert "Unsupported artifact type" in result.error

    def test_package_checksums(self, sample_files, temp_workdir):
        """Test that packages have correct checksums."""
        packager = ZipPackager(str(temp_workdir))
        artifact = {
            "name": "checksum-test",
            "type": "zip",
            "source": ["src"],
            "output": "checksum-test.zip",
        }

        output_dir = temp_workdir / "dist"
        result = packager.package(artifact, str(output_dir))

        assert result.success is True
        assert "md5" in result.checksums
        assert "sha256" in result.checksums
        assert len(result.checksums["md5"]) == 32
        assert len(result.checksums["sha256"]) == 64
