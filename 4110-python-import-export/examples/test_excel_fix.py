import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_io.writer import ExcelWriter
from data_io.reader import ExcelReader


def test_excel_write_read():
    temp_dir = tempfile.mkdtemp()
    xlsx_path = os.path.join(temp_dir, "test.xlsx")

    print("1. 测试 Excel 写入（write_only 模式）...")
    with ExcelWriter(
        xlsx_path,
        headers=["name", "age", "email"],
        freeze_header=True,
        auto_filter=True,
    ) as writer:
        writer.write_row({"name": "Alice", "age": 25, "email": "alice@test.com"})
        writer.write_row({"name": "Bob", "age": 30, "email": "bob@test.com"})
        print(f"   写入了 {writer.row_count} 行数据")

    print("2. 验证文件是否存在...")
    assert os.path.exists(xlsx_path), f"文件不存在: {xlsx_path}"
    print(f"   文件大小: {os.path.getsize(xlsx_path)} 字节")

    print("3. 测试 Excel 读取...")
    reader = ExcelReader(xlsx_path)
    headers = reader.read_headers()
    print(f"   表头: {headers}")
    assert headers == ["name", "age", "email"], f"表头不匹配: {headers}"

    rows = reader.read_all()
    print(f"   读取了 {len(rows)} 行数据")
    assert len(rows) == 2, f"行数不匹配: {len(rows)}"
    assert rows[0].data["name"] == "Alice"
    assert rows[1].data["name"] == "Bob"
    print(f"   第一行: {rows[0].data}")
    print(f"   第二行: {rows[1].data}")

    print("\n4. 测试追加写入...")
    with ExcelWriter(xlsx_path, headers=["name", "age", "email"], append=True) as writer:
        writer.write_row({"name": "Charlie", "age": 35, "email": "charlie@test.com"})

    reader2 = ExcelReader(xlsx_path)
    rows2 = reader2.read_all()
    assert len(rows2) == 3, f"追加后行数不匹配: {len(rows2)}"
    assert rows2[2].data["name"] == "Charlie"
    print(f"   追加成功，现在共有 {len(rows2)} 行")

    print("\n✅ Excel 写入/读取测试通过！")

    import shutil
    shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    test_excel_write_read()
