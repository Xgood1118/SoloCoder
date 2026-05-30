"""测试脚本 - 验证所有模块可正常导入"""

import sys
import traceback

modules = [
    ('cipher', '对称加密模块'),
    ('hash', '哈希模块'),
    ('encode', '编码模块'),
    ('filecrypt', '文件加密模块'),
    ('kdf', '密钥派生模块'),
    ('sign', '数字签名模块'),
    ('crypto_random', '随机数模块'),
    ('cli', '命令行模块'),
    ('examples', '示例模块'),
]

print("=" * 60)
print("模块导入测试")
print("=" * 60)

success_count = 0
fail_count = 0

for module_name, description in modules:
    try:
        __import__(module_name)
        print(f"✓ {description} ({module_name}.py) - 导入成功")
        success_count += 1
    except Exception as e:
        print(f"✗ {description} ({module_name}.py) - 导入失败")
        print(f"  错误: {e}")
        traceback.print_exc()
        fail_count += 1

print("\n" + "=" * 60)
print(f"测试结果: {success_count}/{len(modules)} 模块导入成功")
if fail_count > 0:
    print(f"有 {fail_count} 个模块导入失败，请检查依赖是否安装")
    sys.exit(1)
else:
    print("所有模块导入成功！")
    sys.exit(0)
