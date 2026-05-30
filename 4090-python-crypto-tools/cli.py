"""命令行交互模块"""

import os
import sys
import click
from typing import Optional

try:
    from . import __version__
    from .cipher import SymmetricCipher, RSACipher, ECCipher, Algorithm, Mode, Padding, CurveType, KeyFormat
    from .hash import HashTool, HMACTool, HashAlgorithm, CRCType
    from encode import Encoder, BaseEncoding
    from .filecrypt import FileEncryptor, FileIntegrityChecker
    from .kdf import KDF, KDFAlgorithm, MasterKeyManager
    from .sign import Signer, CertificateManager, SignatureAlgorithm
    from .crypto_random import RandomGenerator
except ImportError:
    __version__ = "1.0.0"
    from cipher import SymmetricCipher, RSACipher, ECCipher, Algorithm, Mode, Padding, CurveType, KeyFormat
    from hash import HashTool, HMACTool, HashAlgorithm, CRCType
    from encode import Encoder, BaseEncoding
    from filecrypt import FileEncryptor, FileIntegrityChecker
    from kdf import KDF, KDFAlgorithm, MasterKeyManager
    from sign import Signer, CertificateManager, SignatureAlgorithm
    from crypto_random import RandomGenerator


@click.group()
@click.version_option(version=__version__, prog_name='crypto-tools')
@click.help_option('-h', '--help')
def cli():
    """统一的加密工具集 - 提供对称加密、非对称加密、哈希、编码、文件加密等功能"""
    pass


@cli.group()
def cipher():
    """对称加密和非对称加密"""
    pass


@cipher.command('encrypt')
@click.option('--algorithm', '-a', default='aes-256', help='加密算法: aes-128, aes-192, aes-256, des, 3des')
@click.option('--mode', '-m', default='cbc', help='加密模式: ecb, cbc, cfb, ofb, ctr, gcm')
@click.option('--padding', '-p', default='pkcs7', help='填充模式: pkcs7, pkcs5, zero, none')
@click.option('--key', '-k', help='加密密钥（十六进制），如未提供则自动生成')
@click.option('--iv', help='初始化向量（十六进制），如未提供则自动生成')
@click.option('--output-format', default='hex', help='输出格式: hex, base64, bytes')
@click.argument('plaintext')
def cipher_encrypt(algorithm, mode, padding, key, iv, output_format, plaintext):
    """对称加密"""
    try:
        key_bytes = bytes.fromhex(key) if key else None
        iv_bytes = bytes.fromhex(iv) if iv else None

        enc = SymmetricCipher(
            algorithm=algorithm,
            mode=mode,
            padding=padding,
            key=key_bytes,
            iv=iv_bytes
        )

        ciphertext = enc.encrypt(plaintext)

        click.echo(f"算法: {algorithm.upper()} {mode.upper()}")
        if key is None:
            click.echo(f"密钥: {enc.key.hex()}")
        if enc.iv:
            click.echo(f"IV: {enc.iv.hex()}")
        if enc.tag:
            click.echo(f"Tag: {enc.tag.hex()}")

        if output_format == 'hex':
            click.echo(f"密文: {ciphertext.hex()}")
        elif output_format == 'base64':
            from encode import Encoder, BaseEncoding
            click.echo(f"密文: {Encoder.base_encode(ciphertext, BaseEncoding.BASE64)}")
        else:
            sys.stdout.buffer.write(ciphertext)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@cipher.command('decrypt')
@click.option('--algorithm', '-a', default='aes-256', help='加密算法')
@click.option('--mode', '-m', default='cbc', help='加密模式')
@click.option('--padding', '-p', default='pkcs7', help='填充模式')
@click.option('--key', '-k', required=True, help='解密密钥（十六进制）')
@click.option('--iv', help='初始化向量（十六进制），密文中已包含则可不填')
@click.option('--input-format', default='hex', help='输入格式: hex, base64')
@click.option('--output-format', default='text', help='输出格式: text, hex')
@click.argument('ciphertext')
def cipher_decrypt(algorithm, mode, padding, key, iv, input_format, output_format, ciphertext):
    """对称解密"""
    try:
        key_bytes = bytes.fromhex(key)
        iv_bytes = bytes.fromhex(iv) if iv else None

        if input_format == 'hex':
            ciphertext_bytes = bytes.fromhex(ciphertext)
        elif input_format == 'base64':
            from encode import Encoder, BaseEncoding
            ciphertext_bytes = Encoder.base_decode(ciphertext, BaseEncoding.BASE64)
        else:
            ciphertext_bytes = ciphertext.encode('utf-8')

        enc = SymmetricCipher(
            algorithm=algorithm,
            mode=mode,
            padding=padding,
            key=key_bytes,
            iv=iv_bytes
        )

        plaintext = enc.decrypt(ciphertext_bytes)

        if output_format == 'text':
            try:
                click.echo(f"明文: {plaintext.decode('utf-8')}")
            except UnicodeDecodeError:
                click.echo(f"明文: {plaintext.hex()}")
        else:
            click.echo(f"明文: {plaintext.hex()}")
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@cipher.group()
def rsa():
    """RSA 非对称加密"""
    pass


@rsa.command('genkey')
@click.option('--key-size', '-s', default=2048, type=click.Choice([1024, 2048, 3072, 4096]), help='密钥大小')
@click.option('--output-priv', default='private_key.pem', help='私钥输出文件')
@click.option('--output-pub', default='public_key.pem', help='公钥输出文件')
@click.option('--password', help='私钥加密密码')
@click.option('--format', 'fmt', default='pem', help='输出格式: pem, der, pkcs8')
def rsa_genkey(key_size, output_priv, output_pub, password, fmt):
    """生成 RSA 密钥对"""
    try:
        rsa_cipher = RSACipher(key_size=key_size)
        rsa_cipher.generate_keys()

        password_bytes = password.encode('utf-8') if password else None
        key_format = KeyFormat(fmt)

        priv_data = rsa_cipher.serialize_private_key(format=key_format, password=password_bytes)
        pub_data = rsa_cipher.serialize_public_key(format=key_format)

        with open(output_priv, 'wb') as f:
            f.write(priv_data)
        with open(output_pub, 'wb') as f:
            f.write(pub_data)

        click.echo(f"私钥已保存到: {output_priv}")
        click.echo(f"公钥已保存到: {output_pub}")
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@rsa.command('encrypt')
@click.option('--pubkey', required=True, help='公钥文件路径')
@click.option('--output-format', default='base64', help='输出格式: hex, base64')
@click.argument('plaintext')
def rsa_encrypt(pubkey, output_format, plaintext):
    """RSA 加密"""
    try:
        with open(pubkey, 'rb') as f:
            pubkey_data = f.read()

        rsa_cipher = RSACipher()
        rsa_cipher.load_public_key(pubkey_data)

        ciphertext = rsa_cipher.encrypt(plaintext)

        if output_format == 'hex':
            click.echo(ciphertext.hex())
        else:
            from encode import Encoder, BaseEncoding
            click.echo(Encoder.base_encode(ciphertext, BaseEncoding.BASE64))
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@rsa.command('decrypt')
@click.option('--privkey', required=True, help='私钥文件路径')
@click.option('--password', help='私钥加密密码')
@click.option('--input-format', default='base64', help='输入格式: hex, base64')
@click.argument('ciphertext')
def rsa_decrypt(privkey, password, input_format, ciphertext):
    """RSA 解密"""
    try:
        with open(privkey, 'rb') as f:
            privkey_data = f.read()

        password_bytes = password.encode('utf-8') if password else None

        rsa_cipher = RSACipher()
        rsa_cipher.load_private_key(privkey_data, password=password_bytes)

        if input_format == 'hex':
            ciphertext_bytes = bytes.fromhex(ciphertext)
        else:
            from encode import Encoder, BaseEncoding
            ciphertext_bytes = Encoder.base_decode(ciphertext, BaseEncoding.BASE64)

        plaintext = rsa_cipher.decrypt(ciphertext_bytes)

        try:
            click.echo(plaintext.decode('utf-8'))
        except UnicodeDecodeError:
            click.echo(plaintext.hex())
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@cipher.group()
def ecc():
    """椭圆曲线加密"""
    pass


@ecc.command('genkey')
@click.option('--curve', '-c', default='secp256r1', help='曲线类型: secp256k1, secp256r1, secp384r1, secp521r1')
@click.option('--output-priv', default='ecc_private.pem', help='私钥输出文件')
@click.option('--output-pub', default='ecc_public.pem', help='公钥输出文件')
def ecc_genkey(curve, output_priv, output_pub):
    """生成 ECC 密钥对"""
    try:
        ecc_cipher = ECCipher(curve=curve)
        ecc_cipher.generate_keys()

        priv_data = ecc_cipher.serialize_private_key()
        pub_data = ecc_cipher.serialize_public_key()

        with open(output_priv, 'wb') as f:
            f.write(priv_data)
        with open(output_pub, 'wb') as f:
            f.write(pub_data)

        click.echo(f"私钥已保存到: {output_priv}")
        click.echo(f"公钥已保存到: {output_pub}")
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@cli.group()
def hash():
    """哈希和 HMAC"""
    pass


@hash.command()
@click.option('--algorithm', '-a', default='sha256', help='哈希算法: md5, sha1, sha224, sha256, sha384, sha512, sha3-256, blake2b')
@click.option('--output-format', default='hex', help='输出格式: hex, base64')
@click.argument('data', required=False)
@click.option('--file', '-f', 'file_path', help='计算文件哈希')
def hash_cmd(algorithm, output_format, data, file_path):
    """计算哈希值"""
    try:
        if file_path:
            result = HashTool.hash_file(file_path, algorithm, output_format='bytes')
        elif data:
            result = HashTool.hash(data, algorithm, output_format='bytes')
        else:
            click.echo("请提供数据或文件路径", err=True)
            sys.exit(1)

        if output_format == 'hex':
            click.echo(result.hex())
        else:
            from encode import Encoder, BaseEncoding
            click.echo(Encoder.base_encode(result, BaseEncoding.BASE64))
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@hash.command()
@click.option('--algorithm', '-a', default='sha256', help='哈希算法')
@click.option('--key', '-k', required=True, help='密钥（十六进制）')
@click.option('--output-format', default='hex', help='输出格式: hex, base64')
@click.argument('data', required=False)
@click.option('--file', '-f', 'file_path', help='计算文件 HMAC')
def hmac(algorithm, key, output_format, data, file_path):
    """计算 HMAC"""
    try:
        key_bytes = bytes.fromhex(key)

        if file_path:
            result = HMACTool.hmac_file(key_bytes, file_path, algorithm, output_format='bytes')
        elif data:
            result = HMACTool.hmac(key_bytes, data, algorithm, output_format='bytes')
        else:
            click.echo("请提供数据或文件路径", err=True)
            sys.exit(1)

        if output_format == 'hex':
            click.echo(result.hex())
        else:
            from encode import Encoder, BaseEncoding
            click.echo(Encoder.base_encode(result, BaseEncoding.BASE64))
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@hash.command()
@click.option('--type', '-t', default='crc32', help='CRC 类型: crc8, crc16, crc32, crc64')
@click.argument('data')
def crc(type, data):
    """计算 CRC 校验值"""
    try:
        result = HashTool.crc(data, type)
        click.echo(f"{result} (0x{result:08x})")
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@cli.group()
def encode():
    """编码转换"""
    pass


@encode.command()
@click.option('--type', '-t', default='base64', help='编码类型: base16, base32, base64, base64url, base58, hex, url, html, unicode')
@click.argument('data')
def enc(type, data):
    """编码"""
    try:
        if type in ['base16', 'base32', 'base64', 'base64url', 'base58', 'base58check', 'base85']:
            result = Encoder.base_encode(data, BaseEncoding(type))
        elif type == 'hex':
            result = Encoder.hex_encode(data)
        elif type == 'url':
            result = Encoder.url_encode(data)
        elif type == 'html':
            result = Encoder.html_encode(data)
        elif type == 'unicode':
            result = Encoder.unicode_encode(data)
        else:
            click.echo(f"不支持的编码类型: {type}", err=True)
            sys.exit(1)

        click.echo(result)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@encode.command()
@click.option('--type', '-t', default='base64', help='编码类型')
@click.argument('data')
def dec(type, data):
    """解码"""
    try:
        if type in ['base16', 'base32', 'base64', 'base64url', 'base58', 'base58check', 'base85']:
            result = Encoder.base_decode(data, BaseEncoding(type))
            try:
                click.echo(result.decode('utf-8'))
            except UnicodeDecodeError:
                click.echo(result.hex())
        elif type == 'hex':
            result = Encoder.hex_decode(data)
            try:
                click.echo(result.decode('utf-8'))
            except UnicodeDecodeError:
                click.echo(result.hex())
        elif type == 'url':
            result = Encoder.url_decode(data)
            click.echo(result)
        elif type == 'html':
            result = Encoder.html_decode(data)
            click.echo(result)
        elif type == 'unicode':
            result = Encoder.unicode_decode(data)
            click.echo(result)
        else:
            click.echo(f"不支持的编码类型: {type}", err=True)
            sys.exit(1)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@encode.command()
@click.argument('data')
def detect(data):
    """检测编码类型"""
    result = Encoder.detect_encoding(data)
    if result:
        click.echo(f"检测到的编码: {result}")
    else:
        click.echo("无法检测编码类型")


@cli.group()
def file():
    """文件加密"""
    pass


@file.command('encrypt')
@click.option('--input', '-i', required=True, help='输入文件路径')
@click.option('--output', '-o', required=True, help='输出文件路径')
@click.option('--password', '-p', required=True, help='加密密码')
@click.option('--algorithm', '-a', default='aes-256', help='加密算法')
@click.option('--mode', '-m', default='gcm', help='加密模式')
def file_encrypt(input, output, password, algorithm, mode):
    """加密文件"""
    try:
        encryptor = FileEncryptor(algorithm=algorithm, mode=mode)
        output_path, size = encryptor.encrypt_file(input, output, password)
        click.echo(f"文件已加密: {output_path} ({size} 字节)")
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@file.command('decrypt')
@click.option('--input', '-i', required=True, help='输入文件路径')
@click.option('--output', '-o', required=True, help='输出文件路径')
@click.option('--password', '-p', required=True, help='解密密码')
def file_decrypt(input, output, password):
    """解密文件"""
    try:
        encryptor = FileEncryptor()
        output_path, size = encryptor.decrypt_file(input, output, password)
        click.echo(f"文件已解密: {output_path} ({size} 字节)")
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@file.command('encrypt-dir')
@click.option('--input', '-i', required=True, help='输入文件夹路径')
@click.option('--output', '-o', required=True, help='输出文件夹路径')
@click.option('--password', '-p', required=True, help='加密密码')
@click.option('--recursive/--no-recursive', default=True, help='是否递归处理子文件夹')
def file_encrypt_dir(input, output, password, recursive):
    """批量加密文件夹"""
    try:
        encryptor = FileEncryptor()
        count, files = encryptor.encrypt_directory(input, output, password, recursive=recursive)
        click.echo(f"已加密 {count} 个文件")
        for f in files:
            click.echo(f"  - {f}")
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@file.command('decrypt-dir')
@click.option('--input', '-i', required=True, help='输入加密文件夹路径')
@click.option('--output', '-o', required=True, help='输出文件夹路径')
@click.option('--password', '-p', required=True, help='解密密码')
@click.option('--recursive/--no-recursive', default=True, help='是否递归处理子文件夹')
def file_decrypt_dir(input, output, password, recursive):
    """批量解密文件夹"""
    try:
        encryptor = FileEncryptor()
        count, files = encryptor.decrypt_directory(input, output, password, recursive=recursive)
        click.echo(f"已解密 {count} 个文件")
        for f in files:
            click.echo(f"  - {f}")
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@file.command('hash')
@click.option('--algorithm', '-a', default='sha256', help='哈希算法')
@click.argument('file_path')
def file_hash(algorithm, file_path):
    """计算文件哈希"""
    try:
        result = FileIntegrityChecker.generate_hash(file_path, algorithm)
        click.echo(result)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@cli.group()
def kdf():
    """密钥派生"""
    pass


@kdf.command()
@click.option('--algorithm', '-a', default='pbkdf2', help='KDF 算法: pbkdf2, bcrypt, scrypt, argon2')
@click.option('--length', '-l', default=32, help='派生密钥长度')
@click.option('--salt', help='盐值（十六进制），如未提供则自动生成')
@click.option('--iterations', default=100000, help='迭代次数（PBKDF2）')
@click.argument('password')
def derive(algorithm, length, salt, iterations, password):
    """从密码派生密钥"""
    try:
        salt_bytes = bytes.fromhex(salt) if salt else None

        key, used_salt = KDF.password_to_key(
            password,
            algorithm=algorithm,
            length=length,
            salt=salt_bytes,
            iterations=iterations
        )

        click.echo(f"盐值: {used_salt.hex()}")
        click.echo(f"密钥: {key.hex()}")
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@cli.group()
def random():
    """随机数生成"""
    pass


@random.command('bytes')
@click.argument('length', type=int)
@click.option('--output-format', default='hex', help='输出格式: hex, base64')
def random_bytes(length, output_format):
    """生成随机字节"""
    try:
        result = RandomGenerator.random_bytes(length)
        if output_format == 'hex':
            click.echo(result.hex())
        else:
            from encode import Encoder, BaseEncoding
            click.echo(Encoder.base_encode(result, BaseEncoding.BASE64))
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@random.command('string')
@click.argument('length', type=int)
@click.option('--charset', default='alphanumeric', help='字符集: alphanumeric, alphabetic, numeric, hex, url_safe')
def random_string(length, charset):
    """生成随机字符串"""
    try:
        result = RandomGenerator.random_string(length, charset=charset)
        click.echo(result)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@random.command('password')
@click.option('--length', default=16, help='密码长度')
@click.option('--min-upper', default=1, help='最少大写字母数量')
@click.option('--min-lower', default=1, help='最少小写字母数量')
@click.option('--min-digits', default=1, help='最少数字数量')
@click.option('--min-punc', default=1, help='最少标点符号数量')
def random_password(length, min_upper, min_lower, min_digits, min_punc):
    """生成安全密码"""
    try:
        result = RandomGenerator.generate_password(
            length=length,
            min_uppercase=min_upper,
            min_lowercase=min_lower,
            min_digits=min_digits,
            min_punctuation=min_punc
        )
        click.echo(result)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@random.command('int')
@click.argument('min_val', type=int)
@click.argument('max_val', type=int)
def random_int(min_val, max_val):
    """生成指定范围的随机整数"""
    try:
        result = RandomGenerator.secure_random_int(min_val, max_val)
        click.echo(result)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@random.command('key')
@click.option('--type', '-t', default='aes-256', help='密钥类型: aes-128, aes-192, aes-256, des, 3des')
@click.option('--output-format', default='hex', help='输出格式: hex, base64')
def random_key(type, output_format):
    """生成加密密钥"""
    try:
        if type.startswith('aes'):
            key_size = int(type.split('-')[1])
            result = RandomGenerator.generate_aes_key(key_size)
        elif type == 'des':
            result = RandomGenerator.generate_des_key()
        elif type == '3des':
            result = RandomGenerator.generate_3des_key()
        else:
            click.echo(f"不支持的密钥类型: {type}", err=True)
            sys.exit(1)

        if output_format == 'hex':
            click.echo(result.hex())
        else:
            from encode import Encoder, BaseEncoding
            click.echo(Encoder.base_encode(result, BaseEncoding.BASE64))
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@cli.group()
def sign():
    """数字签名"""
    pass


@sign.command()
@click.option('--privkey', required=True, help='私钥文件路径')
@click.option('--algorithm', '-a', default='rsa-sha256', help='签名算法: rsa-sha256, rsa-sha512, ecdsa-sha256')
@click.option('--output-format', default='hex', help='输出格式: hex, base64')
@click.argument('data', required=False)
@click.option('--file', '-f', 'file_path', help='签名文件')
def sign_cmd(privkey, algorithm, output_format, data, file_path):
    """签名数据或文件"""
    try:
        with open(privkey, 'rb') as f:
            key_data = f.read()

        from cipher import KeyFormat
        if algorithm.startswith('rsa'):
            cipher_obj = RSACipher()
            cipher_obj.load_private_key(key_data)
            private_key = cipher_obj.private_key
        elif algorithm.startswith('ecdsa'):
            cipher_obj = ECCipher()
            cipher_obj.load_private_key(key_data)
            private_key = cipher_obj.private_key
        else:
            click.echo(f"不支持的签名算法: {algorithm}", err=True)
            sys.exit(1)

        if file_path:
            signature = Signer.sign_file(file_path, private_key, algorithm, output_format='bytes')
        elif data:
            signature = Signer.sign_data(data, private_key, algorithm, output_format='bytes')
        else:
            click.echo("请提供数据或文件路径", err=True)
            sys.exit(1)

        if output_format == 'hex':
            click.echo(signature.hex())
        else:
            from encode import Encoder, BaseEncoding
            click.echo(Encoder.base_encode(signature, BaseEncoding.BASE64))
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@sign.command()
@click.option('--pubkey', required=True, help='公钥文件路径')
@click.option('--signature', '-s', required=True, help='签名值（十六进制或Base64）')
@click.option('--algorithm', '-a', default='rsa-sha256', help='签名算法')
@click.option('--sig-format', default='hex', help='签名格式: hex, base64')
@click.argument('data', required=False)
@click.option('--file', '-f', 'file_path', help='验证文件')
def verify(pubkey, signature, algorithm, sig_format, data, file_path):
    """验证签名"""
    try:
        with open(pubkey, 'rb') as f:
            key_data = f.read()

        if sig_format == 'hex':
            sig_bytes = bytes.fromhex(signature)
        else:
            from encode import Encoder, BaseEncoding
            sig_bytes = Encoder.base_decode(signature, BaseEncoding.BASE64)

        if algorithm.startswith('rsa'):
            cipher_obj = RSACipher()
            cipher_obj.load_public_key(key_data)
            public_key = cipher_obj.public_key
        elif algorithm.startswith('ecdsa'):
            cipher_obj = ECCipher()
            cipher_obj.load_public_key(key_data)
            public_key = cipher_obj.public_key
        else:
            click.echo(f"不支持的签名算法: {algorithm}", err=True)
            sys.exit(1)

        if file_path:
            result = Signer.verify_file_signature(sig_bytes, file_path, public_key, algorithm)
        elif data:
            result = Signer.verify_signature(sig_bytes, data, public_key, algorithm)
        else:
            click.echo("请提供数据或文件路径", err=True)
            sys.exit(1)

        if result:
            click.echo("✓ 签名验证通过")
            sys.exit(0)
        else:
            click.echo("✗ 签名验证失败")
            sys.exit(1)
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


def main():
    """主入口函数"""
    cli()


if __name__ == '__main__':
    main()
