"""
加密传输模块
处理TLS配置、证书验证和数据加密
"""

from dataclasses import dataclass
from typing import Optional, Tuple
import ssl
import io
import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
from .config import TLSConfig
from .logger import get_logger

logger = get_logger("encryption")


@dataclass
class EncryptionResult:
    success: bool
    encrypted_data: Optional[io.BytesIO]
    original_size: int
    encrypted_size: int
    used_encryption: bool
    error_message: str = ""


class TLSSetupError(Exception):
    pass


class CertificateError(Exception):
    pass


class EncryptionManager:
    def __init__(self, tls_config: TLSConfig, encryption_key: Optional[str] = None):
        self.tls_config = tls_config
        self._fernet = None

        if encryption_key:
            try:
                self._fernet = Fernet(encryption_key.encode())
            except Exception as e:
                logger.warning(f"初始化加密器失败: {e}")

    def create_ssl_context(self) -> ssl.SSLContext:
        try:
            ssl_context = self._create_context_with_preferred_version()

            if not self.tls_config.verify_cert:
                logger.warning("证书验证已禁用，这可能导致安全风险")
                ssl_context.check_hostname = False
                ssl_context.verify_mode = ssl.CERT_NONE
            else:
                ssl_context.check_hostname = True
                ssl_context.verify_mode = ssl.CERT_REQUIRED
                ssl_context.load_default_certs()

            self._configure_ssl_options(ssl_context)

            logger.info(
                f"SSL上下文已创建，TLS版本偏好: {self.tls_config.version_preference}, "
                f"证书验证: {'开启' if self.tls_config.verify_cert else '关闭'}"
            )

            return ssl_context

        except ssl.SSLError as e:
            logger.error(f"TLS配置错误: {e}")
            raise TLSSetupError(f"TLS配置失败: {e}") from e

    def _create_context_with_preferred_version(self) -> ssl.SSLContext:
        for version in self.tls_config.version_preference:
            try:
                if version == "1.3":
                    if hasattr(ssl, "TLSVersion") and hasattr(ssl.TLSVersion, "TLSv1_3"):
                        ctx = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
                        ctx.maximum_version = ssl.TLSVersion.TLSv1_3
                        logger.debug("已配置优先使用TLS 1.3")
                        return ctx
                elif version == "1.2":
                    ctx = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
                    if hasattr(ssl, "TLSVersion"):
                        ctx.maximum_version = ssl.TLSVersion.TLSv1_2
                        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
                    logger.debug("已配置使用TLS 1.2")
                    return ctx
            except (AttributeError, ssl.SSLError) as e:
                logger.debug(f"TLS {version} 不可用，尝试下一个版本: {e}")
                continue

        logger.warning("指定的TLS版本都不可用，使用系统默认配置")
        return ssl.create_default_context(ssl.Purpose.SERVER_AUTH)

    @staticmethod
    def _configure_ssl_options(ssl_context: ssl.SSLContext):
        try:
            ssl_context.options |= ssl.OP_NO_SSLv2
            ssl_context.options |= ssl.OP_NO_SSLv3
            ssl_context.options |= ssl.OP_NO_TLSv1
            ssl_context.options |= ssl.OP_NO_TLSv1_1
        except AttributeError:
            pass

        try:
            ssl_context.options |= ssl.OP_SINGLE_DH_USE
            ssl_context.options |= ssl.OP_SINGLE_ECDH_USE
        except AttributeError:
            pass

    def verify_certificate(self, cert_path: str) -> Tuple[bool, str]:
        if not os.path.exists(cert_path):
            return False, f"证书文件不存在: {cert_path}"

        try:
            with open(cert_path, 'rb') as f:
                cert_data = f.read()

            import datetime
            from cryptography import x509

            cert = x509.load_pem_x509_certificate(cert_data)

            now = datetime.datetime.now(datetime.timezone.utc)

            if cert.not_valid_after_utc < now:
                return False, f"证书已过期，过期时间: {cert.not_valid_after_utc}"

            if cert.not_valid_before_utc > now:
                return False, f"证书尚未生效，生效时间: {cert.not_valid_before_utc}"

            logger.info(f"证书验证通过，过期时间: {cert.not_valid_after_utc}")
            return True, "证书有效"

        except ImportError:
            logger.warning("cryptography库未安装，无法详细验证证书")
            return True, "跳过详细证书验证"
        except Exception as e:
            return False, f"证书验证失败: {e}"

    @staticmethod
    def generate_encryption_key(password: str, salt: Optional[bytes] = None) -> Tuple[bytes, bytes]:
        if salt is None:
            salt = os.urandom(16)

        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=480000,
        )

        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        return key, salt

    def encrypt_data(self, data: bytes) -> EncryptionResult:
        if not self._fernet:
            return EncryptionResult(
                success=True,
                encrypted_data=io.BytesIO(data),
                original_size=len(data),
                encrypted_size=len(data),
                used_encryption=False
            )

        try:
            original_size = len(data)
            encrypted = self._fernet.encrypt(data)
            encrypted_size = len(encrypted)

            logger.debug(f"数据加密完成: {original_size} -> {encrypted_size} bytes")

            return EncryptionResult(
                success=True,
                encrypted_data=io.BytesIO(encrypted),
                original_size=original_size,
                encrypted_size=encrypted_size,
                used_encryption=True
            )
        except Exception as e:
            logger.error(f"数据加密失败: {e}")
            return EncryptionResult(
                success=False,
                encrypted_data=None,
                original_size=len(data),
                encrypted_size=0,
                used_encryption=False,
                error_message=f"加密失败: {e}"
            )

    def decrypt_data(self, encrypted_data: bytes) -> EncryptionResult:
        if not self._fernet:
            return EncryptionResult(
                success=True,
                encrypted_data=io.BytesIO(encrypted_data),
                original_size=len(encrypted_data),
                encrypted_size=len(encrypted_data),
                used_encryption=False
            )

        try:
            encrypted_size = len(encrypted_data)
            decrypted = self._fernet.decrypt(encrypted_data)
            original_size = len(decrypted)

            logger.debug(f"数据解密完成: {encrypted_size} -> {original_size} bytes")

            return EncryptionResult(
                success=True,
                encrypted_data=io.BytesIO(decrypted),
                original_size=original_size,
                encrypted_size=encrypted_size,
                used_encryption=True
            )
        except Exception as e:
            logger.error(f"数据解密失败: {e}")
            return EncryptionResult(
                success=False,
                encrypted_data=None,
                original_size=0,
                encrypted_size=len(encrypted_data),
                used_encryption=False,
                error_message=f"解密失败: {e}"
            )

    def encrypt_file(self, file_path: str) -> EncryptionResult:
        try:
            with open(file_path, 'rb') as f:
                data = f.read()
            return self.encrypt_data(data)
        except IOError as e:
            return EncryptionResult(
                success=False,
                encrypted_data=None,
                original_size=0,
                encrypted_size=0,
                used_encryption=False,
                error_message=f"读取文件失败: {e}"
            )


def get_secure_ssl_context(tls_config: TLSConfig) -> ssl.SSLContext:
    manager = EncryptionManager(tls_config)
    return manager.create_ssl_context()


def check_tls_availability() -> dict:
    info = {
        "openssl_version": ssl.OPENSSL_VERSION,
        "supported_protocols": [],
        "tls_1_3_supported": False,
        "tls_1_2_supported": True
    }

    if hasattr(ssl, "TLSVersion"):
        info["tls_1_3_supported"] = hasattr(ssl.TLSVersion, "TLSv1_3")

    try:
        ctx = ssl.create_default_context()
        if hasattr(ctx, "maximum_version"):
            info["max_version"] = str(ctx.maximum_version)
    except Exception:
        pass

    return info
