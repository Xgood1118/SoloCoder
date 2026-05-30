"""编码和转换模块"""

import base64
import binascii
import urllib.parse
import html
from enum import Enum
from typing import Optional, Union

try:
    import base58
except ImportError:
    base58 = None

try:
    import base91
except ImportError:
    base91 = None

try:
    import pybase100
except ImportError:
    pybase100 = None


class BaseEncoding(Enum):
    BASE16 = "base16"
    BASE32 = "base32"
    BASE64 = "base64"
    BASE64URL = "base64url"
    BASE58 = "base58"
    BASE58CHECK = "base58check"
    BASE85 = "base85"
    BASE91 = "base91"
    BASE100 = "base100"


class Encoder:
    """编码转换工具类"""

    @staticmethod
    def base_encode(
        data: Union[str, bytes],
        encoding: Union[BaseEncoding, str]
    ) -> str:
        """
        Base 系列编码

        Args:
            data: 待编码数据
            encoding: 编码类型

        Returns:
            编码后的字符串
        """
        if isinstance(encoding, str):
            encoding = BaseEncoding(encoding.lower())

        if isinstance(data, str):
            data = data.encode('utf-8')

        if encoding == BaseEncoding.BASE16:
            return base64.b16encode(data).decode('ascii')
        elif encoding == BaseEncoding.BASE32:
            return base64.b32encode(data).decode('ascii')
        elif encoding == BaseEncoding.BASE64:
            return base64.b64encode(data).decode('ascii')
        elif encoding == BaseEncoding.BASE64URL:
            return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')
        elif encoding == BaseEncoding.BASE58:
            if base58 is None:
                raise ImportError("需要安装 base58 库: pip install base58")
            return base58.b58encode(data).decode('ascii')
        elif encoding == BaseEncoding.BASE58CHECK:
            if base58 is None:
                raise ImportError("需要安装 base58 库: pip install base58")
            return base58.b58encode_check(data).decode('ascii')
        elif encoding == BaseEncoding.BASE85:
            return base64.b85encode(data).decode('ascii')
        elif encoding == BaseEncoding.BASE91:
            if base91 is None:
                raise ImportError("需要安装 base91 库: pip install base91")
            return base91.encode(data)
        elif encoding == BaseEncoding.BASE100:
            if pybase100 is None:
                raise ImportError("需要安装 pybase100 库: pip install pybase100")
            return pybase100.encode(data)
        else:
            raise ValueError(f"不支持的编码: {encoding}")

    @staticmethod
    def base_decode(
        data: str,
        encoding: Union[BaseEncoding, str]
    ) -> bytes:
        """
        Base 系列解码

        Args:
            data: 待解码字符串
            encoding: 编码类型

        Returns:
            解码后的字节
        """
        if isinstance(encoding, str):
            encoding = BaseEncoding(encoding.lower())

        if encoding == BaseEncoding.BASE16:
            return base64.b16decode(data)
        elif encoding == BaseEncoding.BASE32:
            return base64.b32decode(data)
        elif encoding == BaseEncoding.BASE64:
            return base64.b64decode(data)
        elif encoding == BaseEncoding.BASE64URL:
            padding = 4 - len(data) % 4
            if padding != 4:
                data += '=' * padding
            return base64.urlsafe_b64decode(data)
        elif encoding == BaseEncoding.BASE58:
            if base58 is None:
                raise ImportError("需要安装 base58 库: pip install base58")
            return base58.b58decode(data)
        elif encoding == BaseEncoding.BASE58CHECK:
            if base58 is None:
                raise ImportError("需要安装 base58 库: pip install base58")
            return base58.b58decode_check(data)
        elif encoding == BaseEncoding.BASE85:
            return base64.b85decode(data)
        elif encoding == BaseEncoding.BASE91:
            if base91 is None:
                raise ImportError("需要安装 base91 库: pip install base91")
            return base91.decode(data)
        elif encoding == BaseEncoding.BASE100:
            if pybase100 is None:
                raise ImportError("需要安装 pybase100 库: pip install pybase100")
            return pybase100.decode(data)
        else:
            raise ValueError(f"不支持的编码: {encoding}")

    @staticmethod
    def hex_encode(data: Union[str, bytes]) -> str:
        """
        十六进制编码

        Args:
            data: 待编码数据

        Returns:
            十六进制字符串
        """
        if isinstance(data, str):
            data = data.encode('utf-8')
        return binascii.hexlify(data).decode('ascii')

    @staticmethod
    def hex_decode(data: str) -> bytes:
        """
        十六进制解码

        Args:
            data: 十六进制字符串

        Returns:
            解码后的字节
        """
        return binascii.unhexlify(data)

    @staticmethod
    def url_encode(data: str, safe: str = '', encoding: str = 'utf-8') -> str:
        """
        URL 编码

        Args:
            data: 待编码字符串
            safe: 不需要编码的字符
            encoding: 字符编码

        Returns:
            URL 编码后的字符串
        """
        return urllib.parse.quote(data, safe=safe, encoding=encoding)

    @staticmethod
    def url_decode(data: str, encoding: str = 'utf-8') -> str:
        """
        URL 解码

        Args:
            data: URL 编码字符串
            encoding: 字符编码

        Returns:
            解码后的字符串
        """
        return urllib.parse.unquote(data, encoding=encoding)

    @staticmethod
    def url_encode_params(params: dict, doseq: bool = False) -> str:
        """
        URL 参数编码

        Args:
            params: 参数字典
            doseq: 是否序列化序列

        Returns:
            编码后的查询字符串
        """
        return urllib.parse.urlencode(params, doseq=doseq)

    @staticmethod
    def html_encode(data: str) -> str:
        """
        HTML 编码

        Args:
            data: 待编码字符串

        Returns:
            HTML 编码后的字符串
        """
        return html.escape(data)

    @staticmethod
    def html_decode(data: str) -> str:
        """
        HTML 解码

        Args:
            data: HTML 编码字符串

        Returns:
            解码后的字符串
        """
        return html.unescape(data)

    @staticmethod
    def unicode_encode(data: str, escape_all: bool = False) -> str:
        """
        Unicode 编码

        Args:
            data: 待编码字符串
            escape_all: 是否转义所有字符

        Returns:
            Unicode 编码字符串
        """
        if escape_all:
            return ''.join(f'\\u{ord(c):04x}' for c in data)
        else:
            return data.encode('unicode_escape').decode('ascii')

    @staticmethod
    def unicode_decode(data: str) -> str:
        """
        Unicode 解码

        Args:
            data: Unicode 编码字符串

        Returns:
            解码后的字符串
        """
        return data.encode('ascii').decode('unicode_escape')

    @staticmethod
    def ascii85_encode(data: Union[str, bytes]) -> str:
        """
        Ascii85 编码

        Args:
            data: 待编码数据

        Returns:
            编码后的字符串
        """
        if isinstance(data, str):
            data = data.encode('utf-8')
        return base64.a85encode(data).decode('ascii')

    @staticmethod
    def ascii85_decode(data: str) -> bytes:
        """
        Ascii85 解码

        Args:
            data: 编码字符串

        Returns:
            解码后的字节
        """
        return base64.a85decode(data)

    @staticmethod
    def string_to_bytes(data: str, encoding: str = 'utf-8') -> bytes:
        """
        字符串转字节数组

        Args:
            data: 字符串
            encoding: 编码方式

        Returns:
            字节数组
        """
        return data.encode(encoding)

    @staticmethod
    def bytes_to_string(data: bytes, encoding: str = 'utf-8') -> str:
        """
        字节数组转字符串

        Args:
            data: 字节数组
            encoding: 编码方式

        Returns:
            字符串
        """
        return data.decode(encoding)

    @staticmethod
    def string_to_intarray(data: str, encoding: str = 'utf-8') -> list:
        """
        字符串转整数数组

        Args:
            data: 字符串
            encoding: 编码方式

        Returns:
            整数数组（每个字节的 ASCII 值）
        """
        return list(data.encode(encoding))

    @staticmethod
    def intarray_to_string(data: list, encoding: str = 'utf-8') -> str:
        """
        整数数组转字符串

        Args:
            data: 整数数组
            encoding: 编码方式

        Returns:
            字符串
        """
        return bytes(data).decode(encoding)

    @staticmethod
    def bytes_to_intarray(data: bytes) -> list:
        """
        字节数组转整数数组

        Args:
            data: 字节数组

        Returns:
            整数数组
        """
        return list(data)

    @staticmethod
    def intarray_to_bytes(data: list) -> bytes:
        """
        整数数组转字节数组

        Args:
            data: 整数数组

        Returns:
            字节数组
        """
        return bytes(data)

    @staticmethod
    def base64_to_hex(data: str) -> str:
        """
        Base64 转十六进制

        Args:
            data: Base64 字符串

        Returns:
            十六进制字符串
        """
        return Encoder.hex_encode(Encoder.base_decode(data, BaseEncoding.BASE64))

    @staticmethod
    def hex_to_base64(data: str) -> str:
        """
        十六进制转 Base64

        Args:
            data: 十六进制字符串

        Returns:
            Base64 字符串
        """
        return Encoder.base_encode(Encoder.hex_decode(data), BaseEncoding.BASE64)

    @staticmethod
    def detect_encoding(data: str) -> Optional[str]:
        """
        尝试检测编码类型

        Args:
            data: 编码字符串

        Returns:
            检测到的编码类型，如果无法检测则返回 None
        """
        import re

        if re.match(r'^[0-9A-Fa-f]+$', data) and len(data) % 2 == 0:
            return 'hex'
        if re.match(r'^[A-Za-z0-9+/]+={0,2}$', data):
            return 'base64'
        if re.match(r'^[A-Za-z0-9-_]+$', data):
            return 'base64url'
        if re.match(r'^[A-Z2-7]+=*$', data):
            return 'base32'
        if re.match(r'^[1-9A-HJ-NP-Za-km-z]+$', data):
            return 'base58'
        if re.match(r'^[0-9A-Fa-f]+$', data):
            return 'base16'
        if '%' in data and re.search(r'%[0-9A-Fa-f]{2}', data):
            return 'url'
        if '&' in data and '=' in data:
            return 'url_params'
        if '&lt;' in data or '&gt;' in data or '&amp;' in data:
            return 'html'
        if '\\u' in data:
            return 'unicode'

        return None


def to_base64(data: Union[str, bytes]) -> str:
    """快速 Base64 编码"""
    return Encoder.base_encode(data, BaseEncoding.BASE64)


def from_base64(data: str) -> bytes:
    """快速 Base64 解码"""
    return Encoder.base_decode(data, BaseEncoding.BASE64)


def to_hex(data: Union[str, bytes]) -> str:
    """快速十六进制编码"""
    return Encoder.hex_encode(data)


def from_hex(data: str) -> bytes:
    """快速十六进制解码"""
    return Encoder.hex_decode(data)


def url_encode(data: str) -> str:
    """快速 URL 编码"""
    return Encoder.url_encode(data)


def url_decode(data: str) -> str:
    """快速 URL 解码"""
    return Encoder.url_decode(data)


def detect_encoding(data: str) -> Optional[str]:
    """快速编码检测"""
    return Encoder.detect_encoding(data)
