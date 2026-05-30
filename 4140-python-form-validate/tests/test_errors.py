import pytest
from formvalidate import field, Schema, ValidationError, ValidationResult, MessageRegistry


class TestValidationError:
    def test_error_creation(self):
        err = ValidationError(field='name', rule='required', message='Name is required', value=None)
        assert err.field == 'name'
        assert err.rule == 'required'
        assert err.message == 'Name is required'
        assert err.value is None

    def test_error_str(self):
        err = ValidationError(field='name', rule='required', message='Name is required')
        assert str(err) == 'Name is required'

    def test_error_repr(self):
        err = ValidationError(field='name', rule='required', message='Name is required')
        assert 'name' in repr(err)
        assert 'required' in repr(err)

    def test_error_to_dict(self):
        err = ValidationError(
            field='name', rule='min_length',
            message='Too short', value='Jo', expected='min 3 chars'
        )
        d = err.to_dict()
        assert d['field'] == 'name'
        assert d['rule'] == 'min_length'
        assert d['message'] == 'Too short'
        assert d['value'] == 'Jo'
        assert d['expected'] == 'min 3 chars'

    def test_error_to_dict_minimal(self):
        err = ValidationError(field='name', rule='required', message='Required')
        d = err.to_dict()
        assert 'field' in d
        assert 'rule' in d
        assert 'message' in d
        assert 'value' not in d
        assert 'expected' not in d


class TestValidationResult:
    def test_valid_result(self):
        result = ValidationResult(errors=[], cleaned_data={'name': 'John'})
        assert result.is_valid
        assert result.cleaned_data == {'name': 'John'}

    def test_invalid_result(self):
        result = ValidationResult(
            errors=[ValidationError('name', 'required', 'Required')],
            cleaned_data=None
        )
        assert not result.is_valid

    def test_errors_for(self):
        errors = [
            ValidationError('name', 'required', 'Required'),
            ValidationError('name', 'min_length', 'Too short'),
            ValidationError('email', 'email', 'Invalid email'),
        ]
        result = ValidationResult(errors=errors)
        name_errors = result.errors_for('name')
        assert len(name_errors) == 2
        email_errors = result.errors_for('email')
        assert len(email_errors) == 1

    def test_first_error(self):
        errors = [
            ValidationError('name', 'required', 'Required'),
            ValidationError('email', 'email', 'Invalid email'),
        ]
        result = ValidationResult(errors=errors)
        assert result.first_error().field == 'name'

    def test_first_error_empty(self):
        result = ValidationResult(errors=[])
        assert result.first_error() is None

    def test_to_dict(self):
        errors = [
            ValidationError('name', 'required', 'Name is required'),
            ValidationError('name', 'min_length', 'Name too short'),
            ValidationError('email', 'email', 'Invalid email'),
        ]
        result = ValidationResult(errors=errors)
        d = result.to_dict()
        assert 'name' in d
        assert len(d['name']) == 2
        assert 'email' in d
        assert len(d['email']) == 1

    def test_merge(self):
        r1 = ValidationResult(
            errors=[ValidationError('name', 'required', 'Required')],
            cleaned_data=None,
        )
        r2 = ValidationResult(
            errors=[ValidationError('email', 'email', 'Invalid')],
            cleaned_data={'email': 'test@example.com'},
        )
        r1.merge(r2, prefix='user')
        assert len(r1.errors) == 2
        assert r1.errors[1].field == 'user.email'

    def test_repr_valid(self):
        result = ValidationResult(errors=[], cleaned_data={'name': 'John'})
        assert 'valid=True' in repr(result)

    def test_repr_invalid(self):
        result = ValidationResult(
            errors=[ValidationError('name', 'required', 'Required')]
        )
        assert 'valid=False' in repr(result)


class TestMessageRegistry:
    def test_default_messages(self):
        registry = MessageRegistry()
        msg = registry.get('required', field='name')
        assert 'name' in msg
        assert '必填' in msg

    def test_custom_message(self):
        registry = MessageRegistry()
        registry.register('required', 'Field {field} is required', locale='en')
        msg = registry.get('required', field='name')
        assert 'name' in msg

    def test_add_locale(self):
        registry = MessageRegistry()
        registry.add_locale('en', {
            'required': 'Field {field} is required',
            'email': 'Field {field} must be a valid email',
        })
        registry.set_locale('en')
        msg = registry.get('required', field='name')
        assert msg == 'Field name is required'

    def test_set_locale_fallback(self):
        registry = MessageRegistry()
        registry.set_locale('unknown')
        msg = registry.get('required', field='name')
        assert '必填' in msg

    def test_message_with_all_variables(self):
        registry = MessageRegistry()
        msg = registry.get('min_length', field='name', min_length=3, value_length=2)
        assert '3' in msg
        assert '2' in msg
        assert 'name' in msg

    def test_message_template_missing_key(self):
        registry = MessageRegistry()
        msg = registry.get('nonexistent_rule', field='test')
        assert 'nonexistent_rule' in msg

    def test_current_locale(self):
        registry = MessageRegistry()
        assert registry.current_locale() == 'zh_CN'


class TestErrorMessageContent:
    def test_error_contains_field_name(self):
        f = field('email').required().email()
        result = f.validate('bad')
        for err in result.errors:
            assert 'email' in err.message or err.field == 'email'

    def test_error_contains_actual_value(self):
        f = field('email').email()
        result = f.validate('not-email')
        assert 'not-email' in result.errors[0].message

    def test_error_contains_expected_format(self):
        f = field('age').int_().min(0)
        result = f.validate('-5')
        assert '0' in result.errors[0].message

    def test_multiple_errors_all_collected(self):
        f = field('password').required().min_length(8).regex(r'^(?=.*[A-Z])(?=.*\d).+$')
        result = f.validate('abc')
        assert len(result.errors) == 2
        error_rules = [e.rule for e in result.errors]
        assert 'min_length' in error_rules
        assert 'regex' in error_rules
