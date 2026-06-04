"""Artifact signing and verification using cryptographic signatures."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey, RSAPublicKey


class KeyManager:
    """Manages signing key generation, loading, and storage."""

    def __init__(self, key_dir: Optional[str] = None) -> None:
        self._key_dir = Path(key_dir) if key_dir else Path.home() / ".buildforge" / "keys"
        self._key_dir.mkdir(parents=True, exist_ok=True)

    def generate_keys(self, key_name: str = "default") -> Tuple[Path, Path]:
        """Generate a new RSA key pair for signing."""
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        public_key = private_key.public_key()

        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )

        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )

        private_path = self._key_dir / f"{key_name}.private.pem"
        public_path = self._key_dir / f"{key_name}.public.pem"

        private_path.write_bytes(private_pem)
        public_path.write_bytes(public_pem)

        os.chmod(private_path, 0o600)

        return private_path, public_path

    def load_private_key(self, key_name: str = "default") -> RSAPrivateKey:
        """Load a private key from file."""
        key_path = self._key_dir / f"{key_name}.private.pem"
        if not key_path.exists():
            raise FileNotFoundError(f"Private key not found: {key_path}")

        with open(key_path, "rb") as f:
            return serialization.load_pem_private_key(f.read(), password=None)

    def load_public_key(self, key_path: Optional[str] = None) -> RSAPublicKey:
        """Load a public key from file."""
        if key_path:
            path = Path(key_path)
        else:
            path = self._key_dir / "default.public.pem"

        if not path.exists():
            raise FileNotFoundError(f"Public key not found: {path}")

        with open(path, "rb") as f:
            return serialization.load_pem_public_key(f.read())


class ArtifactSigner:
    """Signs and verifies artifacts using RSA-PSS signatures."""

    def __init__(self, key_manager: Optional[KeyManager] = None) -> None:
        self._key_manager = key_manager or KeyManager()

    @staticmethod
    def _compute_file_hash(file_path: Path) -> bytes:
        """Compute SHA-256 hash of a file."""
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.digest()

    @staticmethod
    def _compute_manifest_hash(artifact_path: Path, file_hash: bytes) -> bytes:
        """Compute the combined hash of artifact metadata and content."""
        manifest = {
            "filename": artifact_path.name,
            "size": artifact_path.stat().st_size,
            "file_hash": file_hash.hex(),
            "algorithm": "SHA-256",
        }
        manifest_json = json.dumps(manifest, sort_keys=True).encode("utf-8")
        return hashlib.sha256(manifest_json).digest()

    def sign(
        self,
        artifact_path: str,
        key_name: str = "default",
        output_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Sign an artifact and create a signature file.
        
        Returns a dictionary with signing information.
        """
        artifact = Path(artifact_path)
        if not artifact.exists():
            raise FileNotFoundError(f"Artifact not found: {artifact_path}")

        file_hash = self._compute_file_hash(artifact)
        manifest_hash = self._compute_manifest_hash(artifact, file_hash)

        private_key = self._key_manager.load_private_key(key_name)
        signature = private_key.sign(
            manifest_hash,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH,
            ),
            hashes.SHA256(),
        )

        signature_info = {
            "artifact": artifact.name,
            "file_hash": file_hash.hex(),
            "manifest_hash": manifest_hash.hex(),
            "algorithm": "RSA-PSS/SHA-256",
            "key_name": key_name,
            "signature": signature.hex(),
        }

        sig_path = output_path or f"{artifact_path}.sig"
        with open(sig_path, "w", encoding="utf-8") as f:
            json.dump(signature_info, f, indent=2)

        signature_info["signature_file"] = sig_path
        return signature_info

    def verify(
        self,
        artifact_path: str,
        signature_path: Optional[str] = None,
        public_key_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Verify an artifact's signature.
        
        Returns a dictionary with verification result.
        """
        artifact = Path(artifact_path)
        if not artifact.exists():
            raise FileNotFoundError(f"Artifact not found: {artifact_path}")

        sig_path = signature_path or f"{artifact_path}.sig"
        if not Path(sig_path).exists():
            raise FileNotFoundError(f"Signature file not found: {sig_path}")

        with open(sig_path, "r", encoding="utf-8") as f:
            signature_info = json.load(f)

        file_hash = self._compute_file_hash(artifact)
        expected_file_hash = bytes.fromhex(signature_info["file_hash"])

        if file_hash != expected_file_hash:
            return {
                "valid": False,
                "error": "File hash mismatch - artifact may be corrupted or tampered",
                "artifact": artifact_path,
                "signature_file": sig_path,
            }

        manifest_hash = self._compute_manifest_hash(artifact, file_hash)
        expected_manifest_hash = bytes.fromhex(signature_info["manifest_hash"])

        if manifest_hash != expected_manifest_hash:
            return {
                "valid": False,
                "error": "Manifest hash mismatch - signature metadata corrupted",
                "artifact": artifact_path,
                "signature_file": sig_path,
            }

        public_key = self._key_manager.load_public_key(public_key_path)
        signature = bytes.fromhex(signature_info["signature"])

        try:
            public_key.verify(
                signature,
                manifest_hash,
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH,
                ),
                hashes.SHA256(),
            )
            return {
                "valid": True,
                "artifact": artifact_path,
                "signature_file": sig_path,
                "algorithm": signature_info.get("algorithm"),
                "key_name": signature_info.get("key_name"),
            }
        except Exception as e:
            return {
                "valid": False,
                "error": f"Signature verification failed: {str(e)}",
                "artifact": artifact_path,
                "signature_file": sig_path,
            }

    def generate_manifest(
        self, artifact_path: str, output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate a verification manifest for an artifact (without signing)."""
        artifact = Path(artifact_path)
        if not artifact.exists():
            raise FileNotFoundError(f"Artifact not found: {artifact_path}")

        file_hash = self._compute_file_hash(artifact)
        manifest = {
            "filename": artifact.name,
            "size": artifact.stat().st_size,
            "sha256": file_hash.hex(),
            "algorithm": "SHA-256",
        }

        if output_path:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(manifest, f, indent=2)
            manifest["manifest_file"] = output_path

        return manifest
