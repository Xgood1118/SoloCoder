"""数字签名模块"""

import datetime
import os
import struct
from enum import Enum
from typing import List, Optional, Tuple, Union

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, ec, padding as asym_padding
from cryptography.hazmat.backends import default_backend
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives.serialization import pkcs12

try:
    from .hash import HashTool, HashAlgorithm
    from .cipher import RSACipher, ECCipher, KeyFormat, CurveType
except ImportError:
    from hash import HashTool, HashAlgorithm
    from cipher import RSACipher, ECCipher, KeyFormat, CurveType


class SignatureAlgorithm(Enum):
    RSA_SHA256 = "rsa-sha256"
    RSA_SHA512 = "rsa-sha512"
    ECDSA_SHA256 = "ecdsa-sha256"
    ECDSA_SHA512 = "ecdsa-sha512"
    DSA_SHA256 = "dsa-sha256"
    ED25519 = "ed25519"


class Signer:
    """数字签名工具类"""

    @staticmethod
    def sign_data(
        data: Union[str, bytes],
        private_key,
        algorithm: Union[SignatureAlgorithm, str] = SignatureAlgorithm.RSA_SHA256,
        output_format: str = "bytes"
    ) -> Union[bytes, str]:
        """
        签名数据

        Args:
            data: 待签名数据
            private_key: 私钥
            algorithm: 签名算法
            output_format: 输出格式，'bytes' 或 'hex'

        Returns:
            签名
        """
        if isinstance(algorithm, str):
            algorithm = SignatureAlgorithm(algorithm.lower())

        if isinstance(data, str):
            data = data.encode('utf-8')

        signature = None

        if algorithm in (SignatureAlgorithm.RSA_SHA256, SignatureAlgorithm.RSA_SHA512):
            hash_algo = hashes.SHA256() if algorithm == SignatureAlgorithm.RSA_SHA256 else hashes.SHA512()
            signature = private_key.sign(
                data,
                asym_padding.PSS(
                    mgf=asym_padding.MGF1(hash_algo),
                    salt_length=asym_padding.PSS.MAX_LENGTH
                ),
                hash_algo
            )
        elif algorithm in (SignatureAlgorithm.ECDSA_SHA256, SignatureAlgorithm.ECDSA_SHA512):
            hash_algo = hashes.SHA256() if algorithm == SignatureAlgorithm.ECDSA_SHA256 else hashes.SHA512()
            signature = private_key.sign(
                data,
                ec.ECDSA(hash_algo)
            )
        else:
            raise ValueError(f"不支持的签名算法: {algorithm}")

        if output_format == "hex":
            return signature.hex()
        return signature

    @staticmethod
    def verify_signature(
        signature: Union[bytes, str],
        data: Union[str, bytes],
        public_key,
        algorithm: Union[SignatureAlgorithm, str] = SignatureAlgorithm.RSA_SHA256
    ) -> bool:
        """
        验证签名

        Args:
            signature: 签名
            data: 原始数据
            public_key: 公钥
            algorithm: 签名算法

        Returns:
            验证是否通过
        """
        if isinstance(algorithm, str):
            algorithm = SignatureAlgorithm(algorithm.lower())

        if isinstance(data, str):
            data = data.encode('utf-8')

        if isinstance(signature, str):
            signature = bytes.fromhex(signature)

        try:
            if algorithm in (SignatureAlgorithm.RSA_SHA256, SignatureAlgorithm.RSA_SHA512):
                hash_algo = hashes.SHA256() if algorithm == SignatureAlgorithm.RSA_SHA256 else hashes.SHA512()
                public_key.verify(
                    signature,
                    data,
                    asym_padding.PSS(
                        mgf=asym_padding.MGF1(hash_algo),
                        salt_length=asym_padding.PSS.MAX_LENGTH
                    ),
                    hash_algo
                )
            elif algorithm in (SignatureAlgorithm.ECDSA_SHA256, SignatureAlgorithm.ECDSA_SHA512):
                hash_algo = hashes.SHA256() if algorithm == SignatureAlgorithm.ECDSA_SHA256 else hashes.SHA512()
                public_key.verify(
                    signature,
                    data,
                    ec.ECDSA(hash_algo)
                )
            else:
                raise ValueError(f"不支持的签名算法: {algorithm}")
            return True
        except Exception:
            return False

    @staticmethod
    def sign_file(
        file_path: str,
        private_key,
        algorithm: Union[SignatureAlgorithm, str] = SignatureAlgorithm.RSA_SHA256,
        output_format: str = "bytes",
        chunk_size: int = 8192
    ) -> Union[bytes, str]:
        """
        签名文件

        Args:
            file_path: 文件路径
            private_key: 私钥
            algorithm: 签名算法
            output_format: 输出格式
            chunk_size: 块大小

        Returns:
            签名
        """
        file_hash = HashTool.hash_file(file_path, HashAlgorithm.SHA256, output_format="bytes")
        return Signer.sign_data(file_hash, private_key, algorithm, output_format)

    @staticmethod
    def verify_file_signature(
        signature: Union[bytes, str],
        file_path: str,
        public_key,
        algorithm: Union[SignatureAlgorithm, str] = SignatureAlgorithm.RSA_SHA256,
        chunk_size: int = 8192
    ) -> bool:
        """
        验证文件签名

        Args:
            signature: 签名
            file_path: 文件路径
            public_key: 公钥
            algorithm: 签名算法
            chunk_size: 块大小

        Returns:
            验证是否通过
        """
        file_hash = HashTool.hash_file(file_path, HashAlgorithm.SHA256, output_format="bytes")
        return Signer.verify_signature(signature, file_hash, public_key, algorithm)


class CertificateManager:
    """证书管理器"""

    @staticmethod
    def generate_self_signed_cert(
        private_key,
        common_name: str = "localhost",
        country: str = "CN",
        state: str = "Beijing",
        locality: str = "Beijing",
        organization: str = "Security Team",
        organizational_unit: str = "Crypto Tools",
        valid_days: int = 365,
        is_ca: bool = False
    ) -> x509.Certificate:
        """
        生成自签名证书

        Args:
            private_key: 私钥
            common_name: 通用名称
            country: 国家
            state: 省份
            locality: 城市
            organization: 组织
            organizational_unit: 部门
            valid_days: 有效期（天）
            is_ca: 是否为 CA 证书

        Returns:
            证书对象
        """
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, country),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, state),
            x509.NameAttribute(NameOID.LOCALITY_NAME, locality),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, organization),
            x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, organizational_unit),
            x509.NameAttribute(NameOID.COMMON_NAME, common_name),
        ])

        cert_builder = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(private_key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.datetime.now(datetime.timezone.utc))
            .not_valid_after(
                datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=valid_days)
            )
            .add_extension(
                x509.SubjectAlternativeName([x509.DNSName(common_name)]),
                critical=False,
            )
        )

        if is_ca:
            cert_builder = cert_builder.add_extension(
                x509.BasicConstraints(ca=True, path_length=None), critical=True,
            ).add_extension(
                x509.KeyUsage(
                    digital_signature=True,
                    content_commitment=False,
                    key_encipherment=False,
                    data_encipherment=False,
                    key_agreement=False,
                    key_cert_sign=True,
                    crl_sign=True,
                    encipher_only=False,
                    decipher_only=False,
                ),
                critical=True,
            )

        cert = cert_builder.sign(private_key, hashes.SHA256(), default_backend())
        return cert

    @staticmethod
    def generate_csr(
        private_key,
        common_name: str = "localhost",
        country: str = "CN",
        state: str = "Beijing",
        locality: str = "Beijing",
        organization: str = "Security Team",
        organizational_unit: str = "Crypto Tools"
    ) -> x509.CertificateSigningRequest:
        """
        生成证书签名请求 (CSR)

        Args:
            private_key: 私钥
            common_name: 通用名称
            country: 国家
            state: 省份
            locality: 城市
            organization: 组织
            organizational_unit: 部门

        Returns:
            CSR 对象
        """
        subject = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, country),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, state),
            x509.NameAttribute(NameOID.LOCALITY_NAME, locality),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, organization),
            x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, organizational_unit),
            x509.NameAttribute(NameOID.COMMON_NAME, common_name),
        ])

        csr = (
            x509.CertificateSigningRequestBuilder()
            .subject_name(subject)
            .add_extension(
                x509.SubjectAlternativeName([x509.DNSName(common_name)]),
                critical=False,
            )
            .sign(private_key, hashes.SHA256(), default_backend())
        )
        return csr

    @staticmethod
    def sign_certificate(
        csr: x509.CertificateSigningRequest,
        ca_cert: x509.Certificate,
        ca_private_key,
        valid_days: int = 365
    ) -> x509.Certificate:
        """
        使用 CA 证书签署证书

        Args:
            csr: 证书签名请求
            ca_cert: CA 证书
            ca_private_key: CA 私钥
            valid_days: 有效期（天）

        Returns:
            签署后的证书
        """
        cert = (
            x509.CertificateBuilder()
            .subject_name(csr.subject)
            .issuer_name(ca_cert.subject)
            .public_key(csr.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.datetime.now(datetime.timezone.utc))
            .not_valid_after(
                datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=valid_days)
            )
            .add_extension(
                x509.SubjectAlternativeName(
                    csr.extensions.get_extension_for_class(x509.SubjectAlternativeName).value
                ),
                critical=False,
            )
            .sign(ca_private_key, hashes.SHA256(), default_backend())
        )
        return cert

    @staticmethod
    def verify_certificate_chain(
        cert: x509.Certificate,
        chain: List[x509.Certificate],
        trust_roots: List[x509.Certificate]
    ) -> bool:
        """
        验证证书链

        Args:
            cert: 待验证证书
            chain: 中间证书链
            trust_roots: 信任根证书

        Returns:
            验证是否通过
        """
        try:
            from cryptography.hazmat.primitives.asymmetric import padding

            current_cert = cert
            verified_chain = [current_cert]

            while True:
                issuer = current_cert.issuer

                is_root = False
                for root in trust_roots:
                    if root.subject == issuer:
                        current_cert.public_key().verify(
                            current_cert.signature,
                            current_cert.tbs_certificate_bytes,
                            padding.PKCS1v15(),
                            current_cert.signature_hash_algorithm,
                        )
                        verified_chain.append(root)
                        is_root = True
                        break

                if is_root:
                    break

                found = False
                for intermediate in chain:
                    if intermediate.subject == issuer:
                        intermediate.public_key().verify(
                            current_cert.signature,
                            current_cert.tbs_certificate_bytes,
                            padding.PKCS1v15(),
                            current_cert.signature_hash_algorithm,
                        )
                        verified_chain.append(intermediate)
                        current_cert = intermediate
                        found = True
                        break

                if not found:
                    return False

            return True
        except Exception:
            return False

    @staticmethod
    def serialize_certificate(
        cert: x509.Certificate,
        format: KeyFormat = KeyFormat.PEM
    ) -> bytes:
        """
        序列化证书

        Args:
            cert: 证书对象
            format: 输出格式

        Returns:
            证书字节
        """
        if format == KeyFormat.PEM:
            return cert.public_bytes(serialization.Encoding.PEM)
        elif format == KeyFormat.DER:
            return cert.public_bytes(serialization.Encoding.DER)
        else:
            raise ValueError(f"不支持的证书格式: {format}")

    @staticmethod
    def load_certificate(
        cert_data: bytes,
        format: KeyFormat = KeyFormat.PEM
    ) -> x509.Certificate:
        """
        加载证书

        Args:
            cert_data: 证书数据
            format: 证书格式

        Returns:
            证书对象
        """
        if format == KeyFormat.PEM:
            return x509.load_pem_x509_certificate(cert_data, default_backend())
        elif format == KeyFormat.DER:
            return x509.load_der_x509_certificate(cert_data, default_backend())
        else:
            raise ValueError(f"不支持的证书格式: {format}")

    @staticmethod
    def export_pkcs12(
        cert: x509.Certificate,
        private_key,
        password: bytes,
        friendly_name: str = "certificate"
    ) -> bytes:
        """
        导出 PKCS#12 格式证书

        Args:
            cert: 证书
            private_key: 私钥
            password: 密码
            friendly_name: 友好名称

        Returns:
            PKCS#12 字节
        """
        return pkcs12.serialize_key_and_certificates(
            name=friendly_name.encode('utf-8'),
            key=private_key,
            cert=cert,
            cas=None,
            encryption_algorithm=serialization.BestAvailableEncryption(password)
        )

    @staticmethod
    def import_pkcs12(
        pkcs12_data: bytes,
        password: bytes
    ) -> Tuple[Optional[object], Optional[x509.Certificate], List[x509.Certificate]]:
        """
        导入 PKCS#12 格式证书

        Args:
            pkcs12_data: PKCS#12 数据
            password: 密码

        Returns:
            (私钥, 证书, CA 证书列表)
        """
        (private_key, cert, additional_certs) = pkcs12.load_key_and_certificates(
            pkcs12_data, password, default_backend()
        )
        return private_key, cert, additional_certs or []


class TimestampSigner:
    """时间戳签名（RFC3161）"""

    @staticmethod
    def create_timestamp_request(
        data: bytes,
        hash_algorithm: HashAlgorithm = HashAlgorithm.SHA256,
        nonce: Optional[int] = None,
        req_policy: Optional[str] = None,
        cert_req: bool = True
    ) -> bytes:
        """
        创建时间戳请求 (TSQ)

        Args:
            data: 待时间戳的数据
            hash_algorithm: 哈希算法
            nonce: 随机数
            req_policy: 请求策略 OID
            cert_req: 是否请求证书

        Returns:
            TSQ 字节（DER 编码）
        """
        digest = HashTool.hash(data, hash_algorithm, output_format="bytes")

        if nonce is None:
            nonce = struct.unpack('<Q', os.urandom(8))[0]

        from asn1crypto import tsp, algos

        hash_algo_map = {
            HashAlgorithm.SHA1: 'sha1',
            HashAlgorithm.SHA256: 'sha256',
            HashAlgorithm.SHA384: 'sha384',
            HashAlgorithm.SHA512: 'sha512',
        }
        algo_name = hash_algo_map.get(hash_algorithm, 'sha256')

        message_imprint = tsp.MessageImprint({
            'hash_algorithm': algos.DigestAlgorithm({'algorithm': algo_name}),
            'hashed_message': digest,
        })

        tsq = tsp.TimeStampReq({
            'version': 'v1',
            'message_imprint': message_imprint,
            'nonce': nonce,
            'cert_req': cert_req,
        })

        if req_policy:
            tsq['req_policy'] = tsp.TSAPolicyId(req_policy)

        return tsq.dump()

    @staticmethod
    def parse_timestamp_response(tsr_data: bytes) -> dict:
        """
        解析时间戳响应 (TSR)

        Args:
            tsr_data: TSR 字节（DER 编码）

        Returns:
            解析结果字典
        """
        from asn1crypto import tsp, x509 as asn1_x509

        tsr = tsp.TimeStampResp.load(tsr_data)
        status = tsr['status']
        pki_status = status['status'].native

        result = {
            'status': pki_status,
            'status_string': str(status.get('status_string', '')),
        }

        if pki_status == 'granted' or pki_status == 'granted_with_mods':
            tst_info = tsr['time_stamp_token']['content']
            signed_data = tst_info['content']

            signer_info = signed_data['signer_infos'][0]
            tst_info_signed = tsp.TSTInfo.load(signer_info['signed_attrs'].dump())

            result.update({
                'serial_number': str(tst_info_signed['serial_number'].native),
                'gen_time': tst_info_signed['gen_time'].native,
                'policy': str(tst_info_signed['policy'].native),
                'hash_algorithm': tst_info_signed['message_imprint']['hash_algorithm']['algorithm'].native,
                'hashed_message': tst_info_signed['message_imprint']['hashed_message'].native.hex(),
                'nonce': str(tst_info_signed['nonce'].native) if tst_info_signed['nonce'] else None,
                'tsa': str(tst_info_signed['tsa']['directory_name'].native) if tst_info_signed['tsa'] else None,
            })

        return result

    @staticmethod
    def verify_timestamp_response(
        tsr_data: bytes,
        original_data: bytes,
        trusted_certs: List[x509.Certificate]
    ) -> bool:
        """
        验证时间戳响应

        Args:
            tsr_data: TSR 字节
            original_data: 原始数据
            trusted_certs: 信任证书列表

        Returns:
            验证是否通过
        """
        try:
            result = TimestampSigner.parse_timestamp_response(tsr_data)
            if result['status'] not in ('granted', 'granted_with_mods'):
                return False

            hash_algo = HashAlgorithm(result['hash_algorithm'])
            expected_digest = HashTool.hash(original_data, hash_algo, output_format="bytes")
            actual_digest = bytes.fromhex(result['hashed_message'])

            if expected_digest != actual_digest:
                return False

            return True
        except Exception:
            return False


def sign_data(data: Union[str, bytes], private_key, **kwargs) -> bytes:
    """快速签名"""
    return Signer.sign_data(data, private_key, **kwargs)


def verify_signature(signature: Union[bytes, str], data: Union[str, bytes], public_key, **kwargs) -> bool:
    """快速验签"""
    return Signer.verify_signature(signature, data, public_key, **kwargs)


def generate_self_signed_cert(private_key, **kwargs) -> x509.Certificate:
    """快速生成自签名证书"""
    return CertificateManager.generate_self_signed_cert(private_key, **kwargs)
