import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_io.reader import get_reader
from data_io.writer import get_writer
from data_io.validator import Validator
from data_io.mapper import Mapper
from data_io.pipeline import Pipeline
from data_io.utils.date_utils import parse_date, format_date
from data_io.utils.desensitize import desensitize_data


def create_sample_csv():
    import csv
    import tempfile

    temp_dir = tempfile.mkdtemp()
    input_path = os.path.join(temp_dir, "users.csv")

    with open(input_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["user_name", "user_email", "user_phone", "age", "birthday", "price_cents"])
        writer.writerow(["张三", "zhangsan@example.com", "13812345678", "25", "1999-01-15", "19999"])
        writer.writerow(["李四", "lisi@example.com", "13987654321", "30", "1994/05/20", "29999"])
        writer.writerow(["王五", "invalid-email", "111", "150", "01-01-1990", "999"])

    output_path = os.path.join(temp_dir, "users_output.csv")
    error_path = os.path.join(temp_dir, "error_report.json")

    return input_path, output_path, error_path, temp_dir


def main():
    input_path, output_path, error_path, temp_dir = create_sample_csv()
    print(f"输入文件: {input_path}")
    print(f"输出文件: {output_path}")
    print()

    reader = get_reader(input_path)
    print("表头:", reader.read_headers())
    print("数据总行数:", reader.total_rows())
    print()

    print("预览数据:")
    for record in reader.preview(3):
        print(f"  行{record.row_index}: {record.data}")
    print()

    mapper = Mapper()
    mapper.add_mapping("user_name", "name")
    mapper.add_mapping("user_email", "email")
    mapper.add_mapping("user_phone", "phone")
    mapper.add_mapping("age", "age", transform="to_int")
    mapper.add_mapping("birthday", "birthday", transform="format_date_ymd")
    mapper.add_mapping("price_cents", "price", transform="divide_100")

    validator = Validator()
    validator.add_required("user_name")
    validator.add_email("user_email")
    validator.add_phone("user_phone")
    validator.add_range("age", 0, 120)

    writer = get_writer(output_path)

    pipeline = Pipeline(
        reader=reader,
        writer=writer,
        validator=validator,
        mapper=mapper,
        enable_desensitization=True,
        desensitize_fields=["phone", "email"],
        stop_on_error=False,
    )

    def progress_cb(info):
        print(f"\r进度: {info['percent']:.1f}% ({info['processed']}/{info['total']})", end="", flush=True)

    print("开始执行导入导出...")
    result = pipeline.run(batch_size=10, progress_callback=progress_cb)
    print()

    print("\n执行结果:")
    print(f"  总记录数: {result.total_records}")
    print(f"  成功: {result.succeeded_records}")
    print(f"  失败: {result.failed_records}")
    print(f"  耗时: {result.duration:.2f}秒")

    if result.errors:
        print(f"\n错误详情（显示前5条）:")
        for err in result.errors[:5]:
            print(f"  行{err['row']} [{err['field']}]: {err['message']}")
        result.generate_error_report(error_path)
        print(f"\n错误报告已保存: {error_path}")

    print(f"\n输出文件已生成: {output_path}")

    print("\n输出文件内容预览:")
    with open(output_path, "r", encoding="utf-8-sig") as f:
        for line in f:
            print(f"  {line.strip()}")

    import shutil
    shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
