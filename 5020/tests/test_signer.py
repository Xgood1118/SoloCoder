"""Tests for the signing and verification module."""

import json
import tempfile
from pathlib import Path

import pytest

from buildforge.signer import KeyManager, ArtifactSigner


class TestKeyManager:
    """Test KeyManager class."""

    def test_generate_keys(self, temp_workdir):
        """Test generating a new key pair."""
        key_dir = temp_workdir / "keys"
        manager = KeyManager(key_dir=str(key_dir))

        private_path, public_path = manager.generate_keys("test-key")

        assert private_path.exists()
        assert public_path.exists()
        assert private_path.name == "test-key.private.pem"
        assert public_path.name == "test-key.public.pem"

        with open(private_path, "r") as f:
            content = f.read()
            assert "PRIVATE KEY" in content

        with open(public_path, "r") as f:
            content = f.read()
            assert "PUBLIC KEY" in content

    def test_load_private_key(self, temp_workdir):
        """Test loading a private key."""
        key_dir = temp_workdir / "keys"
        manager = KeyManager(key_dir=str(key_dir))
        manager.generate_keys("test")

        private_key = manager.load_private_key("test")
        assert private_key is not None

    def test_load_public_key(self, temp_workdir):
        """Test loading a public key."""
        key_dir = temp_workdir / "keys"
        manager = KeyManager(key_dir=str(key_dir))
        private_path, public_path = manager.generate_keys("test")

        public_key = manager.load_public_key(str(public_path))
        assert public_key is not None

    def test_load_missing_key_raises(self, temp_workdir):
        """Test loading a missing key raises FileNotFoundError."""
        key_dir = temp_workdir / "keys"
        manager = KeyManager(key_dir=str(key_dir))

        with pytest.raises(FileNotFoundError):
            manager.load_private_key("nonexistent")


class TestArtifactSigner:
    """Test ArtifactSigner class."""

    def test_sign_artifact(self, temp_workdir):
        """Test signing an artifact."""
        key_dir = temp_workdir / "keys"
        manager = KeyManager(key_dir=str(key_dir))
        manager.generate_keys("test")

        artifact_file = temp_workdir / "test-artifact.txt"
        artifact_file.write_text("Test artifact content")

        signer = ArtifactSigner(key_manager=manager)
        result = signer.sign(str(artifact_file), key_name="test")

        assert result["artifact"] == "test-artifact.txt"
        assert "file_hash" in result
        assert "signature" in result
        assert "signature_file" in result

        sig_file = Path(result["signature_file"])
        assert sig_file.exists()

        with open(sig_file, "r") as f:
            sig_data = json.load(f)
            assert sig_data["algorithm"] == "RSA-PSS/SHA-256"
            assert sig_data["key_name"] == "test"

    def test_verify_valid_signature(self, temp_workdir):
        """Test verifying a valid signature."""
        key_dir = temp_workdir / "keys"
        manager = KeyManager(key_dir=str(key_dir))
        private_path, public_path = manager.generate_keys("test")

        artifact_file = temp_workdir / "test-artifact.txt"
        artifact_file.write_text("Test artifact content")

        signer = ArtifactSigner(key_manager=manager)
        sign_result = signer.sign(str(artifact_file), key_name="test")

        verify_result = signer.verify(
            str(artifact_file),
            signature_path=sign_result["signature_file"],
            public_key_path=str(public_path),
        )

        assert verify_result["valid"] is True
        assert verify_result["artifact"] == str(artifact_file)

    def test_verify_tampered_artifact(self, temp_workdir):
        """Test detecting tampered artifacts."""
        key_dir = temp_workdir / "keys"
        manager = KeyManager(key_dir=str(key_dir))
        private_path, public_path = manager.generate_keys("test")

        artifact_file = temp_workdir / "test-artifact.txt"
        artifact_file.write_text("Original content")

        signer = ArtifactSigner(key_manager=manager)
        sign_result = signer.sign(str(artifact_file), key_name="test")

        artifact_file.write_text("Tampered content")

        verify_result = signer.verify(
            str(artifact_file),
            signature_path=sign_result["signature_file"],
            public_key_path=str(public_path),
        )

        assert verify_result["valid"] is False
        assert "hash mismatch" in verify_result["error"].lower()

    def test_verify_wrong_public_key(self, temp_workdir):
        """Test verification fails with wrong public key."""
        key_dir = temp_workdir / "keys"
        manager = KeyManager(key_dir=str(key_dir))
        manager.generate_keys("signing-key")
        _, other_public_path = manager.generate_keys("other-key")

        artifact_file = temp_workdir / "test-artifact.txt"
        artifact_file.write_text("Test content")

        signer = ArtifactSigner(key_manager=manager)
        sign_result = signer.sign(str(artifact_file), key_name="signing-key")

        verify_result = signer.verify(
            str(artifact_file),
            signature_path=sign_result["signature_file"],
            public_key_path=str(other_public_path),
        )

        assert verify_result["valid"] is False
        assert "verification failed" in verify_result["error"].lower()

    def test_generate_manifest(self, temp_workdir):
        """Test generating a verification manifest."""
        artifact_file = temp_workdir / "test-artifact.txt"
        artifact_file.write_text("Test artifact content")

        signer = ArtifactSigner()
        manifest = signer.generate_manifest(str(artifact_file))

        assert manifest["filename"] == "test-artifact.txt"
        assert manifest["size"] == len("Test artifact content")
        assert "sha256" in manifest
        assert len(manifest["sha256"]) == 64
        assert manifest["algorithm"] == "SHA-256"

    def test_generate_manifest_with_output(self, temp_workdir):
        """Test generating a manifest and writing to file."""
        artifact_file = temp_workdir / "test-artifact.txt"
        artifact_file.write_text("Test content")

        output_file = temp_workdir / "manifest.json"

        signer = ArtifactSigner()
        manifest = signer.generate_manifest(str(artifact_file), output_path=str(output_file))

        assert output_file.exists()
        with open(output_file, "r") as f:
            saved = json.load(f)
            assert saved["sha256"] == manifest["sha256"]

    def test_sign_missing_artifact_raises(self, temp_workdir):
        """Test signing a missing artifact raises FileNotFoundError."""
        key_dir = temp_workdir / "keys"
        manager = KeyManager(key_dir=str(key_dir))
        manager.generate_keys("test")

        signer = ArtifactSigner(key_manager=manager)

        with pytest.raises(FileNotFoundError):
            signer.sign(str(temp_workdir / "nonexistent.txt"), key_name="test")
