import pytest
from formvalidate.converters import to_int, to_float, to_bool, to_string, ConversionError


class TestToInt:
    def test_string_to_int(self):
        assert to_int('42') == 42

    def test_string_with_whitespace(self):
        assert to_int('  42  ') == 42

    def test_negative_string(self):
        assert to_int('-10') == -10

    def test_float_string_fails(self):
        with pytest.raises(ConversionError):
            to_int('3.14')

    def test_empty_string_fails(self):
        with pytest.raises(ConversionError):
            to_int('')

    def test_whitespace_only_fails(self):
        with pytest.raises(ConversionError):
            to_int('   ')

    def test_none_fails(self):
        with pytest.raises(ConversionError):
            to_int(None)

    def test_bool_to_int(self):
        assert to_int(True) == 1
        assert to_int(False) == 0

    def test_float_to_int(self):
        assert to_int(3.14) == 3

    def test_invalid_string_fails(self):
        with pytest.raises(ConversionError):
            to_int('abc')

    def test_zero_string(self):
        assert to_int('0') == 0


class TestToFloat:
    def test_string_to_float(self):
        assert to_float('3.14') == 3.14

    def test_string_with_whitespace(self):
        assert to_float('  3.14  ') == 3.14

    def test_int_string(self):
        assert to_float('42') == 42.0

    def test_negative_string(self):
        assert to_float('-1.5') == -1.5

    def test_empty_string_fails(self):
        with pytest.raises(ConversionError):
            to_float('')

    def test_none_fails(self):
        with pytest.raises(ConversionError):
            to_float(None)

    def test_bool_to_float(self):
        assert to_float(True) == 1.0
        assert to_float(False) == 0.0

    def test_invalid_string_fails(self):
        with pytest.raises(ConversionError):
            to_float('abc')

    def test_scientific_notation(self):
        assert to_float('1e5') == 100000.0


class TestToBool:
    def test_true_strings(self):
        for s in ['true', 'True', 'TRUE', '1', 'yes', 'Yes', 'on', 'y', 't']:
            assert to_bool(s) is True, f"Expected True for {s!r}"

    def test_false_strings(self):
        for s in ['false', 'False', 'FALSE', '0', 'no', 'No', 'off', 'n', 'f']:
            assert to_bool(s) is False, f"Expected False for {s!r}"

    def test_bool_passthrough(self):
        assert to_bool(True) is True
        assert to_bool(False) is False

    def test_int_to_bool(self):
        assert to_bool(1) is True
        assert to_bool(0) is False

    def test_float_to_bool(self):
        assert to_bool(1.0) is True
        assert to_bool(0.0) is False

    def test_whitespace_string(self):
        assert to_bool('  true  ') is True

    def test_invalid_string_fails(self):
        with pytest.raises(ConversionError):
            to_bool('maybe')

    def test_none_fails(self):
        with pytest.raises(ConversionError):
            to_bool(None)

    def test_list_fails(self):
        with pytest.raises(ConversionError):
            to_bool([1])


class TestToString:
    def test_int_to_string(self):
        assert to_string(42) == '42'

    def test_float_to_string(self):
        assert to_string(3.14) == '3.14'

    def test_none_to_empty_string(self):
        assert to_string(None) == ''

    def test_bool_to_string(self):
        assert to_string(True) == 'True'

    def test_string_passthrough(self):
        assert to_string('hello') == 'hello'


class TestConversionErrorAttributes:
    def test_error_attributes(self):
        try:
            to_int('abc')
        except ConversionError as e:
            assert e.target_type == 'int'
            assert e.value == 'abc'
            assert 'abc' in str(e)
