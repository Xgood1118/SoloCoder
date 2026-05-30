from __future__ import annotations

import csv
import json
import os
import tempfile
import unittest
from datetime import datetime

from data_io.reader import get_reader, CsvReader, JsonReader, ExcelReader, XmlReader
from data_io.writer import get_writer, CsvWriter, JsonWriter, ExcelWriter, XmlWriter
from data_io.validator import Validator, RequiredRule, EmailRule, PhoneRule, RangeRule
from data_io.mapper import Mapper
from data_io.pipeline import Pipeline, PipelineResult
from data_io.models import Record, RecordStatus
from data_io.utils.date_utils import parse_date, format_date
from data_io.utils.desensitize import mask_phone, mask_email, mask_id_card
from data_io.utils.splitter import calculate_chunks, generate_file_splits


class TestReader(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_csv_reader(self):
        csv_path = os.path.join(self.temp_dir, "test.csv")
        with open(csv_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["name", "age", "email"])
            writer.writerow(["Alice", "25", "alice@test.com"])
            writer.writerow(["Bob", "30", "bob@test.com"])

        reader = get_reader(csv_path)
        headers = reader.read_headers()
        self.assertEqual(headers, ["name", "age", "email"])

        rows = reader.read_all()
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0].data["name"], "Alice")
        self.assertEqual(rows[1].data["age"], "30")

        self.assertEqual(reader.total_rows(), 2)

    def test_json_reader(self):
        json_path = os.path.join(self.temp_dir, "test.json")
        data = [
            {"name": "Alice", "age": 25, "email": "alice@test.com"},
            {"name": "Bob", "age": 30, "email": "bob@test.com"},
        ]
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f)

        reader = get_reader(json_path)
        headers = reader.read_headers()
        self.assertIn("name", headers)
        self.assertIn("age", headers)

        rows = reader.read_all()
        self.assertEqual(len(rows), 2)

    def test_preview(self):
        csv_path = os.path.join(self.temp_dir, "test.csv")
        with open(csv_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["name", "age"])
            for i in range(10):
                writer.writerow([f"User{i}", str(20 + i)])

        reader = get_reader(csv_path)
        preview = reader.preview(3)
        self.assertEqual(len(preview), 3)


class TestWriter(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_csv_writer(self):
        csv_path = os.path.join(self.temp_dir, "output.csv")
        with get_writer(csv_path, headers=["name", "age"]) as writer:
            writer.write_row({"name": "Alice", "age": 25})
            writer.write_row({"name": "Bob", "age": 30})

        self.assertTrue(os.path.exists(csv_path))
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            lines = f.readlines()
            self.assertEqual(len(lines), 3)

    def test_json_writer(self):
        json_path = os.path.join(self.temp_dir, "output.json")
        with get_writer(json_path, headers=["name", "age"]) as writer:
            writer.write_row({"name": "Alice", "age": 25})
            writer.write_row({"name": "Bob", "age": 30})

        self.assertTrue(os.path.exists(json_path))
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            self.assertEqual(len(data), 2)

    def test_excel_writer(self):
        xlsx_path = os.path.join(self.temp_dir, "output.xlsx")
        with get_writer(xlsx_path, headers=["name", "age"], freeze_header=True, auto_filter=True) as writer:
            writer.write_row({"name": "Alice", "age": 25})
            writer.write_row({"name": "Bob", "age": 30})

        self.assertTrue(os.path.exists(xlsx_path))

        reader = ExcelReader(xlsx_path)
        rows = reader.read_all()
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0].data["name"], "Alice")
        self.assertEqual(rows[1].data["age"], 30)

    def test_excel_append(self):
        xlsx_path = os.path.join(self.temp_dir, "append.xlsx")
        with get_writer(xlsx_path, headers=["name"]) as writer:
            writer.write_row({"name": "First"})

        with get_writer(xlsx_path, headers=["name"], append=True) as writer:
            writer.write_row({"name": "Second"})

        reader = ExcelReader(xlsx_path)
        rows = reader.read_all()
        self.assertEqual(len(rows), 2)


class TestValidator(unittest.TestCase):
    def test_required_rule(self):
        validator = Validator()
        validator.add_required("name")

        record = Record(row_index=0, data={"name": "Alice", "age": 25})
        result = validator.validate_record(record)
        self.assertTrue(result.is_valid)

        record2 = Record(row_index=1, data={"name": "", "age": 25})
        result2 = validator.validate_record(record2)
        self.assertFalse(result2.is_valid)

    def test_email_rule(self):
        validator = Validator()
        validator.add_email("email")

        record = Record(row_index=0, data={"email": "test@example.com"})
        result = validator.validate_record(record)
        self.assertTrue(result.is_valid)

        record2 = Record(row_index=1, data={"email": "invalid-email"})
        result2 = validator.validate_record(record2)
        self.assertFalse(result2.is_valid)

    def test_range_rule(self):
        validator = Validator()
        validator.add_range("age", 0, 120)

        record = Record(row_index=0, data={"age": 25})
        result = validator.validate_record(record)
        self.assertTrue(result.is_valid)

        record2 = Record(row_index=1, data={"age": 150})
        result2 = validator.validate_record(record2)
        self.assertFalse(result2.is_valid)

    def test_chain_rules(self):
        validator = Validator()
        # Build a true chain using and_then (not two separate rules)
        rule = RequiredRule("email")
        rule.and_then(EmailRule("email"))
        validator.add_rule(rule)

        record = Record(row_index=0, data={"email": "test@example.com"})
        result = validator.validate_record(record)
        self.assertTrue(result.is_valid)

        record2 = Record(row_index=1, data={"email": ""})
        result2 = validator.validate_record(record2)
        self.assertFalse(result2.is_valid)
        # RequiredRule fails -> chain stops, exactly 1 error
        self.assertEqual(len(result2.errors), 1)


class TestMapper(unittest.TestCase):
    def test_simple_mapping(self):
        mapper = Mapper()
        mapper.add_mapping("user_name", "username")
        mapper.add_mapping("user_age", "age")

        record = Record(row_index=0, data={"user_name": "Alice", "user_age": 25})
        mapped = mapper.map_record(record)

        self.assertEqual(mapped["username"], "Alice")
        self.assertEqual(mapped["age"], 25)

    def test_transform(self):
        mapper = Mapper()
        mapper.add_mapping("price", "price", transform="divide_100")

        record = Record(row_index=0, data={"price": 1999})
        mapped = mapper.map_record(record)

        self.assertEqual(mapped["price"], 19.99)

    def test_transform_chain(self):
        mapper = Mapper()
        mapper.add_mapping("name", "name", transform=["strip", "upper"])

        record = Record(row_index=0, data={"name": "  alice  "})
        mapped = mapper.map_record(record)

        self.assertEqual(mapped["name"], "ALICE")

    def test_default_value(self):
        mapper = Mapper()
        mapper.add_mapping("status", "status", default="active")

        record = Record(row_index=0, data={})
        mapped = mapper.map_record(record)

        self.assertEqual(mapped["status"], "active")


class TestDateUtils(unittest.TestCase):
    def test_parse_date_various_formats(self):
        self.assertIsNotNone(parse_date("2024-01-01"))
        self.assertIsNotNone(parse_date("2024/01/01"))
        self.assertIsNotNone(parse_date("01-01-2024"))
        self.assertIsNotNone(parse_date("2024年01月01日"))
        self.assertIsNotNone(parse_date(1704067200))

    def test_format_date(self):
        result = format_date("2024-01-15", "%Y-%m-%d")
        self.assertEqual(result, "2024-01-15")

    def test_invalid_date(self):
        self.assertIsNone(parse_date("not-a-date"))


class TestDesensitize(unittest.TestCase):
    def test_mask_phone(self):
        self.assertEqual(mask_phone("13812345678"), "138****5678")
        self.assertEqual(mask_phone(None), None)

    def test_mask_email(self):
        self.assertIn("****", mask_email("username@example.com"))
        self.assertIn("@", mask_email("username@example.com"))

    def test_mask_id_card(self):
        self.assertEqual(mask_id_card("110101199001011234"), "110101********1234")


class TestSplitter(unittest.TestCase):
    def test_calculate_chunks(self):
        chunks = calculate_chunks(100, 30)
        self.assertEqual(len(chunks), 4)
        self.assertEqual(chunks[0], (0, 30))
        self.assertEqual(chunks[-1], (90, 100))

    def test_single_chunk(self):
        chunks = calculate_chunks(50, 100)
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0], (0, 50))

    def test_generate_file_splits(self):
        splits = generate_file_splits("/path/output.csv", 100, 30)
        self.assertEqual(len(splits), 4)
        self.assertTrue(splits[0][0].endswith("output_part1.csv"))


class TestPipeline(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_full_pipeline(self):
        input_path = os.path.join(self.temp_dir, "input.csv")
        output_path = os.path.join(self.temp_dir, "output.csv")

        with open(input_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["user_name", "user_email", "user_age", "price_cents"])
            writer.writerow(["Alice", "alice@test.com", "25", "1999"])
            writer.writerow(["Bob", "bob@test.com", "30", "2999"])
            writer.writerow(["", "invalid-email", "150", "999"])

        reader = get_reader(input_path)
        writer = get_writer(output_path)

        mapper = Mapper()
        mapper.add_mapping("user_name", "name")
        mapper.add_mapping("user_email", "email")
        mapper.add_mapping("user_age", "age", transform="to_int")
        mapper.add_mapping("price_cents", "price", transform="divide_100")

        validator = Validator()
        validator.add_required("user_name").add_email("user_email").add_range("user_age", 0, 120)

        pipeline = Pipeline(
            reader=reader,
            writer=writer,
            validator=validator,
            mapper=mapper,
            stop_on_error=False,
        )

        result = pipeline.run(batch_size=10)

        self.assertEqual(result.total_records, 3)
        self.assertEqual(result.succeeded_records, 2)
        self.assertEqual(result.failed_records, 1)
        self.assertTrue(os.path.exists(output_path))

    def test_pipeline_preview(self):
        input_path = os.path.join(self.temp_dir, "input.csv")
        with open(input_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["name", "email", "age"])
            writer.writerow(["Alice", "alice@test.com", "25"])

        reader = get_reader(input_path)
        validator = Validator()
        validator.add_email("email")

        pipeline = Pipeline(reader=reader, validator=validator)
        preview = pipeline.preview(2)

        self.assertEqual(len(preview), 1)
        self.assertTrue(preview[0]["valid"])


class TestModels(unittest.TestCase):
    def test_record_status(self):
        record = Record(row_index=0, data={"name": "test"})
        self.assertEqual(record.status, RecordStatus.PENDING)

        record.status = RecordStatus.SUCCESS
        self.assertEqual(record.status, RecordStatus.SUCCESS)

    def test_validation_result_merge(self):
        from data_io.models import ValidationResult, ValidationError

        r1 = ValidationResult()
        r2 = ValidationResult()
        r2.add_error(ValidationError(1, "field", "rule", "msg"))

        r1.merge(r2)
        self.assertFalse(r1.is_valid)
        self.assertEqual(len(r1.errors), 1)


if __name__ == "__main__":
    unittest.main()
