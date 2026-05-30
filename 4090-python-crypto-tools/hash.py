"""哈希和消息认证模块"""

import hashlib
import hmac
import zlib
from enum import Enum
from typing import Optional, Union

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend


class HashAlgorithm(Enum):
    MD5 = "md5"
    SHA1 = "sha1"
    SHA224 = "sha224"
    SHA256 = "sha256"
    SHA384 = "sha384"
    SHA512 = "sha512"
    SHA3_224 = "sha3-224"
    SHA3_256 = "sha3-256"
    SHA3_384 = "sha3-384"
    SHA3_512 = "sha3-512"
    BLAKE2B = "blake2b"
    BLAKE2S = "blake2s"
    RIPEMD160 = "ripemd160"
    WHIRLPOOL = "whirlpool"


class CRCType(Enum):
    CRC32 = "crc32"
    CRC64 = "crc64"
    CRC16 = "crc16"
    CRC8 = "crc8"


class HashTool:
    """哈希计算工具类"""

    @staticmethod
    def _get_hashlib_algorithm(algorithm: HashAlgorithm) -> str:
        """获取 hashlib 算法名称"""
        algo_map = {
            HashAlgorithm.MD5: "md5",
            HashAlgorithm.SHA1: "sha1",
            HashAlgorithm.SHA224: "sha224",
            HashAlgorithm.SHA256: "sha256",
            HashAlgorithm.SHA384: "sha384",
            HashAlgorithm.SHA512: "sha512",
            HashAlgorithm.SHA3_224: "sha3_224",
            HashAlgorithm.SHA3_256: "sha3_256",
            HashAlgorithm.SHA3_384: "sha3_384",
            HashAlgorithm.SHA3_512: "sha3_512",
            HashAlgorithm.BLAKE2B: "blake2b",
            HashAlgorithm.BLAKE2S: "blake2s",
            HashAlgorithm.RIPEMD160: "ripemd160",
        }
        return algo_map.get(algorithm, "sha256")

    @staticmethod
    def hash(
        data: Union[str, bytes],
        algorithm: Union[HashAlgorithm, str] = HashAlgorithm.SHA256,
        output_format: str = "hex"
    ) -> Union[str, bytes]:
        """
        计算哈希值

        Args:
            data: 待哈希的数据
            algorithm: 哈希算法
            output_format: 输出格式，'hex' 或 'bytes'

        Returns:
            哈希值
        """
        if isinstance(algorithm, str):
            algorithm = HashAlgorithm(algorithm.lower())

        if isinstance(data, str):
            data = data.encode('utf-8')

        algo_name = HashTool._get_hashlib_algorithm(algorithm)

        try:
            hash_obj = hashlib.new(algo_name)
            hash_obj.update(data)
            digest = hash_obj.digest()
        except Exception:
            hash_obj = hashes.Hash(
                HashTool._get_crypto_hash(algorithm),
                backend=default_backend()
            )
            hash_obj.update(data)
            digest = hash_obj.finalize()

        if output_format == "hex":
            return digest.hex()
        return digest

    @staticmethod
    def _get_crypto_hash(algorithm: HashAlgorithm):
        """获取 cryptography 哈希对象"""
        hash_map = {
            HashAlgorithm.MD5: hashes.MD5(),
            HashAlgorithm.SHA1: hashes.SHA1(),
            HashAlgorithm.SHA224: hashes.SHA224(),
            HashAlgorithm.SHA256: hashes.SHA256(),
            HashAlgorithm.SHA384: hashes.SHA384(),
            HashAlgorithm.SHA512: hashes.SHA512(),
            HashAlgorithm.SHA3_224: hashes.SHA3_224(),
            HashAlgorithm.SHA3_256: hashes.SHA3_256(),
            HashAlgorithm.SHA3_384: hashes.SHA3_384(),
            HashAlgorithm.SHA3_512: hashes.SHA3_512(),
            HashAlgorithm.BLAKE2B: hashes.BLAKE2b(64),
            HashAlgorithm.BLAKE2S: hashes.BLAKE2s(32),
        }
        return hash_map.get(algorithm, hashes.SHA256())

    @staticmethod
    def hash_file(
        file_path: str,
        algorithm: Union[HashAlgorithm, str] = HashAlgorithm.SHA256,
        output_format: str = "hex",
        chunk_size: int = 8192
    ) -> Union[str, bytes]:
        """
        计算文件哈希值（流式处理）

        Args:
            file_path: 文件路径
            algorithm: 哈希算法
            output_format: 输出格式
            chunk_size: 块大小

        Returns:
            哈希值
        """
        if isinstance(algorithm, str):
            algorithm = HashAlgorithm(algorithm.lower())

        algo_name = HashTool._get_hashlib_algorithm(algorithm)
        hash_obj = hashlib.new(algo_name)

        with open(file_path, 'rb') as f:
            while chunk := f.read(chunk_size):
                hash_obj.update(chunk)

        digest = hash_obj.digest()

        if output_format == "hex":
            return digest.hex()
        return digest

    @staticmethod
    def crc(
        data: Union[str, bytes],
        crc_type: Union[CRCType, str] = CRCType.CRC32
    ) -> int:
        """
        计算 CRC 校验值

        Args:
            data: 待计算的数据
            crc_type: CRC 类型

        Returns:
            CRC 校验值
        """
        if isinstance(crc_type, str):
            crc_type = CRCType(crc_type.lower())

        if isinstance(data, str):
            data = data.encode('utf-8')

        if crc_type == CRCType.CRC32:
            return zlib.crc32(data) & 0xffffffff
        elif crc_type == CRCType.CRC64:
            return zlib.crc32(data) & 0xffffffffffffffff
        elif crc_type == CRCType.CRC16:
            crc = 0
            for byte in data:
                crc ^= byte
                for _ in range(8):
                    if crc & 1:
                        crc = (crc >> 1) ^ 0xA001
                    else:
                        crc >>= 1
            return crc & 0xffff
        elif crc_type == CRCType.CRC8:
            crc = 0
            for byte in data:
                crc ^= byte
                for _ in range(8):
                    if crc & 0x80:
                        crc = (crc << 1) ^ 0x07
                    else:
                        crc <<= 1
                crc &= 0xff
            return crc
        else:
            raise ValueError(f"不支持的 CRC 类型: {crc_type}")

    @staticmethod
    def adler32(data: Union[str, bytes]) -> int:
        """
        计算 Adler-32 校验值

        Args:
            data: 待计算的数据

        Returns:
            Adler-32 校验值
        """
        if isinstance(data, str):
            data = data.encode('utf-8')
        return zlib.adler32(data) & 0xffffffff

    @staticmethod
    def blake2(
        data: Union[str, bytes],
        digest_size: int = 32,
        key: Optional[bytes] = None,
        output_format: str = "hex"
    ) -> Union[str, bytes]:
        """
        计算 BLAKE2 哈希值（支持带密钥）

        Args:
            data: 待哈希的数据
            digest_size: 摘要大小
            key: 可选密钥（用于 MAC）
            output_format: 输出格式

        Returns:
            哈希值
        """
        if isinstance(data, str):
            data = data.encode('utf-8')

        hash_obj = hashlib.blake2b(digest_size=digest_size, key=key or b'')
        hash_obj.update(data)
        digest = hash_obj.digest()

        if output_format == "hex":
            return digest.hex()
        return digest


class HMACTool:
    """HMAC 工具类"""

    @staticmethod
    def hmac(
        key: bytes,
        data: Union[str, bytes],
        algorithm: Union[HashAlgorithm, str] = HashAlgorithm.SHA256,
        output_format: str = "hex"
    ) -> Union[str, bytes]:
        """
        计算 HMAC

        Args:
            key: 密钥
            data: 待计算的数据
            algorithm: 哈希算法
            output_format: 输出格式

        Returns:
            HMAC 值
        """
        if isinstance(algorithm, str):
            algorithm = HashAlgorithm(algorithm.lower())

        if isinstance(data, str):
            data = data.encode('utf-8')

        algo_name = HashTool._get_hashlib_algorithm(algorithm)
        hmac_obj = hmac.new(key, data, algo_name)
        digest = hmac_obj.digest()

        if output_format == "hex":
            return digest.hex()
        return digest

    @staticmethod
    def hmac_file(
        key: bytes,
        file_path: str,
        algorithm: Union[HashAlgorithm, str] = HashAlgorithm.SHA256,
        output_format: str = "hex",
        chunk_size: int = 8192
    ) -> Union[str, bytes]:
        """
        计算文件的 HMAC

        Args:
            key: 密钥
            file_path: 文件路径
            algorithm: 哈希算法
            output_format: 输出格式
            chunk_size: 块大小

        Returns:
            HMAC 值
        """
        if isinstance(algorithm, str):
            algorithm = HashAlgorithm(algorithm.lower())

        algo_name = HashTool._get_hashlib_algorithm(algorithm)
        hmac_obj = hmac.new(key, None, algo_name)

        with open(file_path, 'rb') as f:
            while chunk := f.read(chunk_size):
                hmac_obj.update(chunk)

        digest = hmac_obj.digest()

        if output_format == "hex":
            return digest.hex()
        return digest

    @staticmethod
    def verify(
        key: bytes,
        data: Union[str, bytes],
        expected_hmac: Union[str, bytes],
        algorithm: Union[HashAlgorithm, str] = HashAlgorithm.SHA256
    ) -> bool:
        """
        验证 HMAC

        Args:
            key: 密钥
            data: 原始数据
            expected_hmac: 预期的 HMAC 值
            algorithm: 哈希算法

        Returns:
            验证是否通过
        """
        if isinstance(algorithm, str):
            algorithm = HashAlgorithm(algorithm.lower())

        if isinstance(data, str):
            data = data.encode('utf-8')

        algo_name = HashTool._get_hashlib_algorithm(algorithm)
        computed = hmac.new(key, data, algo_name).digest()

        if isinstance(expected_hmac, str):
            expected = bytes.fromhex(expected_hmac)
        else:
            expected = expected_hmac

        return hmac.compare_digest(computed, expected)


class HKDF:
    """HKDF 密钥派生（基于 HMAC 的密钥派生函数）"""

    @staticmethod
    def derive(
        key_material: bytes,
        length: int,
        salt: Optional[bytes] = None,
        info: Optional[bytes] = None,
        algorithm: Union[HashAlgorithm, str] = HashAlgorithm.SHA256
    ) -> bytes:
        """
        派生密钥

        Args:
            key_material: 输入密钥材料
            length: 输出密钥长度
            salt: 可选盐值
            info: 可选上下文信息
            algorithm: 哈希算法

        Returns:
            派生的密钥
        """
        from cryptography.hazmat.primitives.kdf.hkdf import HKDF as CryptoHKDF

        if isinstance(algorithm, str):
            algorithm = HashAlgorithm(algorithm.lower())

        hkdf = CryptoHKDF(
            algorithm=HashTool._get_crypto_hash(algorithm),
            length=length,
            salt=salt,
            info=info,
            backend=default_backend()
        )
        return hkdf.derive(key_material)


def md5(data: Union[str, bytes], output_format: str = "hex") -> Union[str, bytes]:
    """快速计算 MD5"""
    return HashTool.hash(data, HashAlgorithm.MD5, output_format)


def sha1(data: Union[str, bytes], output_format: str = "hex") -> Union[str, bytes]:
    """快速计算 SHA-1"""
    return HashTool.hash(data, HashAlgorithm.SHA1, output_format)


def sha256(data: Union[str, bytes], output_format: str = "hex") -> Union[str, bytes]:
    """快速计算 SHA-256"""
    return HashTool.hash(data, HashAlgorithm.SHA256, output_format)


def sha512(data: Union[str, bytes], output_format: str = "hex") -> Union[str, bytes]:
    """快速计算 SHA-512"""
    return HashTool.hash(data, HashAlgorithm.SHA512, output_format)


def crc32(data: Union[str, bytes]) -> int:
    """快速计算 CRC32"""
    return HashTool.crc(data, CRCType.CRC32)


def hmac_sha256(key: bytes, data: Union[str, bytes], output_format: str = "hex") -> Union[str, bytes]:
    """快速计算 HMAC-SHA256"""
    return HMACTool.hmac(key, data, HashAlgorithm.SHA256, output_format)
