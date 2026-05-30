"""密码学安全随机数生成模块"""

import os
import secrets
import string
from typing import Optional, Union


class RandomGenerator:
    """密码学安全的随机数生成器"""

    def __init__(self, seed: Optional[bytes] = None):
        """
        初始化随机数生成器

        Args:
            seed: 可选的种子值，用于调试复现。如果为 None，则使用系统随机源
        """
        self._seeded = False
        if seed is not None:
            import random
            random.seed(seed)
            self._seeded = True
        self._sys_random = random.Random() if self._seeded else None

    @staticmethod
    def random_bytes(length: int) -> bytes:
        """
        生成指定长度的随机字节序列（密码学安全）

        Args:
            length: 字节长度

        Returns:
            随机字节序列
        """
        return os.urandom(length)

    @staticmethod
    def secure_random_int(min_val: int, max_val: int) -> int:
        """
        生成指定范围内的密码学安全随机整数

        Args:
            min_val: 最小值（包含）
            max_val: 最大值（包含）

        Returns:
            随机整数
        """
        return secrets.randbelow(max_val - min_val + 1) + min_val

    @staticmethod
    def secure_random_choice(sequence):
        """
        从序列中密码学安全地随机选择一个元素

        Args:
            sequence: 可迭代序列

        Returns:
            随机选择的元素
        """
        return secrets.choice(sequence)

    @staticmethod
    def random_string(
        length: int,
        charset: Optional[str] = None,
        include_uppercase: bool = True,
        include_lowercase: bool = True,
        include_digits: bool = True,
        include_punctuation: bool = False,
        custom_chars: Optional[str] = None
    ) -> str:
        """
        生成指定长度的随机字符串（密码学安全）

        Args:
            length: 字符串长度
            charset: 预定义字符集名称，可选值: 'alphanumeric', 'alphabetic', 'numeric', 'hex', 'base64'
            include_uppercase: 是否包含大写字母
            include_lowercase: 是否包含小写字母
            include_digits: 是否包含数字
            include_punctuation: 是否包含标点符号
            custom_chars: 自定义字符集

        Returns:
            随机字符串
        """
        if custom_chars:
            chars = custom_chars
        elif charset:
            charset_map = {
                'alphanumeric': string.ascii_letters + string.digits,
                'alphabetic': string.ascii_letters,
                'numeric': string.digits,
                'hex': string.hexdigits,
                'base64': string.ascii_letters + string.digits + '+/',
                'url_safe': string.ascii_letters + string.digits + '-_',
            }
            chars = charset_map.get(charset, string.ascii_letters + string.digits)
        else:
            chars = ''
            if include_uppercase:
                chars += string.ascii_uppercase
            if include_lowercase:
                chars += string.ascii_lowercase
            if include_digits:
                chars += string.digits
            if include_punctuation:
                chars += string.punctuation
            if not chars:
                chars = string.ascii_letters + string.digits

        return ''.join(secrets.choice(chars) for _ in range(length))

    @staticmethod
    def random_hex(length: int) -> str:
        """
        生成指定长度的随机十六进制字符串

        Args:
            length: 十六进制字符串长度（必须是偶数）

        Returns:
            随机十六进制字符串
        """
        if length % 2 != 0:
            length += 1
        return secrets.token_hex(length // 2)[:length]

    @staticmethod
    def random_urlsafe_token(length: int = 32) -> str:
        """
        生成 URL 安全的随机令牌

        Args:
            length: 令牌长度

        Returns:
            URL 安全的随机令牌
        """
        return secrets.token_urlsafe(length)

    @staticmethod
    def generate_password(
        length: int = 16,
        min_uppercase: int = 1,
        min_lowercase: int = 1,
        min_digits: int = 1,
        min_punctuation: int = 1
    ) -> str:
        """
        生成符合复杂度要求的密码

        Args:
            length: 密码总长度
            min_uppercase: 最少大写字母数量
            min_lowercase: 最少小写字母数量
            min_digits: 最少数字数量
            min_punctuation: 最少标点符号数量

        Returns:
            符合要求的密码
        """
        min_total = min_uppercase + min_lowercase + min_digits + min_punctuation
        if length < min_total:
            raise ValueError(f"密码长度至少需要 {min_total} 个字符")

        password_chars = []

        for _ in range(min_uppercase):
            password_chars.append(secrets.choice(string.ascii_uppercase))
        for _ in range(min_lowercase):
            password_chars.append(secrets.choice(string.ascii_lowercase))
        for _ in range(min_digits):
            password_chars.append(secrets.choice(string.digits))
        for _ in range(min_punctuation):
            password_chars.append(secrets.choice(string.punctuation))

        remaining = length - min_total
        all_chars = string.ascii_letters + string.digits + string.punctuation
        for _ in range(remaining):
            password_chars.append(secrets.choice(all_chars))

        import random
        random.SystemRandom().shuffle(password_chars)
        return ''.join(password_chars)

    @staticmethod
    def generate_salt(length: int = 16) -> bytes:
        """
        生成盐值

        Args:
            length: 盐值长度（字节）

        Returns:
            盐值字节
        """
        return secrets.token_bytes(length)

    @staticmethod
    def generate_nonce(length: int = 12) -> bytes:
        """
        生成 nonce（一次性数值）

        Args:
            length: nonce 长度（字节）

        Returns:
            nonce 字节
        """
        return secrets.token_bytes(length)

    @staticmethod
    def generate_iv(block_size: int = 16) -> bytes:
        """
        生成初始化向量 (IV)

        Args:
            block_size: 块大小（字节），AES 为 16，DES 为 8

        Returns:
            IV 字节
        """
        return secrets.token_bytes(block_size)

    @staticmethod
    def generate_aes_key(key_size: int = 256) -> bytes:
        """
        生成 AES 密钥

        Args:
            key_size: 密钥大小，可选 128, 192, 256 位

        Returns:
            AES 密钥字节
        """
        if key_size not in (128, 192, 256):
            raise ValueError("AES 密钥大小必须是 128, 192 或 256 位")
        return secrets.token_bytes(key_size // 8)

    @staticmethod
    def generate_des_key() -> bytes:
        """
        生成 DES 密钥

        Returns:
            DES 密钥字节（8字节）
        """
        return secrets.token_bytes(8)

    @staticmethod
    def generate_3des_key() -> bytes:
        """
        生成 3DES 密钥

        Returns:
            3DES 密钥字节（24字节）
        """
        return secrets.token_bytes(24)


def random_bytes(length: int) -> bytes:
    return RandomGenerator.random_bytes(length)


def random_string(length: int, **kwargs) -> str:
    return RandomGenerator.random_string(length, **kwargs)


def random_int(min_val: int, max_val: int) -> int:
    return RandomGenerator.secure_random_int(min_val, max_val)


def generate_salt(length: int = 16) -> bytes:
    return RandomGenerator.generate_salt(length)


def generate_iv(block_size: int = 16) -> bytes:
    return RandomGenerator.generate_iv(block_size)


def generate_aes_key(key_size: int = 256) -> bytes:
    return RandomGenerator.generate_aes_key(key_size)


def generate_des_key() -> bytes:
    return RandomGenerator.generate_des_key()


def generate_3des_key() -> bytes:
    return RandomGenerator.generate_3des_key()
