"""加密模块 - 对称加密和非对称加密"""

import os
import struct
from typing import Optional, Tuple, Union
from enum import Enum

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding, hashes
from cryptography.hazmat.primitives.asymmetric import rsa, ec, padding as asym_padding
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
from cryptography.exceptions import InvalidTag

try:
    from .crypto_random import generate_iv, generate_aes_key, generate_des_key, generate_3des_key
except ImportError:
    from crypto_random import generate_iv, generate_aes_key, generate_des_key, generate_3des_key


class Algorithm(Enum):
    AES_128 = "aes-128"
    AES_192 = "aes-192"
    AES_256 = "aes-256"
    DES = "des"
    DES3 = "3des"
    RC4 = "rc4"


class Mode(Enum):
    ECB = "ecb"
    CBC = "cbc"
    CFB = "cfb"
    OFB = "ofb"
    CTR = "ctr"
    GCM = "gcm"


class Padding(Enum):
    PKCS7 = "pkcs7"
    PKCS5 = "pkcs5"
    PKCS1 = "pkcs1"
    ZERO = "zero"
    NONE = "none"


class KeyFormat(Enum):
    PEM = "pem"
    DER = "der"
    PKCS8 = "pkcs8"
    PKCS12 = "pkcs12"


class CurveType(Enum):
    SECP256K1 = "secp256k1"
    SECP256R1 = "secp256r1"
    SECP384R1 = "secp384r1"
    SECP521R1 = "secp521r1"


_ALGORITHM_KEY_SIZE = {
    Algorithm.AES_128: 16,
    Algorithm.AES_192: 24,
    Algorithm.AES_256: 32,
    Algorithm.DES: 8,
    Algorithm.DES3: 24,
}

_ALGORITHM_BLOCK_SIZE = {
    Algorithm.AES_128: 16,
    Algorithm.AES_192: 16,
    Algorithm.AES_256: 16,
    Algorithm.DES: 8,
    Algorithm.DES3: 8,
}

_MODE_NEEDS_IV = {
    Mode.ECB: False,
    Mode.CBC: True,
    Mode.CFB: True,
    Mode.OFB: True,
    Mode.CTR: True,
    Mode.GCM: True,
}


class SymmetricCipher:
    """对称加密类"""

    def __init__(
        self,
        algorithm: Union[Algorithm, str] = Algorithm.AES_256,
        mode: Union[Mode, str] = Mode.CBC,
        padding: Union[Padding, str] = Padding.PKCS7,
        key: Optional[bytes] = None,
        iv: Optional[bytes] = None,
        aad: Optional[bytes] = None,
    ):
        """
        初始化对称加密器

        Args:
            algorithm: 加密算法
            mode: 加密模式
            padding: 填充模式
            key: 密钥，如未提供则自动生成
            iv: 初始化向量，如未提供则自动生成（需要 IV 的模式）
            aad: 附加认证数据（仅 GCM 模式）
        """
        if isinstance(algorithm, str):
            algorithm = Algorithm(algorithm.lower())
        if isinstance(mode, str):
            mode = Mode(mode.lower())
        if isinstance(padding, str):
            padding = Padding(padding.lower())

        self.algorithm = algorithm
        self.mode = mode
        self.padding = padding
        self.aad = aad
        self.tag = None

        if key is None:
            self.key = self._generate_key()
        else:
            self._validate_key(key)
            self.key = key

        if _MODE_NEEDS_IV[mode]:
            block_size = _ALGORITHM_BLOCK_SIZE[algorithm]
            if mode == Mode.GCM:
                iv_size = 12
            else:
                iv_size = block_size
            if iv is None:
                self.iv = generate_iv(iv_size)
            else:
                self._validate_iv(iv, iv_size)
                self.iv = iv
        else:
            self.iv = None

    def _generate_key(self) -> bytes:
        """生成密钥"""
        if self.algorithm in (Algorithm.AES_128, Algorithm.AES_192, Algorithm.AES_256):
            key_size_bits = int(self.algorithm.value.split('-')[1])
            return generate_aes_key(key_size_bits)
        elif self.algorithm == Algorithm.DES:
            return generate_des_key()
        elif self.algorithm == Algorithm.DES3:
            return generate_3des_key()
        else:
            raise ValueError(f"不支持的算法: {self.algorithm}")

    def _validate_key(self, key: bytes):
        """验证密钥长度"""
        expected_size = _ALGORITHM_KEY_SIZE.get(self.algorithm)
        if expected_size and len(key) != expected_size:
            raise ValueError(
                f"{self.algorithm.value} 密钥长度必须为 {expected_size} 字节，当前为 {len(key)} 字节"
            )

    def _validate_iv(self, iv: bytes, expected_size: int):
        """验证 IV 长度"""
        if len(iv) != expected_size:
            raise ValueError(
                f"{self.mode.value} 模式 IV 长度必须为 {expected_size} 字节，当前为 {len(iv)} 字节"
            )

    def _get_cipher(self) -> Cipher:
        """获取加密器"""
        if self.algorithm in (Algorithm.AES_128, Algorithm.AES_192, Algorithm.AES_256):
            algorithm = algorithms.AES(self.key)
        elif self.algorithm == Algorithm.DES:
            algorithm = algorithms.TripleDES(self.key[:8])
        elif self.algorithm == Algorithm.DES3:
            algorithm = algorithms.TripleDES(self.key)
        else:
            raise ValueError(f"不支持的算法: {self.algorithm}")

        if self.mode == Mode.ECB:
            mode = modes.ECB()
        elif self.mode == Mode.CBC:
            mode = modes.CBC(self.iv)
        elif self.mode == Mode.CFB:
            mode = modes.CFB(self.iv)
        elif self.mode == Mode.OFB:
            mode = modes.OFB(self.iv)
        elif self.mode == Mode.CTR:
            mode = modes.CTR(self.iv)
        elif self.mode == Mode.GCM:
            mode = modes.GCM(self.iv)
        else:
            raise ValueError(f"不支持的模式: {self.mode}")

        return Cipher(algorithm, mode, backend=default_backend())

    def _pad(self, data: bytes) -> bytes:
        """数据填充"""
        if self.padding == Padding.NONE or self.mode == Mode.CTR or self.mode == Mode.GCM:
            return data

        block_size = _ALGORITHM_BLOCK_SIZE[self.algorithm] * 8

        if self.padding == Padding.PKCS7 or self.padding == Padding.PKCS5:
            padder = padding.PKCS7(block_size).padder()
            return padder.update(data) + padder.finalize()
        elif self.padding == Padding.ZERO:
            pad_len = block_size // 8 - len(data) % (block_size // 8)
            if pad_len == block_size // 8:
                pad_len = 0
            return data + b'\x00' * pad_len
        elif self.padding == Padding.PKCS1:
            pad_len = block_size // 8 - len(data) % (block_size // 8) - 3
            if pad_len > 0:
                padding_data = bytes([0x00, 0x02] + [os.urandom(1)[0] for _ in range(pad_len)] + [0x00])
                return padding_data + data
            return data
        else:
            return data

    def _unpad(self, data: bytes) -> bytes:
        """数据去填充"""
        if self.padding == Padding.NONE or self.mode == Mode.CTR or self.mode == Mode.GCM:
            return data

        block_size = _ALGORITHM_BLOCK_SIZE[self.algorithm] * 8

        if self.padding == Padding.PKCS7 or self.padding == Padding.PKCS5:
            unpadder = padding.PKCS7(block_size).unpadder()
            return unpadder.update(data) + unpadder.finalize()
        elif self.padding == Padding.ZERO:
            return data.rstrip(b'\x00')
        elif self.padding == Padding.PKCS1:
            idx = data.find(b'\x00', 2)
            if idx != -1:
                return data[idx + 1:]
            return data
        else:
            return data

    def encrypt(self, plaintext: Union[str, bytes]) -> bytes:
        """
        加密数据

        Args:
            plaintext: 明文数据（字符串或字节）

        Returns:
            密文数据（IV + 密文 [+ Tag]）
        """
        if isinstance(plaintext, str):
            plaintext = plaintext.encode('utf-8')

        padded_data = self._pad(plaintext)
        cipher = self._get_cipher()
        encryptor = cipher.encryptor()

        if self.mode == Mode.GCM and self.aad:
            encryptor.authenticate_additional_data(self.aad)

        ciphertext = encryptor.update(padded_data) + encryptor.finalize()

        result = b''
        if self.iv is not None:
            result += self.iv
        result += ciphertext

        if self.mode == Mode.GCM:
            self.tag = encryptor.tag
            result += self.tag

        return result

    def decrypt(self, ciphertext: bytes) -> bytes:
        """
        解密数据

        Args:
            ciphertext: 密文数据（IV + 密文 [+ Tag]）

        Returns:
            明文数据
        """
        offset = 0
        tag = None

        if self.mode == Mode.GCM:
            tag = ciphertext[-16:]
            ciphertext = ciphertext[:-16]

        if self.iv is not None:
            iv_size = 12 if self.mode == Mode.GCM else _ALGORITHM_BLOCK_SIZE[self.algorithm]
            self.iv = ciphertext[:iv_size]
            offset = iv_size

        actual_ciphertext = ciphertext[offset:]

        if self.mode == Mode.GCM:
            cipher = Cipher(
                self._get_algorithm_object(),
                modes.GCM(self.iv, tag),
                backend=default_backend()
            )
        else:
            cipher = self._get_cipher()

        decryptor = cipher.decryptor()

        if self.mode == Mode.GCM and self.aad:
            decryptor.authenticate_additional_data(self.aad)

        try:
            plaintext = decryptor.update(actual_ciphertext) + decryptor.finalize()
        except InvalidTag:
            raise ValueError("认证失败，数据可能被篡改")

        return self._unpad(plaintext)

    def _get_algorithm_object(self):
        """获取算法对象"""
        if self.algorithm in (Algorithm.AES_128, Algorithm.AES_192, Algorithm.AES_256):
            return algorithms.AES(self.key)
        elif self.algorithm == Algorithm.DES:
            return algorithms.TripleDES(self.key[:8])
        elif self.algorithm == Algorithm.DES3:
            return algorithms.TripleDES(self.key)
        else:
            raise ValueError(f"不支持的算法: {self.algorithm}")


class RSACipher:
    """RSA 非对称加密类"""

    def __init__(self, key_size: int = 2048):
        """
        初始化 RSA 加密器

        Args:
            key_size: 密钥大小，支持 1024, 2048, 4096 位
        """
        if key_size not in (1024, 2048, 3072, 4096):
            raise ValueError("RSA 密钥大小必须是 1024, 2048, 3072 或 4096 位")
        self.key_size = key_size
        self.private_key = None
        self.public_key = None

    def generate_keys(self):
        """生成 RSA 密钥对"""
        self.private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=self.key_size,
            backend=default_backend()
        )
        self.public_key = self.private_key.public_key()

    def load_private_key(
        self,
        key_data: bytes,
        password: Optional[bytes] = None,
        format: KeyFormat = KeyFormat.PEM
    ):
        """加载私钥"""
        if format == KeyFormat.PEM:
            self.private_key = serialization.load_pem_private_key(
                key_data, password=password, backend=default_backend()
            )
        elif format == KeyFormat.DER:
            self.private_key = serialization.load_der_private_key(
                key_data, password=password, backend=default_backend()
            )
        elif format == KeyFormat.PKCS8:
            self.private_key = serialization.load_pem_private_key(
                key_data, password=password, backend=default_backend()
            )
        self.public_key = self.private_key.public_key()

    def load_public_key(self, key_data: bytes, format: KeyFormat = KeyFormat.PEM):
        """加载公钥"""
        if format == KeyFormat.PEM:
            self.public_key = serialization.load_pem_public_key(
                key_data, backend=default_backend()
            )
        elif format == KeyFormat.DER:
            self.public_key = serialization.load_der_public_key(
                key_data, backend=default_backend()
            )

    def serialize_private_key(
        self,
        format: KeyFormat = KeyFormat.PEM,
        password: Optional[bytes] = None,
        encryption_algorithm: Optional[serialization.KeySerializationEncryption] = None
    ) -> bytes:
        """序列化私钥"""
        if not self.private_key:
            raise ValueError("私钥未设置")

        if password and encryption_algorithm is None:
            encryption_algorithm = serialization.BestAvailableEncryption(password)
        elif encryption_algorithm is None:
            encryption_algorithm = serialization.NoEncryption()

        if format == KeyFormat.PEM:
            return self.private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=encryption_algorithm
            )
        elif format == KeyFormat.DER:
            return self.private_key.private_bytes(
                encoding=serialization.Encoding.DER,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=encryption_algorithm
            )
        elif format == KeyFormat.PKCS8:
            return self.private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=encryption_algorithm
            )
        else:
            raise ValueError(f"不支持的密钥格式: {format}")

    def serialize_public_key(self, format: KeyFormat = KeyFormat.PEM) -> bytes:
        """序列化公钥"""
        if not self.public_key:
            raise ValueError("公钥未设置")

        if format == KeyFormat.PEM:
            return self.public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            )
        elif format == KeyFormat.DER:
            return self.public_key.public_bytes(
                encoding=serialization.Encoding.DER,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            )
        elif format == KeyFormat.PKCS8:
            return self.public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.PKCS1
            )
        else:
            raise ValueError(f"不支持的密钥格式: {format}")

    def encrypt(self, plaintext: Union[str, bytes]) -> bytes:
        """
        使用公钥加密

        Args:
            plaintext: 明文数据

        Returns:
            密文数据
        """
        if not self.public_key:
            raise ValueError("公钥未设置")

        if isinstance(plaintext, str):
            plaintext = plaintext.encode('utf-8')

        return self.public_key.encrypt(
            plaintext,
            asym_padding.OAEP(
                mgf=asym_padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )

    def decrypt(self, ciphertext: bytes) -> bytes:
        """
        使用私钥解密

        Args:
            ciphertext: 密文数据

        Returns:
            明文数据
        """
        if not self.private_key:
            raise ValueError("私钥未设置")

        return self.private_key.decrypt(
            ciphertext,
            asym_padding.OAEP(
                mgf=asym_padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )

    def sign(self, data: Union[str, bytes]) -> bytes:
        """
        使用私钥签名

        Args:
            data: 待签名数据

        Returns:
            签名
        """
        if not self.private_key:
            raise ValueError("私钥未设置")

        if isinstance(data, str):
            data = data.encode('utf-8')

        return self.private_key.sign(
            data,
            asym_padding.PSS(
                mgf=asym_padding.MGF1(hashes.SHA256()),
                salt_length=asym_padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )

    def verify(self, signature: bytes, data: Union[str, bytes]) -> bool:
        """
        使用公钥验签

        Args:
            signature: 签名
            data: 原始数据

        Returns:
            验签是否通过
        """
        if not self.public_key:
            raise ValueError("公钥未设置")

        if isinstance(data, str):
            data = data.encode('utf-8')

        try:
            self.public_key.verify(
                signature,
                data,
                asym_padding.PSS(
                    mgf=asym_padding.MGF1(hashes.SHA256()),
                    salt_length=asym_padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            return True
        except Exception:
            return False


class ECCipher:
    """椭圆曲线加密类"""

    def __init__(self, curve: Union[CurveType, str] = CurveType.SECP256R1):
        """
        初始化椭圆曲线加密器

        Args:
            curve: 椭圆曲线类型
        """
        if isinstance(curve, str):
            curve = CurveType(curve.lower())
        self.curve = curve
        self.private_key = None
        self.public_key = None

    def _get_curve(self):
        """获取曲线对象"""
        curve_map = {
            CurveType.SECP256K1: ec.SECP256K1(),
            CurveType.SECP256R1: ec.SECP256R1(),
            CurveType.SECP384R1: ec.SECP384R1(),
            CurveType.SECP521R1: ec.SECP521R1(),
        }
        return curve_map.get(self.curve, ec.SECP256R1())

    def generate_keys(self):
        """生成 ECC 密钥对"""
        self.private_key = ec.generate_private_key(self._get_curve(), default_backend())
        self.public_key = self.private_key.public_key()

    def load_private_key(self, key_data: bytes, format: KeyFormat = KeyFormat.PEM):
        """加载私钥"""
        if format == KeyFormat.PEM:
            self.private_key = serialization.load_pem_private_key(
                key_data, password=None, backend=default_backend()
            )
        elif format == KeyFormat.DER:
            self.private_key = serialization.load_der_private_key(
                key_data, password=None, backend=default_backend()
            )
        self.public_key = self.private_key.public_key()

    def load_public_key(self, key_data: bytes, format: KeyFormat = KeyFormat.PEM):
        """加载公钥"""
        if format == KeyFormat.PEM:
            self.public_key = serialization.load_pem_public_key(
                key_data, backend=default_backend()
            )
        elif format == KeyFormat.DER:
            self.public_key = serialization.load_der_public_key(
                key_data, backend=default_backend()
            )

    def serialize_private_key(self, format: KeyFormat = KeyFormat.PEM) -> bytes:
        """序列化私钥"""
        if not self.private_key:
            raise ValueError("私钥未设置")

        if format == KeyFormat.PEM:
            return self.private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption()
            )
        elif format == KeyFormat.DER:
            return self.private_key.private_bytes(
                encoding=serialization.Encoding.DER,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption()
            )
        elif format == KeyFormat.PKCS8:
            return self.private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            )
        else:
            raise ValueError(f"不支持的密钥格式: {format}")

    def serialize_public_key(self, format: KeyFormat = KeyFormat.PEM) -> bytes:
        """序列化公钥"""
        if not self.public_key:
            raise ValueError("公钥未设置")

        if format == KeyFormat.PEM:
            return self.public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            )
        elif format == KeyFormat.DER:
            return self.public_key.public_bytes(
                encoding=serialization.Encoding.DER,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            )
        elif format == KeyFormat.PKCS8:
            return self.public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            )
        else:
            raise ValueError(f"不支持的密钥格式: {format}")

    def sign(self, data: Union[str, bytes]) -> bytes:
        """
        使用私钥签名（ECDSA）

        Args:
            data: 待签名数据

        Returns:
            签名
        """
        if not self.private_key:
            raise ValueError("私钥未设置")

        if isinstance(data, str):
            data = data.encode('utf-8')

        return self.private_key.sign(
            data,
            ec.ECDSA(hashes.SHA256())
        )

    def verify(self, signature: bytes, data: Union[str, bytes]) -> bool:
        """
        使用公钥验签

        Args:
            signature: 签名
            data: 原始数据

        Returns:
            验签是否通过
        """
        if not self.public_key:
            raise ValueError("公钥未设置")

        if isinstance(data, str):
            data = data.encode('utf-8')

        try:
            self.public_key.verify(signature, data, ec.ECDSA(hashes.SHA256()))
            return True
        except Exception:
            return False

    def derive_shared_key(self, other_public_key: ec.EllipticCurvePublicKey) -> bytes:
        """
        派生共享密钥（ECDH）

        Args:
            other_public_key: 对方的公钥

        Returns:
            共享密钥
        """
        if not self.private_key:
            raise ValueError("私钥未设置")

        shared_key = self.private_key.exchange(ec.ECDH(), other_public_key)
        return shared_key


def encrypt_aes(plaintext: Union[str, bytes], key: bytes, mode: str = "cbc") -> bytes:
    """快速 AES 加密"""
    cipher = SymmetricCipher(algorithm=Algorithm.AES_256, mode=Mode(mode), key=key)
    return cipher.encrypt(plaintext)


def decrypt_aes(ciphertext: bytes, key: bytes, mode: str = "cbc") -> bytes:
    """快速 AES 解密"""
    cipher = SymmetricCipher(algorithm=Algorithm.AES_256, mode=Mode(mode), key=key)
    return cipher.decrypt(ciphertext)
