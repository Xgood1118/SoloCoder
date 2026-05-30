"""文件加密模块"""

import os
import struct
import zlib
from pathlib import Path
from typing import Optional, Union, List, Tuple
from enum import Enum

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import hashes, hmac
from cryptography.hazmat.backends import default_backend

try:
    from .cipher import SymmetricCipher, Algorithm, Mode, Padding
    from .crypto_random import generate_salt, generate_iv, generate_aes_key
    from .kdf import KDF
    from .hash import HashTool, HashAlgorithm, HMACTool
except ImportError:
    from cipher import SymmetricCipher, Algorithm, Mode, Padding
    from crypto_random import generate_salt, generate_iv, generate_aes_key
    from kdf import KDF
    from hash import HashTool, HashAlgorithm, HMACTool


_ALGORITHM_KEY_SIZE = {
    Algorithm.AES_128: 16,
    Algorithm.AES_192: 24,
    Algorithm.AES_256: 32,
    Algorithm.DES: 8,
    Algorithm.DES3: 24,
}

_ALGORITHM_ID = {
    Algorithm.AES_128: 1,
    Algorithm.AES_192: 2,
    Algorithm.AES_256: 3,
    Algorithm.DES: 4,
    Algorithm.DES3: 5,
}

_ID_ALGORITHM = {v: k for k, v in _ALGORITHM_ID.items()}

_MODE_ID = {
    Mode.ECB: 1,
    Mode.CBC: 2,
    Mode.CFB: 3,
    Mode.OFB: 4,
    Mode.CTR: 5,
    Mode.GCM: 6,
}

_ID_MODE = {v: k for k, v in _MODE_ID.items()}


class FileEncryptionMode(Enum):
    STREAM = "stream"
    BLOCK = "block"
    AUTHENTICATED = "authenticated"


class FileEncryptor:
    """文件加密器"""

    HEADER_MAGIC = b'CRPT'
    HEADER_VERSION = 1
    SALT_SIZE = 16
    IV_SIZE = 16
    GCM_IV_SIZE = 12
    TAG_SIZE = 16
    HMAC_SIZE = 32
    CHUNK_SIZE = 64 * 1024

    def __init__(
        self,
        algorithm: Union[Algorithm, str] = Algorithm.AES_256,
        mode: Union[Mode, str] = Mode.GCM,
        padding: Union[Padding, str] = Padding.PKCS7,
        kdf_iterations: int = 100000
    ):
        """
        初始化文件加密器

        Args:
            algorithm: 加密算法
            mode: 加密模式
            padding: 填充模式
            kdf_iterations: KDF 迭代次数
        """
        self.algorithm = algorithm if isinstance(algorithm, Algorithm) else Algorithm(algorithm.lower())
        self.mode = mode if isinstance(mode, Mode) else Mode(mode.lower())
        self.padding = padding if isinstance(padding, Padding) else Padding(padding.lower())
        self.kdf_iterations = kdf_iterations

    def _derive_key(self, password: Union[str, bytes], salt: bytes) -> bytes:
        """从密码派生密钥"""
        if isinstance(password, str):
            password = password.encode('utf-8')
        key, _ = KDF.pbkdf2(
            password,
            salt=salt,
            length=_ALGORITHM_KEY_SIZE[self.algorithm],
            iterations=self.kdf_iterations
        )
        return key

    def _build_header(self, salt: bytes, iv: bytes, tag: Optional[bytes] = None) -> bytes:
        """构建文件头"""
        header = self.HEADER_MAGIC
        header += struct.pack('<H', self.HEADER_VERSION)
        header += struct.pack('<H', _ALGORITHM_ID[self.algorithm])
        header += struct.pack('<H', _MODE_ID[self.mode])
        header += struct.pack('<I', self.kdf_iterations)
        header += salt
        header += iv
        if tag:
            header += tag
        return header

    def _parse_header(self, data: bytes) -> dict:
        """解析文件头"""
        offset = 0

        magic = data[offset:offset + 4]
        offset += 4
        if magic != self.HEADER_MAGIC:
            raise ValueError("无效的加密文件格式")

        version = struct.unpack('<H', data[offset:offset + 2])[0]
        offset += 2

        algo_id = struct.unpack('<H', data[offset:offset + 2])[0]
        offset += 2
        algorithm = _ID_ALGORITHM.get(algo_id)
        if not algorithm:
            raise ValueError(f"不支持的算法 ID: {algo_id}")

        mode_id = struct.unpack('<H', data[offset:offset + 2])[0]
        offset += 2
        mode = _ID_MODE.get(mode_id)
        if not mode:
            raise ValueError(f"不支持的模式 ID: {mode_id}")

        iterations = struct.unpack('<I', data[offset:offset + 4])[0]
        offset += 4

        salt = data[offset:offset + self.SALT_SIZE]
        offset += self.SALT_SIZE

        iv_size = self.GCM_IV_SIZE if mode == Mode.GCM else self.IV_SIZE
        iv = data[offset:offset + iv_size]
        offset += iv_size

        return {
            'version': version,
            'algorithm': algorithm,
            'mode': mode,
            'iterations': iterations,
            'salt': salt,
            'iv': iv,
            'tag': None,
            'header_size': offset
        }

    def encrypt_file(
        self,
        input_path: str,
        output_path: str,
        password: Union[str, bytes],
        aad: Optional[bytes] = None
    ) -> Tuple[str, int]:
        """
        加密文件（流式处理，边读边加密边写）

        Args:
            input_path: 输入文件路径
            output_path: 输出文件路径
            password: 密码
            aad: 附加认证数据（仅 GCM 模式）

        Returns:
            (输出文件路径, 加密后文件大小)
        """
        salt = generate_salt(self.SALT_SIZE)

        if self.mode == Mode.GCM:
            iv = generate_iv(self.GCM_IV_SIZE)
        else:
            iv = generate_iv(self.IV_SIZE)

        key = self._derive_key(password, salt)

        if self.mode == Mode.GCM:
            cipher = Cipher(algorithms.AES(key), modes.GCM(iv), backend=default_backend())
        elif self.mode == Mode.CBC:
            cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
        elif self.mode == Mode.CTR:
            cipher = Cipher(algorithms.AES(key), modes.CTR(iv), backend=default_backend())
        else:
            raise ValueError(f"不支持的加密模式: {self.mode}")

        encryptor = cipher.encryptor()
        if self.mode == Mode.GCM and aad:
            encryptor.authenticate_additional_data(aad)

        total_size = 0

        with open(input_path, 'rb') as f_in, open(output_path, 'wb') as f_out:
            header = self._build_header(salt, iv)
            f_out.write(header)
            total_size += len(header)

            while chunk := f_in.read(self.CHUNK_SIZE):
                encrypted = encryptor.update(chunk)
                f_out.write(encrypted)
                total_size += len(encrypted)

            final = encryptor.finalize()
            if final:
                f_out.write(final)
                total_size += len(final)

            if self.mode == Mode.GCM:
                tag = encryptor.tag
                f_out.write(tag)
                total_size += len(tag)

        return output_path, total_size

    def decrypt_file(
        self,
        input_path: str,
        output_path: str,
        password: Union[str, bytes],
        aad: Optional[bytes] = None
    ) -> Tuple[str, int]:
        """
        解密文件（流式处理）

        Args:
            input_path: 输入文件路径
            output_path: 输出文件路径
            password: 密码
            aad: 附加认证数据（仅 GCM 模式）

        Returns:
            (输出文件路径, 解密后文件大小)
        """
        file_size = os.path.getsize(input_path)
        min_header_size = 4 + 2 + 2 + 2 + 4 + self.SALT_SIZE + self.GCM_IV_SIZE

        with open(input_path, 'rb') as f_in:
            header_data = f_in.read(max(min_header_size, file_size))
            header = self._parse_header(header_data)

            self.algorithm = header['algorithm']
            self.mode = header['mode']
            self.kdf_iterations = header['iterations']

            key = self._derive_key(password, header['salt'])
            iv = header['iv']
            tag = None

            ciphertext_size = file_size - header['header_size']
            if self.mode == Mode.GCM:
                tag_offset = file_size - self.TAG_SIZE
                f_in.seek(tag_offset)
                tag = f_in.read(self.TAG_SIZE)
                ciphertext_size = tag_offset - header['header_size']

            f_in.seek(header['header_size'])

            if self.mode == Mode.GCM:
                cipher = Cipher(algorithms.AES(key), modes.GCM(iv, tag), backend=default_backend())
            elif self.mode == Mode.CBC:
                cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
            elif self.mode == Mode.CTR:
                cipher = Cipher(algorithms.AES(key), modes.CTR(iv), backend=default_backend())
            else:
                raise ValueError(f"不支持的加密模式: {self.mode}")

            decryptor = cipher.decryptor()
            if self.mode == Mode.GCM and aad:
                decryptor.authenticate_additional_data(aad)

            total_size = 0
            bytes_read = 0

            with open(output_path, 'wb') as f_out:
                while bytes_read < ciphertext_size:
                    to_read = min(self.CHUNK_SIZE, ciphertext_size - bytes_read)
                    chunk = f_in.read(to_read)
                    if not chunk:
                        break
                    decrypted = decryptor.update(chunk)
                    f_out.write(decrypted)
                    total_size += len(decrypted)
                    bytes_read += len(chunk)

                try:
                    final = decryptor.finalize()
                    if final:
                        f_out.write(final)
                        total_size += len(final)
                except Exception as e:
                    raise ValueError(f"解密失败，密码错误或数据被篡改: {e}")

        return output_path, total_size

    def encrypt_archive(
        self,
        archive_path: str,
        output_path: str,
        password: Union[str, bytes],
        keep_original: bool = True
    ) -> Tuple[str, int]:
        """
        加密压缩包，保持压缩包格式不解压

        Args:
            archive_path: 压缩包路径
            output_path: 输出文件路径
            password: 密码
            keep_original: 是否保留原文件

        Returns:
            (输出文件路径, 加密后文件大小)
        """
        output_path, file_size = self.encrypt_file(archive_path, output_path, password)

        if not keep_original:
            os.remove(archive_path)

        return output_path, file_size

    def decrypt_archive(
        self,
        encrypted_path: str,
        output_path: str,
        password: Union[str, bytes],
        keep_encrypted: bool = True
    ) -> Tuple[str, int]:
        """
        解密压缩包

        Args:
            encrypted_path: 加密文件路径
            output_path: 输出压缩包路径
            password: 密码
            keep_encrypted: 是否保留加密文件

        Returns:
            (输出文件路径, 解密后文件大小)
        """
        output_path, file_size = self.decrypt_file(encrypted_path, output_path, password)

        if not keep_encrypted:
            os.remove(encrypted_path)

        return output_path, file_size

    def encrypt_directory(
        self,
        dir_path: str,
        output_dir: str,
        password: Union[str, bytes],
        recursive: bool = True,
        encrypted_suffix: str = ".enc"
    ) -> Tuple[int, List[str]]:
        """
        文件夹批量加密

        Args:
            dir_path: 输入文件夹路径
            output_dir: 输出文件夹路径
            password: 密码
            recursive: 是否递归处理子文件夹
            encrypted_suffix: 加密文件后缀

        Returns:
            (加密文件数量, 加密文件路径列表)
        """
        input_path = Path(dir_path)
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        count = 0
        encrypted_files = []

        pattern = '**/*' if recursive else '*'

        for item in input_path.glob(pattern):
            if item.is_file():
                relative_path = item.relative_to(input_path)
                encrypted_file_path = output_path / (str(relative_path) + encrypted_suffix)
                encrypted_file_path.parent.mkdir(parents=True, exist_ok=True)

                try:
                    self.encrypt_file(str(item), str(encrypted_file_path), password)
                    encrypted_files.append(str(encrypted_file_path))
                    count += 1
                except Exception as e:
                    print(f"加密文件 {item} 失败: {e}")

        return count, encrypted_files

    def decrypt_directory(
        self,
        dir_path: str,
        output_dir: str,
        password: Union[str, bytes],
        recursive: bool = True,
        encrypted_suffix: str = ".enc"
    ) -> Tuple[int, List[str]]:
        """
        文件夹批量解密

        Args:
            dir_path: 输入加密文件夹路径
            output_dir: 输出文件夹路径
            password: 密码
            recursive: 是否递归处理子文件夹
            encrypted_suffix: 加密文件后缀

        Returns:
            (解密文件数量, 解密文件路径列表)
        """
        input_path = Path(dir_path)
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        count = 0
        decrypted_files = []

        pattern = '**/*' if recursive else '*'

        for item in input_path.glob(pattern):
            if item.is_file() and item.suffix == encrypted_suffix:
                relative_path = item.relative_to(input_path)
                decrypted_filename = relative_path.stem
                decrypted_file_path = output_path / relative_path.with_name(decrypted_filename)
                decrypted_file_path.parent.mkdir(parents=True, exist_ok=True)

                try:
                    self.decrypt_file(str(item), str(decrypted_file_path), password)
                    decrypted_files.append(str(decrypted_file_path))
                    count += 1
                except Exception as e:
                    print(f"解密文件 {item} 失败: {e}")

        return count, decrypted_files


class FileIntegrityChecker:
    """文件完整性检查器"""

    @staticmethod
    def generate_hash(
        file_path: str,
        algorithm: Union[HashAlgorithm, str] = HashAlgorithm.SHA256
    ) -> str:
        """
        生成文件哈希

        Args:
            file_path: 文件路径
            algorithm: 哈希算法

        Returns:
            哈希值（十六进制）
        """
        return HashTool.hash_file(file_path, algorithm)

    @staticmethod
    def verify_hash(
        file_path: str,
        expected_hash: str,
        algorithm: Union[HashAlgorithm, str] = HashAlgorithm.SHA256
    ) -> bool:
        """
        验证文件哈希

        Args:
            file_path: 文件路径
            expected_hash: 预期哈希值
            algorithm: 哈希算法

        Returns:
            验证是否通过
        """
        actual_hash = HashTool.hash_file(file_path, algorithm)
        return actual_hash.lower() == expected_hash.lower()

    @staticmethod
    def generate_hmac(
        file_path: str,
        key: bytes,
        algorithm: Union[HashAlgorithm, str] = HashAlgorithm.SHA256
    ) -> str:
        """
        生成文件 HMAC

        Args:
            file_path: 文件路径
            key: 密钥
            algorithm: 哈希算法

        Returns:
            HMAC 值（十六进制）
        """
        return HMACTool.hmac_file(key, file_path, algorithm)

    @staticmethod
    def verify_hmac(
        file_path: str,
        key: bytes,
        expected_hmac: str,
        algorithm: Union[HashAlgorithm, str] = HashAlgorithm.SHA256
    ) -> bool:
        """
        验证文件 HMAC

        Args:
            file_path: 文件路径
            key: 密钥
            expected_hmac: 预期 HMAC 值
            algorithm: 哈希算法

        Returns:
            验证是否通过
        """
        actual_hmac = HMACTool.hmac_file(key, file_path, algorithm)
        if isinstance(expected_hmac, bytes):
            expected_hmac = expected_hmac.hex()
        return actual_hmac.lower() == expected_hmac.lower()

    @staticmethod
    def generate_checksum_file(
        file_path: str,
        output_path: Optional[str] = None,
        algorithm: Union[HashAlgorithm, str] = HashAlgorithm.SHA256
    ) -> str:
        """
        生成校验和文件

        Args:
            file_path: 文件路径
            output_path: 输出校验和文件路径
            algorithm: 哈希算法

        Returns:
            校验和文件路径
        """
        if output_path is None:
            output_path = file_path + f".{algorithm.value}"

        hash_value = HashTool.hash_file(file_path, algorithm)
        filename = os.path.basename(file_path)

        with open(output_path, 'w') as f:
            f.write(f"{hash_value}  {filename}\n")

        return output_path


def encrypt_file(input_path: str, output_path: str, password: Union[str, bytes], **kwargs) -> Tuple[str, int]:
    """快速文件加密"""
    encryptor = FileEncryptor(**kwargs)
    return encryptor.encrypt_file(input_path, output_path, password)


def decrypt_file(input_path: str, output_path: str, password: Union[str, bytes], **kwargs) -> Tuple[str, int]:
    """快速文件解密"""
    encryptor = FileEncryptor(**kwargs)
    return encryptor.decrypt_file(input_path, output_path, password)


def encrypt_directory(input_dir: str, output_dir: str, password: Union[str, bytes], **kwargs) -> Tuple[int, List[str]]:
    """快速文件夹加密"""
    encryptor = FileEncryptor(**kwargs)
    return encryptor.encrypt_directory(input_dir, output_dir, password)


def decrypt_directory(input_dir: str, output_dir: str, password: Union[str, bytes], **kwargs) -> Tuple[int, List[str]]:
    """快速文件夹解密"""
    encryptor = FileEncryptor(**kwargs)
    return encryptor.decrypt_directory(input_dir, output_dir, password)
