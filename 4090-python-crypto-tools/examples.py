"""密码学协议示例和演示代码"""

import os
import sys
from typing import Dict, Tuple

try:
    from .cipher import SymmetricCipher, RSACipher, ECCipher, Algorithm, Mode, Padding
    from .kdf import KDF
    from .crypto_random import RandomGenerator, generate_salt, generate_nonce
    from .hash import HashTool, HashAlgorithm, HMACTool
except ImportError:
    from cipher import SymmetricCipher, RSACipher, ECCipher, Algorithm, Mode, Padding
    from kdf import KDF
    from crypto_random import RandomGenerator, generate_salt, generate_nonce
    from hash import HashTool, HashAlgorithm, HMACTool


class ProtocolExamples:
    """密码学协议示例"""

    @staticmethod
    def hybrid_encryption_demo():
        """
        对称+非对称加密组合示例（混合加密）

        场景：
        - 发送方：生成随机对称密钥加密数据，用接收方公钥加密对称密钥
        - 接收方：用私钥解密得到对称密钥，再解密数据
        """
        print("=" * 60)
        print("混合加密示例（对称 + 非对称）")
        print("=" * 60)

        message = "这是一条需要安全传输的机密消息"
        print(f"\n原始消息: {message}")

        # 1. 接收方生成 RSA 密钥对
        print("\n1. 接收方生成 RSA 密钥对...")
        receiver = RSACipher(key_size=2048)
        receiver.generate_keys()
        print("   ✓ RSA 密钥对已生成")

        # 2. 发送方生成随机 AES 密钥
        print("\n2. 发送方生成随机 AES-256 密钥...")
        aes_key = RandomGenerator.generate_aes_key(256)
        print(f"   ✓ AES 密钥: {aes_key.hex()}")

        # 3. 发送方用 AES 加密消息
        print("\n3. 发送方用 AES 加密消息...")
        aes_cipher = SymmetricCipher(
            algorithm=Algorithm.AES_256,
            mode=Mode.GCM,
            key=aes_key
        )
        encrypted_data = aes_cipher.encrypt(message)
        print(f"   ✓ 加密后的数据长度: {len(encrypted_data)} 字节")
        print(f"     IV: {aes_cipher.iv.hex()}")
        print(f"     Tag: {aes_cipher.tag.hex()}")

        # 4. 发送方用接收方公钥加密 AES 密钥
        print("\n4. 发送方用接收方公钥加密 AES 密钥...")
        sender_rsa = RSACipher()
        sender_rsa.public_key = receiver.public_key
        encrypted_aes_key = sender_rsa.encrypt(aes_key)
        print(f"   ✓ 加密后的 AES 密钥长度: {len(encrypted_aes_key)} 字节")

        # 5. 发送：encrypted_aes_key + encrypted_data
        print("\n5. 传输数据: [加密的AES密钥] + [加密的消息]")

        # 6. 接收方用私钥解密 AES 密钥
        print("\n6. 接收方用私钥解密 AES 密钥...")
        decrypted_aes_key = receiver.decrypt(encrypted_aes_key)
        print(f"   ✓ 解密后的 AES 密钥: {decrypted_aes_key.hex()}")
        assert decrypted_aes_key == aes_key, "AES 密钥解密失败"

        # 7. 接收方用 AES 密钥解密消息
        print("\n7. 接收方用 AES 密钥解密消息...")
        decrypt_cipher = SymmetricCipher(
            algorithm=Algorithm.AES_256,
            mode=Mode.GCM,
            key=decrypted_aes_key
        )
        decrypted_message = decrypt_cipher.decrypt(encrypted_data)
        print(f"   ✓ 解密后的消息: {decrypted_message.decode('utf-8')}")

        assert decrypted_message.decode('utf-8') == message, "消息解密失败"
        print("\n✓ 混合加密演示成功！")

        return {
            'success': True,
            'aes_key': aes_key,
            'encrypted_data': encrypted_data,
            'encrypted_aes_key': encrypted_aes_key
        }

    @staticmethod
    def tls_handshake_demo():
        """
        TLS 握手过程演示（简化版）

        TLS 1.2 握手流程简化：
        1. ClientHello -> 客户端随机数 + 支持的密码套件
        2. ServerHello -> 服务器随机数 + 选中的密码套件
        3. ServerCertificate -> 服务器证书
        4. ServerHelloDone
        5. ClientKeyExchange -> 预主密钥（用服务器公钥加密）
        6. 双方派生会话密钥
        7. Finished 消息验证
        """
        print("\n" + "=" * 60)
        print("TLS 握手过程演示")
        print("=" * 60)

        # 服务器准备：生成证书和密钥对
        print("\n[服务器初始化]")
        print("生成 RSA 密钥对和自签名证书...")
        server_rsa = RSACipher(key_size=2048)
        server_rsa.generate_keys()
        print("✓ 服务器密钥对已生成")

        # ========== 握手开始 ==========
        print("\n" + "-" * 40)
        print("TLS 握手开始")
        print("-" * 40)

        # Step 1: Client -> Server: ClientHello
        print("\n1. Client → Server: ClientHello")
        client_random = RandomGenerator.random_bytes(32)
        cipher_suites = ['TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256', 'TLS_AES_128_GCM_SHA256']
        print(f"   客户端随机数: {client_random.hex()}")
        print(f"   支持的密码套件: {cipher_suites}")

        # Step 2: Server -> Client: ServerHello
        print("\n2. Server → Client: ServerHello")
        server_random = RandomGenerator.random_bytes(32)
        selected_cipher = cipher_suites[0]
        print(f"   服务器随机数: {server_random.hex()}")
        print(f"   选中的密码套件: {selected_cipher}")

        # Step 3: Server -> Client: Certificate
        print("\n3. Server → Client: Certificate")
        print("   服务器发送证书（包含公钥）")

        # Step 4: Server -> Client: ServerHelloDone
        print("\n4. Server → Client: ServerHelloDone")
        print("   服务器握手消息发送完成")

        # Step 5: Client -> Server: ClientKeyExchange
        print("\n5. Client → Server: ClientKeyExchange")
        pre_master_secret = RandomGenerator.random_bytes(48)
        print(f"   客户端生成预主密钥: {pre_master_secret.hex()}")

        client_rsa = RSACipher()
        client_rsa.public_key = server_rsa.public_key
        encrypted_pms = client_rsa.encrypt(pre_master_secret)
        print(f"   用服务器公钥加密预主密钥后: {len(encrypted_pms)} 字节")

        # Step 6: 双方派生会话密钥
        print("\n6. 双方派生会话密钥")
        print("   主密钥 = PRF(预主密钥, 'master secret', 客户端随机数 + 服务器随机数)")

        master_secret_input = pre_master_secret + b'master secret' + client_random + server_random
        master_secret = HashTool.hash(master_secret_input, HashAlgorithm.SHA256, output_format='bytes')
        print(f"   主密钥: {master_secret.hex()}")

        print("\n   派生会话密钥:")
        key_material = master_secret + client_random + server_random
        client_write_key = KDF.derive_key(master_secret, "client write key", length=32)
        server_write_key = KDF.derive_key(master_secret, "server write key", length=32)
        client_mac_key = KDF.derive_key(master_secret, "client MAC key", length=32)
        server_mac_key = KDF.derive_key(master_secret, "server MAC key", length=32)
        print(f"   客户端加密密钥: {client_write_key.hex()}")
        print(f"   服务器加密密钥: {server_write_key.hex()}")
        print(f"   客户端 MAC 密钥: {client_mac_key.hex()}")
        print(f"   服务器 MAC 密钥: {server_mac_key.hex()}")

        # Step 7: Finished 消息
        print("\n7. 双方交换 Finished 消息验证")
        print("   发送加密的 Finished 消息验证握手完整性")

        # ========== 应用数据加密 ==========
        print("\n" + "-" * 40)
        print("加密应用数据传输")
        print("-" * 40)

        application_data = "GET /api/secure HTTP/1.1\r\nHost: example.com\r\n"
        print(f"\n客户端要发送的数据:\n{application_data}")

        # 客户端加密
        client_cipher = SymmetricCipher(
            algorithm=Algorithm.AES_256,
            mode=Mode.GCM,
            key=client_write_key
        )
        encrypted_app_data = client_cipher.encrypt(application_data)
        print(f"加密后数据长度: {len(encrypted_app_data)} 字节")

        # 服务器解密
        server_decrypt = SymmetricCipher(
            algorithm=Algorithm.AES_256,
            mode=Mode.GCM,
            key=client_write_key
        )
        decrypted_app_data = server_decrypt.decrypt(encrypted_app_data)
        print(f"服务器解密后:\n{decrypted_app_data.decode('utf-8')}")

        assert decrypted_app_data.decode('utf-8') == application_data, "应用数据解密失败"
        print("\n✓ TLS 握手演示成功！")

        return {
            'success': True,
            'client_random': client_random,
            'server_random': server_random,
            'master_secret': master_secret,
            'client_write_key': client_write_key,
            'server_write_key': server_write_key
        }

    @staticmethod
    def https_working_demo():
        """
        HTTPS 工作原理演示

        HTTPS = HTTP + TLS/SSL
        演示：
        1. 建立 TCP 连接
        2. TLS 握手
        3. 加密 HTTP 请求/响应
        """
        print("\n" + "=" * 60)
        print("HTTPS 工作原理演示")
        print("=" * 60)

        print("""
HTTPS 完整流程:
┌─────────────────┐        ┌─────────────────┐
│    客户端        │        │     服务器       │
└────────┬────────┘        └────────┬────────┘
         │  1. TCP 三次握手          │
         │ ─────────────────────────>│
         │  2. TLS 握手              │
         │    ClientHello            │
         │ ─────────────────────────>│
         │    ServerHello + Cert     │
         │ <─────────────────────────│
         │    ClientKeyExchange      │
         │ ─────────────────────────>│
         │    会话密钥派生           │
         │  3. 加密 HTTP 请求        │
         │    (GET /index.html)      │
         │ ─────────────────────────>│
         │  4. 加密 HTTP 响应        │
         │    (200 OK + HTML)        │
         │ <─────────────────────────│
         │  5. TCP 断开              │
""")

        # 服务器配置
        server_rsa = RSACipher(key_size=2048)
        server_rsa.generate_keys()

        # 模拟 HTTP 请求
        http_request = (
            "GET /index.html HTTP/1.1\r\n"
            "Host: www.example.com\r\n"
            "User-Agent: CryptoTools/1.0\r\n"
            "Accept: text/html\r\n"
            "\r\n"
        )

        http_response = (
            "HTTP/1.1 200 OK\r\n"
            "Content-Type: text/html; charset=utf-8\r\n"
            "Content-Length: 58\r\n"
            "\r\n"
            "<html><body><h1>Hello, Secure World!</h1></body></html>"
        )

        print("\n[步骤 1-2] 已完成 TCP 连接和 TLS 握手")

        # 派生会话密钥（简化）
        session_key = RandomGenerator.generate_aes_key(256)
        print(f"\n[会话密钥] AES-256: {session_key.hex()}")

        print("\n[步骤 3] 客户端发送加密 HTTP 请求")
        print("-" * 40)
        print("原始 HTTP 请求:")
        print(http_request)

        request_cipher = SymmetricCipher(
            algorithm=Algorithm.AES_256,
            mode=Mode.GCM,
            key=session_key
        )
        encrypted_request = request_cipher.encrypt(http_request)
        print(f"加密后请求数据: {len(encrypted_request)} 字节")

        print("\n[步骤 4] 服务器解密请求并返回加密响应")
        print("-" * 40)

        server_decrypt = SymmetricCipher(
            algorithm=Algorithm.AES_256,
            mode=Mode.GCM,
            key=session_key
        )
        decrypted_request = server_decrypt.decrypt(encrypted_request)
        print("服务器解密后的请求:")
        print(decrypted_request.decode('utf-8'))

        print("\n服务器生成响应:")
        print(http_response)

        response_cipher = SymmetricCipher(
            algorithm=Algorithm.AES_256,
            mode=Mode.GCM,
            key=session_key
        )
        encrypted_response = response_cipher.encrypt(http_response)
        print(f"加密后响应数据: {len(encrypted_response)} 字节")

        print("\n[步骤 5] 客户端解密响应")
        print("-" * 40)
        client_decrypt = SymmetricCipher(
            algorithm=Algorithm.AES_256,
            mode=Mode.GCM,
            key=session_key
        )
        decrypted_response = client_decrypt.decrypt(encrypted_response)
        print("客户端解密后的响应:")
        print(decrypted_response.decode('utf-8'))

        assert decrypted_response.decode('utf-8') == http_response, "响应解密失败"
        print("\n✓ HTTPS 工作原理演示成功！")

        return {
            'success': True,
            'session_key': session_key,
            'encrypted_request': encrypted_request,
            'encrypted_response': encrypted_response
        }

    @staticmethod
    def digital_signature_workflow_demo():
        """
        数字签名工作流演示

        场景：文档签名和验证
        1. 发送方对文档哈希后签名
        2. 发送文档 + 签名
        3. 接收方验签
        """
        print("\n" + "=" * 60)
        print("数字签名工作流演示")
        print("=" * 60)

        document = """
        机密文件
        ==============
        标题：2024 年度安全报告
        作者：安全团队
        日期：2024-01-15
        内容：本年度安全评估结果良好...
        """

        print("\n文档内容:")
        print(document)

        # 1. 签名者生成密钥对
        print("\n1. 签名者生成 ECC 密钥对")
        signer = ECCipher(curve='secp256r1')
        signer.generate_keys()
        print("   ✓ 密钥对已生成")

        # 2. 计算文档哈希
        print("\n2. 计算文档 SHA-256 哈希")
        doc_hash = HashTool.hash(document, HashAlgorithm.SHA256)
        print(f"   文档哈希: {doc_hash}")

        # 3. 签名
        print("\n3. 用私钥对哈希签名")
        signature = signer.sign(document)
        print(f"   签名 (hex): {signature.hex()}")
        print(f"   签名长度: {len(signature)} 字节")

        # 4. 发送文档 + 签名
        print("\n4. 发送: [文档] + [签名]")

        # 5. 接收方验签
        print("\n5. 接收方验证签名")
        verifier = ECCipher()
        verifier.public_key = signer.public_key

        is_valid = verifier.verify(signature, document)
        print(f"   验证结果: {'✓ 有效' if is_valid else '✗ 无效'}")

        # 6. 模拟文档被篡改
        print("\n6. 模拟文档被篡改")
        tampered_document = document.replace("良好", "优秀")
        is_valid_tampered = verifier.verify(signature, tampered_document)
        print(f"   篡改后验证结果: {'✓ 有效' if is_valid_tampered else '✗ 无效（检测到篡改）'}")

        assert is_valid and not is_valid_tampered, "签名验证逻辑错误"
        print("\n✓ 数字签名工作流演示成功！")

        return {
            'success': True,
            'signature': signature,
            'document_hash': doc_hash
        }

    @staticmethod
    def key_derivation_hierarchy_demo():
        """
        密钥分层管理演示

        主密钥 -> 二级密钥 -> 三级密钥
        """
        print("\n" + "=" * 60)
        print("密钥分层管理演示")
        print("=" * 60)

        # 生成主密钥
        print("\n1. 生成主密钥 (Master Key)")
        master_key = RandomGenerator.generate_aes_key(256)
        print(f"   主密钥: {master_key.hex()}")

        # 分层派生
        print("\n2. 分层密钥派生")
        print("   " + "─" * 50)

        key_manager = KDF

        # 二级密钥
        print("\n   二级密钥:")
        encryption_key = key_manager.derive_key(master_key, "encryption", 32)
        signing_key = key_manager.derive_key(master_key, "signing", 32)
        backup_key = key_manager.derive_key(master_key, "backup", 32)
        print(f"   ├─ 加密密钥: {encryption_key.hex()}")
        print(f"   ├─ 签名密钥: {signing_key.hex()}")
        print(f"   └─ 备份密钥: {backup_key.hex()}")

        # 三级密钥
        print("\n   三级密钥 (从加密密钥派生):")
        aes_key = key_manager.derive_key(encryption_key, "aes-data", 32)
        hmac_key = key_manager.derive_key(encryption_key, "hmac-data", 32)
        iv_seed = key_manager.derive_key(encryption_key, "iv-seed", 16)
        print(f"      ├─ AES 数据密钥: {aes_key.hex()}")
        print(f"      ├─ HMAC 密钥: {hmac_key.hex()}")
        print(f"      └─ IV 种子: {iv_seed.hex()}")

        # 使用密钥加密数据
        print("\n3. 使用派生的 AES 密钥加密数据")
        data = "敏感数据需要保护"
        cipher = SymmetricCipher(
            algorithm=Algorithm.AES_256,
            mode=Mode.GCM,
            key=aes_key
        )
        encrypted = cipher.encrypt(data)
        print(f"   加密成功，密文长度: {len(encrypted)} 字节")

        # 可确定性：相同输入得到相同输出
        print("\n4. 密钥派生的确定性验证")
        same_aes_key = key_manager.derive_key(encryption_key, "aes-data", 32)
        print(f"   重新派生 AES 密钥: {same_aes_key.hex()}")
        print(f"   与之前一致: {same_aes_key == aes_key}")

        assert same_aes_key == aes_key, "密钥派生不具备确定性"
        print("\n✓ 密钥分层管理演示成功！")

        return {
            'success': True,
            'master_key': master_key,
            'hierarchy': {
                'encryption': encryption_key,
                'signing': signing_key,
                'backup': backup_key,
                'aes-data': aes_key,
                'hmac-data': hmac_key
            }
        }


def run_all_demos():
    """运行所有演示"""
    demos = [
        ProtocolExamples.hybrid_encryption_demo,
        ProtocolExamples.tls_handshake_demo,
        ProtocolExamples.https_working_demo,
        ProtocolExamples.digital_signature_workflow_demo,
        ProtocolExamples.key_derivation_hierarchy_demo,
    ]

    results = []
    for demo in demos:
        try:
            result = demo()
            results.append(result)
        except Exception as e:
            print(f"\n✗ 演示失败: {e}")
            results.append({'success': False, 'error': str(e)})

    print("\n" + "=" * 60)
    print("演示汇总")
    print("=" * 60)
    for i, result in enumerate(results, 1):
        status = "✓ 成功" if result.get('success') else "✗ 失败"
        print(f"{i}. {status}")

    return results


if __name__ == '__main__':
    run_all_demos()
