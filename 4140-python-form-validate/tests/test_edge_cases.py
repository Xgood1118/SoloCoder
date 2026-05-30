import pytest
from formvalidate import field, Schema, ValidationError, RegexCache


class TestEmptyString:
    def test_required_empty_string(self):
        f = field('name').required()
        result = f.validate('')
        assert not result.is_valid

    def test_optional_empty_string(self):
        f = field('name').optional()
        result = f.validate('')
        assert result.is_valid

    def test_min_length_empty_string(self):
        f = field('name').required().min_length(1)
        result = f.validate('')
        assert not result.is_valid

    def test_min_length_empty_string_without_required(self):
        f = field('name').min_length(1)
        result = f.validate('')
        # Without required(), empty string still runs through validators.
        # min_length(1) fails because len('') = 0 < 1 (correct RFC-compliant behavior)
        assert not result.is_valid


class TestVeryLongInput:
    def test_max_length_with_long_input(self):
        f = field('bio').max_length(1000)
        long_string = 'A' * 1001
        result = f.validate(long_string)
        assert not result.is_valid

    def test_regex_with_long_input(self):
        f = field('data').regex(r'^[a-z]+$')
        long_string = 'a' * 10000
        result = f.validate(long_string)
        assert result.is_valid


class TestXSSCharacters:
    def test_xss_script_tag(self):
        f = field('comment').min_length(1).max_length(500)
        result = f.validate('<script>alert("xss")</script>')
        assert result.is_valid  # validator doesn't sanitize, just validates

    def test_xss_in_email(self):
        f = field('email').email()
        result = f.validate('<script>@example.com')
        assert not result.is_valid

    def test_html_entities(self):
        f = field('name').min_length(1)
        result = f.validate('&lt;script&gt;')
        assert result.is_valid


class TestUnicodeSpecialCharacters:
    def test_chinese_characters(self):
        f = field('name').required().min_length(2)
        result = f.validate('张三')
        assert result.is_valid

    def test_emoji_in_field(self):
        f = field('message').min_length(1)
        result = f.validate('Hello 👋 World 🌍')
        assert result.is_valid

    def test_unicode_in_email(self):
        f = field('email').email()
        result = f.validate('用户@example.com')
        assert not result.is_valid

    def test_japanese_characters(self):
        f = field('name').min_length(1)
        result = f.validate('ヤマダ')
        assert result.is_valid

    def test_zero_width_characters(self):
        f = field('name').min_length(3)
        result = f.validate('a\u200bb\u200bc')
        assert result.is_valid


class TestTypeMismatch:
    def test_list_where_string_expected(self):
        f = field('name').min_length(3)
        result = f.validate([1, 2, 3])
        assert result.is_valid  # list has length

    def test_dict_where_string_expected(self):
        f = field('name').min_length(3)
        result = f.validate({'a': 1, 'b': 2})
        assert not result.is_valid  # dict has length 2 < 3

    def test_int_where_string_expected(self):
        f = field('name').email()
        result = f.validate(12345)
        assert not result.is_valid

    def test_numeric_rules_on_string(self):
        f = field('age').min(0)
        result = f.validate('25')
        assert not result.is_valid  # string is not numeric type


class TestNestedObjectEdgeCases:
    def test_missing_nested_object(self):
        address_schema = Schema({
            'city': field().required(),
        })
        schema = Schema({
            'address': field().nested(address_schema),
        })
        result = schema.validate({})
        assert result.is_valid  # address is optional

    def test_nested_object_not_dict(self):
        address_schema = Schema({
            'city': field().required(),
        })
        schema = Schema({
            'address': field().nested(address_schema),
        })
        result = schema.validate({'address': 'not a dict'})
        assert result.is_valid  # nested validation skipped for non-dict

    def test_deeply_missing_nested(self):
        inner = Schema({'val': field().required()})
        schema = Schema({'outer': field().nested(inner)})
        result = schema.validate({'outer': {}})
        assert not result.is_valid


class TestChineseEnglishPunctuation:
    def test_chinese_comma_in_field(self):
        f = field('name').min_length(2)
        result = f.validate('张，三')
        assert result.is_valid

    def test_chinese_period(self):
        f = field('sentence').min_length(1)
        result = f.validate('你好。')
        assert result.is_valid

    def test_mixed_punctuation(self):
        f = field('text').min_length(1)
        result = f.validate('Hello, 世界！')
        assert result.is_valid


class TestRegexCache:
    def test_cache_returns_same_compiled(self):
        cache = RegexCache()
        r1 = cache.get(r'^\d+$')
        r2 = cache.get(r'^\d+$')
        assert r1 is r2

    def test_cache_different_patterns(self):
        cache = RegexCache()
        r1 = cache.get(r'^\d+$')
        r2 = cache.get(r'^[a-z]+$')
        assert r1 is not r2

    def test_cache_clear(self):
        cache = RegexCache()
        cache.get(r'^\d+$')
        assert cache.size() > 0
        cache.clear()
        assert cache.size() == 0

    def test_cache_with_flags(self):
        cache = RegexCache()
        import re
        r1 = cache.get(r'^test$', re.IGNORECASE)
        r2 = cache.get(r'^test$')
        assert r1 is not r2


class TestBooleanCoercionVariants:
    def test_various_true_forms(self):
        f = field('active').bool_()
        for val in ['true', 'True', 'TRUE', '1', 'yes', 'on', 'y', 't']:
            result = f.validate(val)
            assert result.is_valid, f"Failed for {val!r}"
            assert result.cleaned_data is True, f"Failed for {val!r}"

    def test_various_false_forms(self):
        f = field('active').bool_()
        for val in ['false', 'False', 'FALSE', '0', 'no', 'off', 'n', 'f']:
            result = f.validate(val)
            assert result.is_valid, f"Failed for {val!r}"
            assert result.cleaned_data is False, f"Failed for {val!r}"


class TestEdgeCasesInSchema:
    def test_schema_with_all_optional_fields(self):
        schema = Schema({
            'a': field().optional(),
            'b': field().optional(),
        })
        result = schema.validate({})
        assert result.is_valid

    def test_schema_with_mixed_coercion(self):
        schema = Schema({
            'name': field().required().string(),
            'age': field().required().int_().min(0).max(150),
            'score': field().required().float_().positive(),
            'active': field().required().bool_(),
        })
        result = schema.validate({
            'name': 'John',
            'age': '25',
            'score': '98.5',
            'active': 'true',
        })
        assert result.is_valid
        assert result.cleaned_data['age'] == 25
        assert result.cleaned_data['score'] == 98.5
        assert result.cleaned_data['active'] is True

    def test_none_value_in_non_required_field(self):
        schema = Schema({
            'name': field().optional().min_length(3),
        })
        result = schema.validate({'name': None})
        assert result.is_valid

    def test_empty_list_validation(self):
        f = field('tags').array().min_items(1)
        result = f.validate([])
        assert not result.is_valid

    def test_numeric_boundary_values(self):
        f = field('age').int_().range(0, 150)
        assert f.validate('0').is_valid
        assert f.validate('150').is_valid
        assert not f.validate('-1').is_valid
        assert not f.validate('151').is_valid
