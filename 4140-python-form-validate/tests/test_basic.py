import pytest
from formvalidate import field, ValidationError


class TestFieldRequired:
    def test_required_with_none(self):
        f = field('name').required()
        result = f.validate(None)
        assert not result.is_valid
        assert len(result.errors) == 1
        assert result.errors[0].rule == 'required'
        assert result.errors[0].field == 'name'

    def test_required_with_empty_string(self):
        f = field('name').required()
        result = f.validate('')
        assert not result.is_valid
        assert result.errors[0].rule == 'required'

    def test_required_with_whitespace_only(self):
        f = field('name').required()
        result = f.validate('   ')
        assert not result.is_valid

    def test_required_with_valid_value(self):
        f = field('name').required()
        result = f.validate('John')
        assert result.is_valid
        assert result.cleaned_data == 'John'

    def test_optional_with_none(self):
        f = field('name').optional()
        result = f.validate(None)
        assert result.is_valid
        assert result.cleaned_data is None

    def test_optional_with_default(self):
        f = field('name').optional(default='Anonymous')
        result = f.validate(None)
        assert result.is_valid
        assert result.cleaned_data == 'Anonymous'

    def test_optional_with_empty_string(self):
        f = field('name').optional()
        result = f.validate('')
        assert result.is_valid

    def test_not_required_by_default(self):
        f = field('name').min_length(3)
        result = f.validate(None)
        assert result.is_valid


class TestFieldStringRules:
    def test_min_length_pass(self):
        f = field('name').min_length(3)
        result = f.validate('John')
        assert result.is_valid

    def test_min_length_fail(self):
        f = field('name').min_length(3)
        result = f.validate('Jo')
        assert not result.is_valid
        assert result.errors[0].rule == 'min_length'
        assert '3' in result.errors[0].message
        assert '2' in result.errors[0].message

    def test_max_length_pass(self):
        f = field('name').max_length(50)
        result = f.validate('John')
        assert result.is_valid

    def test_max_length_fail(self):
        f = field('name').max_length(3)
        result = f.validate('John')
        assert not result.is_valid
        assert result.errors[0].rule == 'max_length'

    def test_length_exact_pass(self):
        f = field('code').length(6)
        result = f.validate('ABC123')
        assert result.is_valid

    def test_length_exact_fail(self):
        f = field('code').length(6)
        result = f.validate('ABC')
        assert not result.is_valid
        assert result.errors[0].rule == 'length'

    def test_email_valid(self):
        f = field('email').email()
        result = f.validate('user@example.com')
        assert result.is_valid

    def test_email_invalid(self):
        f = field('email').email()
        result = f.validate('not-an-email')
        assert not result.is_valid
        assert result.errors[0].rule == 'email'

    def test_email_with_subdomain(self):
        f = field('email').email()
        result = f.validate('user@mail.example.com')
        assert result.is_valid

    def test_email_single_label_domain_rejected(self):
        f = field('email').email()
        result = f.validate('user@localhost')
        assert not result.is_valid

    def test_email_local_part_too_long(self):
        f = field('email').email()
        long_local = 'a' * 65
        result = f.validate(f'{long_local}@example.com')
        assert not result.is_valid

    def test_email_local_part_at_max_length(self):
        f = field('email').email()
        local_64 = 'a' * 64
        result = f.validate(f'{local_64}@example.com')
        assert result.is_valid

    def test_email_address_too_long(self):
        f = field('email').email()
        long_local = 'a' * 64
        long_domain = 'b' * 63 + '.' + 'c' * 63 + '.' + 'd' * 63 + '.' + 'e' * 30
        address = f'{long_local}@{long_domain}'
        if len(address) > 254:
            result = f.validate(address)
            assert not result.is_valid

    def test_email_quoted_local_part(self):
        f = field('email').email()
        result = f.validate('"user name"@example.com')
        assert result.is_valid

    def test_email_no_at_sign(self):
        f = field('email').email()
        result = f.validate('userexample.com')
        assert not result.is_valid

    def test_email_double_at(self):
        f = field('email').email()
        result = f.validate('user@@example.com')
        assert not result.is_valid

    def test_email_domain_label_too_long(self):
        f = field('email').email()
        long_label = 'a' * 64
        result = f.validate(f'user@{long_label}.com')
        assert not result.is_valid

    def test_url_valid(self):
        f = field('website').url()
        result = f.validate('https://www.example.com')
        assert result.is_valid

    def test_url_invalid(self):
        f = field('website').url()
        result = f.validate('not a url')
        assert not result.is_valid

    def test_url_with_path(self):
        f = field('website').url()
        result = f.validate('http://example.com/path/to/page')
        assert result.is_valid

    def test_alpha_pass(self):
        f = field('name').alpha()
        result = f.validate('Hello')
        assert result.is_valid

    def test_alpha_fail(self):
        f = field('name').alpha()
        result = f.validate('Hello123')
        assert not result.is_valid

    def test_alphanum_pass(self):
        f = field('code').alphanum()
        result = f.validate('ABC123')
        assert result.is_valid

    def test_alphanum_fail(self):
        f = field('code').alphanum()
        result = f.validate('ABC-123')
        assert not result.is_valid

    def test_username_pass(self):
        f = field('username').username()
        result = f.validate('user_name123')
        assert result.is_valid

    def test_username_fail(self):
        f = field('username').username()
        result = f.validate('user-name')
        assert not result.is_valid

    def test_phone_valid_cn(self):
        f = field('phone').phone()
        result = f.validate('13812345678')
        assert result.is_valid

    def test_phone_invalid_cn(self):
        f = field('phone').phone()
        result = f.validate('12345678901')
        assert not result.is_valid

    def test_phone_custom_pattern(self):
        f = field('phone').phone(r'^\d{3}-\d{4}$')
        result = f.validate('123-4567')
        assert result.is_valid

    def test_contains_pass(self):
        f = field('bio').contains('Python')
        result = f.validate('I love Python!')
        assert result.is_valid

    def test_contains_fail(self):
        f = field('bio').contains('Python')
        result = f.validate('I love Java!')
        assert not result.is_valid

    def test_not_contains_pass(self):
        f = field('bio').not_contains('spam')
        result = f.validate('Hello world')
        assert result.is_valid

    def test_not_contains_fail(self):
        f = field('bio').not_contains('spam')
        result = f.validate('This is spam')
        assert not result.is_valid

    def test_starts_with_pass(self):
        f = field('code').starts_with('PRE')
        result = f.validate('PRE-001')
        assert result.is_valid

    def test_starts_with_fail(self):
        f = field('code').starts_with('PRE')
        result = f.validate('POST-001')
        assert not result.is_valid

    def test_ends_with_pass(self):
        f = field('file').ends_with('.py')
        result = f.validate('module.py')
        assert result.is_valid

    def test_ends_with_fail(self):
        f = field('file').ends_with('.py')
        result = f.validate('module.js')
        assert not result.is_valid


class TestFieldRegex:
    def test_custom_regex_pass(self):
        f = field('code').regex(r'^\d{4}-\d{2}$')
        result = f.validate('2024-01')
        assert result.is_valid

    def test_custom_regex_fail(self):
        f = field('code').regex(r'^\d{4}-\d{2}$')
        result = f.validate('24-1')
        assert not result.is_valid
        assert result.errors[0].rule == 'regex'

    def test_password_complexity(self):
        f = field('password').regex(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$')
        assert f.validate('Abc123').is_valid
        assert not f.validate('abc123').is_valid
        assert not f.validate('ABC123').is_valid
        assert not f.validate('Abcdef').is_valid


class TestFieldNumericRules:
    def test_min_pass(self):
        f = field('age').int_().min(0)
        result = f.validate('25')
        assert result.is_valid
        assert result.cleaned_data == 25

    def test_min_fail(self):
        f = field('age').int_().min(0)
        result = f.validate('-1')
        assert not result.is_valid
        assert result.errors[0].rule == 'min'

    def test_max_pass(self):
        f = field('age').int_().max(150)
        result = f.validate('100')
        assert result.is_valid

    def test_max_fail(self):
        f = field('age').int_().max(150)
        result = f.validate('200')
        assert not result.is_valid

    def test_range_pass(self):
        f = field('age').int_().range(0, 150)
        result = f.validate('25')
        assert result.is_valid

    def test_range_fail_low(self):
        f = field('age').int_().range(0, 150)
        result = f.validate('-1')
        assert not result.is_valid

    def test_range_fail_high(self):
        f = field('age').int_().range(0, 150)
        result = f.validate('200')
        assert not result.is_valid

    def test_positive_pass(self):
        f = field('score').float_().positive()
        result = f.validate('3.14')
        assert result.is_valid

    def test_positive_fail_zero(self):
        f = field('score').float_().positive()
        result = f.validate('0')
        assert not result.is_valid

    def test_negative_pass(self):
        f = field('debt').float_().negative()
        result = f.validate('-100.5')
        assert result.is_valid

    def test_negative_fail_positive(self):
        f = field('debt').float_().negative()
        result = f.validate('50')
        assert not result.is_valid


class TestFieldChoiceRules:
    def test_one_of_pass(self):
        f = field('color').one_of(['red', 'green', 'blue'])
        result = f.validate('red')
        assert result.is_valid

    def test_one_of_fail(self):
        f = field('color').one_of(['red', 'green', 'blue'])
        result = f.validate('yellow')
        assert not result.is_valid
        assert result.errors[0].rule == 'one_of'

    def test_not_in_pass(self):
        f = field('username').not_in(['admin', 'root', 'system'])
        result = f.validate('john')
        assert result.is_valid

    def test_not_in_fail(self):
        f = field('username').not_in(['admin', 'root', 'system'])
        result = f.validate('admin')
        assert not result.is_valid


class TestFieldEqualityRules:
    def test_equals_pass(self):
        f = field('answer').equals(42)
        result = f.validate(42)
        assert result.is_valid

    def test_equals_fail(self):
        f = field('answer').equals(42)
        result = f.validate(43)
        assert not result.is_valid

    def test_not_equals_pass(self):
        f = field('status').not_equals('banned')
        result = f.validate('active')
        assert result.is_valid

    def test_not_equals_fail(self):
        f = field('status').not_equals('banned')
        result = f.validate('banned')
        assert not result.is_valid


class TestFieldChaining:
    def test_chain_multiple_rules_all_pass(self):
        f = field('name').required().min_length(3).max_length(50).alphanum()
        result = f.validate('John123')
        assert result.is_valid
        assert result.cleaned_data == 'John123'

    def test_chain_multiple_rules_collects_all_errors(self):
        f = field('name').required().min_length(5).max_length(3)
        result = f.validate('')
        assert not result.is_valid
        error_rules = [e.rule for e in result.errors]
        assert 'required' in error_rules
        assert 'min_length' in error_rules

    def test_chain_min_max_both_fail(self):
        f = field('name').min_length(8).max_length(5)
        result = f.validate('abcdef')
        assert not result.is_valid
        error_rules = [e.rule for e in result.errors]
        assert 'min_length' in error_rules
        assert 'max_length' in error_rules
        assert len(result.errors) == 2

    def test_chain_email_and_length(self):
        f = field('email').required().min_length(5).max_length(100).email()
        result = f.validate('ab')
        assert not result.is_valid
        error_rules = [e.rule for e in result.errors]
        assert 'min_length' in error_rules
        assert 'email' in error_rules

    def test_chain_with_coercion(self):
        f = field('age').required().int_().min(0).max(150)
        result = f.validate('25')
        assert result.is_valid
        assert result.cleaned_data == 25

    def test_chain_with_coercion_failure(self):
        f = field('age').required().int_().min(0).max(150)
        result = f.validate('abc')
        assert not result.is_valid
        assert result.errors[0].rule == 'int_type'

    def test_chain_required_and_other_rules_missing_value(self):
        f = field('email').required().email().min_length(5)
        result = f.validate(None)
        assert not result.is_valid
        assert len(result.errors) == 1
        assert result.errors[0].rule == 'required'

    def test_chain_required_and_other_rules_empty_string(self):
        f = field('email').required().email().min_length(5)
        result = f.validate('')
        assert not result.is_valid
        error_rules = [e.rule for e in result.errors]
        assert 'required' in error_rules
        assert 'min_length' in error_rules


class TestFieldTrim:
    def test_trim_strips_whitespace(self):
        f = field('name').trim().min_length(3)
        result = f.validate('  John  ')
        assert result.is_valid
        assert result.cleaned_data == 'John'

    def test_trim_with_required(self):
        f = field('name').trim().required()
        result = f.validate('   John   ')
        assert result.is_valid
        assert result.cleaned_data == 'John'


class TestFieldCustomMessage:
    def test_custom_message_override(self):
        f = field('name').required().custom_message('required', '请填写姓名')
        result = f.validate(None)
        assert not result.is_valid
        assert result.errors[0].message == '请填写姓名'

    def test_custom_message_with_template(self):
        f = field('name').min_length(3).custom_message(
            'min_length', '{field} 至少需要 {min_length} 个字符'
        )
        result = f.validate('Jo')
        assert not result.is_valid
        assert '至少需要 3 个字符' in result.errors[0].message


class TestFieldCustomValidator:
    def test_custom_validator_return_false(self):
        f = field('code').custom(lambda v: v.startswith('PRE'))
        result = f.validate('ABC')
        assert not result.is_valid

    def test_custom_validator_pass(self):
        f = field('code').custom(lambda v: v.startswith('PRE'))
        result = f.validate('PRE-001')
        assert result.is_valid

    def test_custom_validator_return_string(self):
        f = field('code').custom(lambda v: 'invalid code' if len(v) < 3 else None)
        result = f.validate('AB')
        assert not result.is_valid
        assert result.errors[0].message == 'invalid code'

    def test_custom_validator_with_message(self):
        f = field('code').custom(
            lambda v: v == 'secret',
            message='{field} 代码不正确'
        )
        result = f.validate('wrong')
        assert not result.is_valid
        assert '代码不正确' in result.errors[0].message
