import pytest
from formvalidate import field, UploadedFile, parse_size, format_size


class TestUploadedFile:
    def test_creation(self):
        f = UploadedFile('photo.jpg', 1024, 'image/jpeg')
        assert f.filename == 'photo.jpg'
        assert f.size == 1024
        assert f.content_type == 'image/jpeg'

    def test_repr(self):
        f = UploadedFile('photo.jpg', 1024, 'image/jpeg')
        assert 'photo.jpg' in repr(f)

    def test_resolution_without_pil(self):
        f = UploadedFile('photo.jpg', 1024, 'image/jpeg')
        result = f.resolution
        assert result is None or isinstance(result, tuple)

    def test_set_data(self):
        f = UploadedFile('photo.jpg', 1024, 'image/jpeg')
        f.set_data(b'\xff\xd8\xff\xe0')
        assert f._data == b'\xff\xd8\xff\xe0'


class TestFileValidation:
    def test_file_max_size_pass(self):
        f = field('avatar').file().file_max_size(1024 * 1024)
        upload = UploadedFile('photo.jpg', 512 * 1024, 'image/jpeg')
        result = f.validate(upload)
        assert result.is_valid

    def test_file_max_size_fail(self):
        f = field('avatar').file().file_max_size(1024)
        upload = UploadedFile('photo.jpg', 2048, 'image/jpeg')
        result = f.validate(upload)
        assert not result.is_valid
        assert result.errors[0].rule == 'file_max_size'

    def test_file_allowed_types_pass(self):
        f = field('avatar').file().file_allowed_types(['image/jpeg', 'image/png'])
        upload = UploadedFile('photo.jpg', 1024, 'image/jpeg')
        result = f.validate(upload)
        assert result.is_valid

    def test_file_allowed_types_fail(self):
        f = field('avatar').file().file_allowed_types(['image/jpeg', 'image/png'])
        upload = UploadedFile('doc.pdf', 1024, 'application/pdf')
        result = f.validate(upload)
        assert not result.is_valid
        assert result.errors[0].rule == 'file_allowed_types'

    def test_file_max_resolution_pass(self):
        f = field('avatar').file().file_max_resolution(1920, 1080)
        upload = UploadedFile('photo.jpg', 1024, 'image/jpeg', resolution=(800, 600))
        result = f.validate(upload)
        assert result.is_valid

    def test_file_max_resolution_fail(self):
        f = field('avatar').file().file_max_resolution(800, 600)
        upload = UploadedFile('photo.jpg', 1024, 'image/jpeg', resolution=(1920, 1080))
        result = f.validate(upload)
        assert not result.is_valid

    def test_file_min_resolution_pass(self):
        f = field('avatar').file().file_min_resolution(640, 480)
        upload = UploadedFile('photo.jpg', 1024, 'image/jpeg', resolution=(800, 600))
        result = f.validate(upload)
        assert result.is_valid

    def test_file_min_resolution_fail(self):
        f = field('avatar').file().file_min_resolution(1920, 1080)
        upload = UploadedFile('photo.jpg', 1024, 'image/jpeg', resolution=(800, 600))
        result = f.validate(upload)
        assert not result.is_valid

    def test_file_aspect_ratio_pass(self):
        f = field('avatar').file().file_aspect_ratio(1.0, 2.0)
        upload = UploadedFile('photo.jpg', 1024, 'image/jpeg', resolution=(800, 600))
        result = f.validate(upload)
        assert result.is_valid

    def test_file_aspect_ratio_fail(self):
        f = field('avatar').file().file_aspect_ratio(0.9, 1.1)
        upload = UploadedFile('photo.jpg', 1024, 'image/jpeg', resolution=(800, 600))
        result = f.validate(upload)
        assert not result.is_valid
        assert result.errors[0].rule == 'file_aspect_ratio'

    def test_file_chained_rules(self):
        f = field('avatar').file() \
            .file_max_size(5 * 1024 * 1024) \
            .file_allowed_types(['image/jpeg', 'image/png']) \
            .file_min_resolution(200, 200) \
            .file_max_resolution(4000, 4000) \
            .file_aspect_ratio(0.5, 2.0)
        upload = UploadedFile('photo.jpg', 1024 * 1024, 'image/jpeg', resolution=(800, 600))
        result = f.validate(upload)
        assert result.is_valid

    def test_file_with_non_file_value(self):
        f = field('avatar').file_max_size(1024)
        result = f.validate('not a file')
        assert result.is_valid

    def test_file_resolution_none(self):
        f = field('avatar').file().file_min_resolution(100, 100)
        upload = UploadedFile('photo.jpg', 1024, 'image/jpeg', resolution=None)
        result = f.validate(upload)
        assert not result.is_valid


class TestParseSize:
    def test_parse_bytes(self):
        assert parse_size('100B') == 100

    def test_parse_kb(self):
        assert parse_size('1KB') == 1024

    def test_parse_mb(self):
        assert parse_size('5MB') == 5 * 1024 * 1024

    def test_parse_gb(self):
        assert parse_size('1GB') == 1024 ** 3

    def test_parse_integer(self):
        assert parse_size(1024) == 1024

    def test_parse_plain_number_string(self):
        assert parse_size('1024') == 1024

    def test_parse_invalid(self):
        with pytest.raises(ValueError):
            parse_size('abc')

    def test_parse_with_whitespace(self):
        assert parse_size('  5MB  ') == 5 * 1024 * 1024


class TestFormatSize:
    def test_format_bytes(self):
        assert format_size(500) == '500B'

    def test_format_kb(self):
        assert 'KB' in format_size(2048)

    def test_format_mb(self):
        assert 'MB' in format_size(5 * 1024 * 1024)

    def test_format_gb(self):
        assert 'GB' in format_size(2 * 1024 ** 3)
