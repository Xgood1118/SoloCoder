"""修复验证测试脚本"""

import sys
import os

print("=" * 60)
print("修复验证测试")
print("=" * 60)

errors = []

# 测试 1: 检查 crypto_random.py 存在
print("\n[1] 检查命名冲突修复 (random.py -> crypto_random.py)")
if os.path.exists('crypto_random.py'):
    print("   ✓ crypto_random.py 存在")
else:
    errors.append("crypto_random.py 不存在")
    print("   ✗ crypto_random.py 不存在")

if not os.path.exists('random.py'):
    print("   ✓ 原 random.py 已移除")
else:
    errors.append("原 random.py 仍然存在")
    print("   ✗ 原 random.py 仍然存在")

# 测试 2: 检查 sign.py 的类型注解修复
print("\n[2] 检查 sign.py 类型注解修复")
with open('sign.py', 'r', encoding='utf-8') as f:
    sign_content = f.read()
    if 'serialization.private_key' in sign_content:
        errors.append("sign.py 中仍然存在错误的类型注解 serialization.private_key")
        print("   ✗ 仍然存在错误的类型注解")
    else:
        print("   ✓ 类型注解已修复")

# 测试 3: 检查 filecrypt.py 的 GCM 修复
print("\n[3] 检查 filecrypt.py GCM 模式修复")
with open('filecrypt.py', 'r', encoding='utf-8') as f:
    file_content = f.read()
    if 'GCM_IV_SIZE = 12' in file_content:
        print("   ✓ GCM IV 大小已设置为 12 字节")
    else:
        errors.append("GCM IV 大小未正确设置")
        print("   ✗ GCM IV 大小未正确设置")
    
    if 'iv_size = self.GCM_IV_SIZE if mode == Mode.GCM' in file_content:
        print("   ✓ _parse_header 中根据模式动态设置 IV 大小")
    else:
        errors.append("_parse_header 中未动态设置 IV 大小")
        print("   ✗ _parse_header 中未动态设置 IV 大小")

# 测试 4: 检查所有导入引用
print("\n[4] 检查模块导入引用")
modules_to_check = [
    ('cipher.py', 'crypto_random'),
    ('kdf.py', 'crypto_random'),
    ('filecrypt.py', 'crypto_random'),
    ('examples.py', 'crypto_random'),
    ('cli.py', 'crypto_random'),
]

for module, expected_import in modules_to_check:
    if os.path.exists(module):
        with open(module, 'r', encoding='utf-8') as f:
            content = f.read()
            if f'from .{expected_import}' in content or f'from {expected_import}' in content:
                print(f"   ✓ {module} 正确引用 {expected_import}")
            else:
                errors.append(f"{module} 中未找到对 {expected_import} 的引用")
                print(f"   ✗ {module} 引用错误")

# 汇总结果
print("\n" + "=" * 60)
if errors:
    print(f"发现 {len(errors)} 个问题:")
    for i, error in enumerate(errors, 1):
        print(f"  {i}. {error}")
else:
    print("✓ 所有修复验证通过！")
print("=" * 60)

sys.exit(0 if not errors else 1)
