"""密钥派生模块"""

import hashlib
import os
from enum import Enum
from typing import Optional, Tuple, Union

from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend

try:
    import bcrypt
except ImportError:
    bcrypt = None

try:
    from argon2 import PasswordHasher as Argon2PasswordHasher
    from argon2 import Type as Argon2Type
except ImportError:
    Argon2PasswordHasher = None
    Argon2Type = None

try:
    from .crypto_random import generate_salt
    from .hash import HashTool, HashAlgorithm
except ImportError:
    from crypto_random import generate_salt
    from hash import HashTool, HashAlgorithm


class KDFAlgorithm(Enum):
    PBKDF2 = "pbkdf2"
    BCRYPT = "bcrypt"
    SCRYPT = "scrypt"
    ARGON2 = "argon2"


class KDF:
    """密钥派生工具类"""

    @staticmethod
    def pbkdf2(
        password: Union[str, bytes],
        salt: Optional[bytes] = None,
        length: int = 32,
        iterations: int = 100000,
        algorithm: Union[HashAlgorithm, str] = HashAlgorithm.SHA256
    ) -> Tuple[bytes, bytes]:
        """
        PBKDF2 密钥派生

        Args:
            password: 密码
            salt: 盐值，如未提供则自动生成
            length: 派生密钥长度
            iterations: 迭代次数
            algorithm: 哈希算法

        Returns:
            (派生密钥, 盐值)
        """
        if isinstance(password, str):
            password = password.encode('utf-8')

        if salt is None:
            salt = generate_salt(16)

        if isinstance(algorithm, str):
            algorithm = HashAlgorithm(algorithm.lower())

        kdf = PBKDF2HMAC(
            algorithm=HashTool._get_crypto_hash(algorithm),
            length=length,
            salt=salt,
            iterations=iterations,
            backend=default_backend()
        )
        key = kdf.derive(password)
        return key, salt

    @staticmethod
    def bcrypt_hash(
        password: Union[str, bytes],
        salt: Optional[bytes] = None,
        rounds: int = 12
    ) -> bytes:
        """
        bcrypt 哈希

        Args:
            password: 密码
            salt: 可选盐值
            rounds: 轮数（4-31）

        Returns:
            哈希值（包含盐值）
        """
        if bcrypt is None:
            raise ImportError("需要安装 bcrypt 库: pip install bcrypt")

        if isinstance(password, str):
            password = password.encode('utf-8')

        if salt is None:
            salt = bcrypt.gensalt(rounds=rounds)

        return bcrypt.hashpw(password, salt)

    @staticmethod
    def bcrypt_verify(password: Union[str, bytes], hashed: bytes) -> bool:
        """
        bcrypt 验证

        Args:
            password: 密码
            hashed: 哈希值

        Returns:
            验证是否通过
        """
        if bcrypt is None:
            raise ImportError("需要安装 bcrypt 库: pip install bcrypt")

        if isinstance(password, str):
            password = password.encode('utf-8')

        return bcrypt.checkpw(password, hashed)

    @staticmethod
    def scrypt(
        password: Union[str, bytes],
        salt: Optional[bytes] = None,
        length: int = 32,
        n: int = 16384,
        r: int = 8,
        p: int = 1,
        maxmem: int = 0
    ) -> Tuple[bytes, bytes]:
        """
        scrypt 密钥派生

        Args:
            password: 密码
            salt: 盐值，如未提供则自动生成
            length: 派生密钥长度
            n: CPU/内存成本参数
            r: 块大小
            p: 并行化参数
            maxmem: 最大内存使用

        Returns:
            (派生密钥, 盐值)
        """
        if isinstance(password, str):
            password = password.encode('utf-8')

        if salt is None:
            salt = generate_salt(16)

        try:
            kdf = Scrypt(
                salt=salt,
                length=length,
                n=n,
                r=r,
                p=p,
                backend=default_backend()
            )
            key = kdf.derive(password)
        except Exception:
            key = hashlib.scrypt(
                password,
                salt=salt,
                n=n,
                r=r,
                p=p,
                dklen=length,
                maxmem=maxmem
            )

        return key, salt

    @staticmethod
    def argon2_hash(
        password: str,
        time_cost: int = 3,
        memory_cost: int = 65536,
        parallelism: int = 4,
        hash_len: int = 32,
        salt_len: int = 16
    ) -> str:
        """
        Argon2 哈希

        Args:
            password: 密码
            time_cost: 时间成本
            memory_cost: 内存成本（KB）
            parallelism: 并行度
            hash_len: 哈希长度
            salt_len: 盐值长度

        Returns:
            哈希字符串（包含所有参数）
        """
        if Argon2PasswordHasher is None:
            raise ImportError("需要安装 argon2-cffi 库: pip install argon2-cffi")

        hasher = Argon2PasswordHasher(
            time_cost=time_cost,
            memory_cost=memory_cost,
            parallelism=parallelism,
            hash_len=hash_len,
            salt_len=salt_len,
            type=Argon2Type.ID if Argon2Type else None
        )
        return hasher.hash(password)

    @staticmethod
    def argon2_verify(password: str, hashed: str) -> bool:
        """
        Argon2 验证

        Args:
            password: 密码
            hashed: 哈希字符串

        Returns:
            验证是否通过
        """
        if Argon2PasswordHasher is None:
            raise ImportError("需要安装 argon2-cffi 库: pip install argon2-cffi")

        hasher = Argon2PasswordHasher()
        try:
            return hasher.verify(hashed, password)
        except Exception:
            return False

    @staticmethod
    def derive_key(
        master_key: bytes,
        purpose: str,
        length: int = 32,
        salt: Optional[bytes] = None,
        context: Optional[bytes] = None
    ) -> bytes:
        """
        从主密钥派生子密钥（分层密钥管理）

        Args:
            master_key: 主密钥
            purpose: 子密钥用途标识
            length: 子密钥长度
            salt: 可选盐值
            context: 可选上下文信息

        Returns:
            派生的子密钥
        """
        from cryptography.hazmat.primitives.kdf.hkdf import HKDF

        if salt is None:
            salt = hashlib.sha256(purpose.encode('utf-8')).digest()

        info = context or b''
        info += purpose.encode('utf-8')

        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=length,
            salt=salt,
            info=info,
            backend=default_backend()
        )
        return hkdf.derive(master_key)

    @staticmethod
    def derive_hierarchy(
        master_key: bytes,
        levels: list,
        length_per_level: int = 32
    ) -> dict:
        """
        分层密钥派生

        Args:
            master_key: 主密钥
            levels: 层级列表，每个元素为层级名称
            length_per_level: 每个层级的密钥长度

        Returns:
            层级密钥字典 {level_name: key}
        """
        keys = {}
        current_key = master_key

        for level in levels:
            child_key = KDF.derive_key(
                current_key,
                purpose=level,
                length=length_per_level
            )
            keys[level] = child_key
            current_key = child_key

        return keys

    @staticmethod
    def password_to_key(
        password: Union[str, bytes],
        algorithm: Union[KDFAlgorithm, str] = KDFAlgorithm.PBKDF2,
        **kwargs
    ) -> Tuple[bytes, bytes]:
        """
        从密码派生密钥（统一接口）

        Args:
            password: 密码
            algorithm: 密钥派生算法
            **kwargs: 算法特定参数

        Returns:
            (派生密钥, 盐值)
        """
        if isinstance(algorithm, str):
            algorithm = KDFAlgorithm(algorithm.lower())

        if algorithm == KDFAlgorithm.PBKDF2:
            return KDF.pbkdf2(password, **kwargs)
        elif algorithm == KDFAlgorithm.SCRYPT:
            return KDF.scrypt(password, **kwargs)
        elif algorithm == KDFAlgorithm.BCRYPT:
            hashed = KDF.bcrypt_hash(password, **kwargs)
            salt = hashed[:29]
            key = hashlib.sha256(hashed).digest()[:kwargs.get('length', 32)]
            return key, salt
        elif algorithm == KDFAlgorithm.ARGON2:
            hashed = KDF.argon2_hash(password if isinstance(password, str) else password.decode('utf-8'), **kwargs)
            salt = hashed.encode('utf-8')
            key = hashlib.sha256(hashed.encode('utf-8')).digest()[:kwargs.get('length', 32)]
            return key, salt
        else:
            raise ValueError(f"不支持的 KDF 算法: {algorithm}")


class MasterKeyManager:
    """主密钥管理器（分层密钥管理）"""

    def __init__(self, master_key: Optional[bytes] = None):
        """
        初始化主密钥管理器

        Args:
            master_key: 主密钥，如未提供则自动生成
        """
        if master_key is None:
            master_key = generate_salt(32)
        self._master_key = master_key
        self._derived_keys = {}

    def get_key(self, purpose: str, length: int = 32) -> bytes:
        """
        获取指定用途的子密钥

        Args:
            purpose: 密钥用途
            length: 密钥长度

        Returns:
            子密钥
        """
        key_id = f"{purpose}_{length}"
        if key_id not in self._derived_keys:
            self._derived_keys[key_id] = KDF.derive_key(
                self._master_key,
                purpose=purpose,
                length=length
            )
        return self._derived_keys[key_id]

    def rotate_master_key(self, new_master_key: Optional[bytes] = None):
        """
        轮换主密钥

        Args:
            new_master_key: 新主密钥，如未提供则自动生成
        """
        if new_master_key is None:
            new_master_key = generate_salt(32)
        self._master_key = new_master_key
        self._derived_keys.clear()

    def export_master_key(self) -> bytes:
        """导出主密钥"""
        return self._master_key

    def import_master_key(self, master_key: bytes):
        """导入主密钥"""
        self._master_key = master_key
        self._derived_keys.clear()


def pbkdf2_hash(password: Union[str, bytes], **kwargs) -> Tuple[bytes, bytes]:
    """快速 PBKDF2 哈希"""
    return KDF.pbkdf2(password, **kwargs)


def bcrypt_hash(password: Union[str, bytes], **kwargs) -> bytes:
    """快速 bcrypt 哈希"""
    return KDF.bcrypt_hash(password, **kwargs)


def scrypt_hash(password: Union[str, bytes], **kwargs) -> Tuple[bytes, bytes]:
    """快速 scrypt 哈希"""
    return KDF.scrypt(password, **kwargs)


def argon2_hash(password: str, **kwargs) -> str:
    """快速 Argon2 哈希"""
    return KDF.argon2_hash(password, **kwargs)
