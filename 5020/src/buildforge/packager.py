"""Artifact packaging module supporting multiple formats."""

from __future__ import annotations

import fnmatch
import io
import os
import shutil
import tarfile
import tempfile
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import docker
    DOCKER_AVAILABLE = True
except ImportError:
    DOCKER_AVAILABLE = False


@dataclass
class PackageResult:
    """Result of a packaging operation."""

    name: str
    success: bool
    output_path: str = ""
    error: str = ""
    size: int = 0
    checksums: Dict[str, str] = field(default_factory=dict)


class BasePackager:
    """Base class for all packagers."""

    def __init__(self, workdir: str) -> None:
        self._workdir = Path(workdir)

    def _resolve_paths(
        self,
        sources: List[str],
        includes: Optional[List[str]] = None,
        excludes: Optional[List[str]] = None,
    ) -> List[tuple[Path, Path]]:
        """Resolve and filter source paths.
        
        Returns list of (full_path, arcname) tuples.
        """
        resolved: List[tuple[Path, Path]] = []
        includes = includes or ["**/*"]
        excludes = excludes or []

        for src in sources:
            src_path = self._workdir / src
            if not src_path.exists():
                raise FileNotFoundError(f"Source not found: {src_path}")

            if src_path.is_file():
                resolved.append((src_path, Path(src_path.name)))
            elif src_path.is_dir():
                for root, dirs, files in os.walk(src_path):
                    for f in files:
                        file_path = Path(root) / f
                        rel_path = file_path.relative_to(src_path)
                        rel_str = str(rel_path).replace("\\", "/")

                        included = any(
                            self._match_glob(rel_str, inc) for inc in includes
                        )
                        excluded = any(
                            self._match_glob(rel_str, exc) for exc in excludes
                        )

                        if included and not excluded:
                            resolved.append((file_path, rel_path))

        return resolved

    @staticmethod
    def _match_glob(path: str, pattern: str) -> bool:
        """Match a path against a glob pattern, supporting ** for recursive matching."""
        pattern = pattern.replace("\\", "/")
        path = path.replace("\\", "/")

        if "**" in pattern:
            if pattern == "**/*" or pattern == "**":
                return True

            parts = pattern.split("**")
            if len(parts) == 2:
                prefix, suffix = parts
                prefix = prefix.rstrip("/")
                suffix = suffix.lstrip("/")

                if prefix and not path.startswith(prefix):
                    return False

                if suffix:
                    if "/" in suffix:
                        return Path(path).match(pattern)
                    else:
                        if not fnmatch.fnmatch(path.split("/")[-1], suffix):
                            return False

                return True
            elif len(parts) > 2:
                return Path(path).match(pattern)

        return fnmatch.fnmatch(path, pattern)

    @staticmethod
    def _compute_checksums(file_path: Path) -> Dict[str, str]:
        """Compute MD5 and SHA-256 checksums of a file."""
        import hashlib

        md5 = hashlib.md5()
        sha256 = hashlib.sha256()

        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                md5.update(chunk)
                sha256.update(chunk)

        return {"md5": md5.hexdigest(), "sha256": sha256.hexdigest()}


class ZipPackager(BasePackager):
    """Creates ZIP archives."""

    def package(
        self,
        artifact_def: Dict[str, Any],
        output_dir: str,
    ) -> PackageResult:
        """Package files into a ZIP archive."""
        name = artifact_def["name"]
        sources = artifact_def["source"]
        output = artifact_def.get("output") or f"{name}.zip"
        includes = artifact_def.get("includes")
        excludes = artifact_def.get("excludes")

        output_path = Path(output_dir) / output
        output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            files = self._resolve_paths(sources, includes, excludes)

            with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
                for file_path, arcname in files:
                    zf.write(file_path, str(arcname))

            size = output_path.stat().st_size
            checksums = self._compute_checksums(output_path)

            return PackageResult(
                name=name,
                success=True,
                output_path=str(output_path),
                size=size,
                checksums=checksums,
            )
        except Exception as e:
            return PackageResult(
                name=name,
                success=False,
                error=str(e),
            )

    def _find_common_base(self, files: List[Path]) -> Path:
        """Find the common base directory for a list of files."""
        if not files:
            return self._workdir
        parts = files[0].parts
        for f in files[1:]:
            common = []
            for a, b in zip(parts, f.parts):
                if a == b:
                    common.append(a)
                else:
                    break
            parts = tuple(common)
            if not parts:
                break
        return Path(*parts) if parts else files[0].parent


class TarGzPackager(BasePackager):
    """Creates TAR.GZ archives."""

    def package(
        self,
        artifact_def: Dict[str, Any],
        output_dir: str,
    ) -> PackageResult:
        """Package files into a TAR.GZ archive."""
        name = artifact_def["name"]
        sources = artifact_def["source"]
        output = artifact_def.get("output") or f"{name}.tar.gz"
        includes = artifact_def.get("includes")
        excludes = artifact_def.get("excludes")

        output_path = Path(output_dir) / output
        output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            files = self._resolve_paths(sources, includes, excludes)

            with tarfile.open(output_path, "w:gz") as tf:
                for file_path, arcname in files:
                    tf.add(file_path, str(arcname))

            size = output_path.stat().st_size
            checksums = self._compute_checksums(output_path)

            return PackageResult(
                name=name,
                success=True,
                output_path=str(output_path),
                size=size,
                checksums=checksums,
            )
        except Exception as e:
            return PackageResult(
                name=name,
                success=False,
                error=str(e),
            )

    def _find_common_base(self, files: List[Path]) -> Path:
        if not files:
            return self._workdir
        parts = files[0].parts
        for f in files[1:]:
            common = []
            for a, b in zip(parts, f.parts):
                if a == b:
                    common.append(a)
                else:
                    break
            parts = tuple(common)
            if not parts:
                break
        return Path(*parts) if parts else files[0].parent


class JarPackager(BasePackager):
    """Creates JAR files (Java Archive)."""

    MANIFEST_TEMPLATE = """Manifest-Version: 1.0
Created-By: BuildForge {version}
Build-Timestamp: {timestamp}
"""

    def package(
        self,
        artifact_def: Dict[str, Any],
        output_dir: str,
    ) -> PackageResult:
        """Package files into a JAR archive."""
        name = artifact_def["name"]
        sources = artifact_def["source"]
        output = artifact_def.get("output") or f"{name}.jar"
        includes = artifact_def.get("includes")
        excludes = artifact_def.get("excludes")

        output_path = Path(output_dir) / output
        output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            files = self._resolve_paths(sources, includes, excludes)

            with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
                from datetime import datetime, timezone

                manifest_content = self.MANIFEST_TEMPLATE.format(
                    version="0.1.0",
                    timestamp=datetime.now(timezone.utc).isoformat(),
                )
                zf.writestr("META-INF/MANIFEST.MF", manifest_content)

                for file_path, arcname in files:
                    if str(arcname) != "META-INF/MANIFEST.MF":
                        zf.write(file_path, str(arcname))

            size = output_path.stat().st_size
            checksums = self._compute_checksums(output_path)

            return PackageResult(
                name=name,
                success=True,
                output_path=str(output_path),
                size=size,
                checksums=checksums,
            )
        except Exception as e:
            return PackageResult(
                name=name,
                success=False,
                error=str(e),
            )

    def _find_common_base(self, files: List[Path]) -> Path:
        if not files:
            return self._workdir
        parts = files[0].parts
        for f in files[1:]:
            common = []
            for a, b in zip(parts, f.parts):
                if a == b:
                    common.append(a)
                else:
                    break
            parts = tuple(common)
            if not parts:
                break
        return Path(*parts) if parts else files[0].parent


class DockerPackager(BasePackager):
    """Builds Docker images."""

    def __init__(self, workdir: str) -> None:
        super().__init__(workdir)
        self._client = None
        if DOCKER_AVAILABLE:
            try:
                self._client = docker.from_env()
            except Exception:
                self._client = None

    def package(
        self,
        artifact_def: Dict[str, Any],
        output_dir: str,
    ) -> PackageResult:
        """Build a Docker image."""
        name = artifact_def["name"]
        dockerfile = artifact_def.get("dockerfile", "Dockerfile")
        tags = artifact_def.get("tags", ["latest"])
        sources = artifact_def.get("source", ["."])

        dockerfile_path = self._workdir / dockerfile
        if not dockerfile_path.exists():
            return PackageResult(
                name=name,
                success=False,
                error=f"Dockerfile not found: {dockerfile_path}",
            )

        if not DOCKER_AVAILABLE or not self._client:
            return PackageResult(
                name=name,
                success=False,
                error="Docker SDK not available or Docker daemon not running",
            )

        try:
            context_base = self._workdir

            build_tags = [f"{name}:{tag}" for tag in tags]
            first_tag = build_tags[0]

            image, build_logs = self._client.images.build(
                path=str(context_base),
                dockerfile=str(dockerfile_path.relative_to(context_base)),
                tag=first_tag,
            )

            for tag in build_tags[1:]:
                image.tag(tag)

            image_id = image.id
            image_size = image.attrs.get("Size", 0)

            output_file = Path(output_dir) / f"{name}-{tags[0]}.tar"
            output_file.parent.mkdir(parents=True, exist_ok=True)

            with open(output_file, "wb") as f:
                for chunk in image.save(named=True):
                    f.write(chunk)

            checksums = self._compute_checksums(output_file)

            return PackageResult(
                name=name,
                success=True,
                output_path=str(output_file),
                size=output_file.stat().st_size,
                checksums=checksums,
            )
        except Exception as e:
            return PackageResult(
                name=name,
                success=False,
                error=str(e),
            )


class Packager:
    """Main packaging coordinator that dispatches to the appropriate packager."""

    def __init__(self, workdir: str) -> None:
        self._workdir = workdir
        self._packagers: Dict[str, BasePackager] = {
            "zip": ZipPackager(workdir),
            "tar.gz": TarGzPackager(workdir),
            "jar": JarPackager(workdir),
            "docker": DockerPackager(workdir),
        }

    def package_all(
        self,
        artifacts: List[Dict[str, Any]],
        output_dir: str,
    ) -> List[PackageResult]:
        """Package all artifacts."""
        results: List[PackageResult] = []
        for artifact in artifacts:
            result = self.package(artifact, output_dir)
            results.append(result)
        return results

    def package(
        self,
        artifact: Dict[str, Any],
        output_dir: str,
    ) -> PackageResult:
        """Package a single artifact."""
        artifact_type = artifact["type"]
        if artifact_type not in self._packagers:
            return PackageResult(
                name=artifact["name"],
                success=False,
                error=f"Unsupported artifact type: {artifact_type}",
            )

        return self._packagers[artifact_type].package(artifact, output_dir)
