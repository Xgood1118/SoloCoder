import pytest
from formvalidate import field, Schema, ValidationError


class TestSchemaBasic:
    def test_simple_schema_valid(self):
        schema = Schema({
            'name': field().required().min_length(3),
            'email': field().required().email(),
        })
        result = schema.validate({
            'name': 'John',
            'email': 'john@example.com',
        })
        assert result.is_valid
        assert result.cleaned_data['name'] == 'John'
        assert result.cleaned_data['email'] == 'john@example.com'

    def test_simple_schema_invalid(self):
        schema = Schema({
            'name': field().required().min_length(3),
            'email': field().required().email(),
        })
        result = schema.validate({
            'name': 'Jo',
            'email': 'not-email',
        })
        assert not result.is_valid
        error_dict = result.to_dict()
        assert 'name' in error_dict
        assert 'email' in error_dict

    def test_schema_missing_required_field(self):
        schema = Schema({
            'name': field().required(),
            'email': field().required(),
        })
        result = schema.validate({'name': 'John'})
        assert not result.is_valid
        email_errors = result.errors_for('email')
        assert len(email_errors) > 0
        assert email_errors[0].rule == 'required'

    def test_schema_optional_field_missing(self):
        schema = Schema({
            'name': field().required(),
            'nickname': field().optional(default='Anonymous'),
        })
        result = schema.validate({'name': 'John'})
        assert result.is_valid
        assert result.cleaned_data['nickname'] == 'Anonymous'

    def test_schema_with_none_data(self):
        schema = Schema({
            'name': field().required(),
        })
        result = schema.validate(None)
        assert not result.is_valid

    def test_schema_with_empty_dict(self):
        schema = Schema({
            'name': field().required(),
        })
        result = schema.validate({})
        assert not result.is_valid

    def test_schema_extra_fields_rejected(self):
        schema = Schema({
            'name': field().required(),
        })
        result = schema.validate({'name': 'John', 'extra': 'value'})
        assert not result.is_valid
        extra_errors = result.errors_for('extra')
        assert len(extra_errors) > 0

    def test_schema_allow_extra(self):
        schema = Schema({
            'name': field().required(),
        }, allow_extra=True)
        result = schema.validate({'name': 'John', 'extra': 'value'})
        assert result.is_valid

    def test_schema_non_dict_input(self):
        schema = Schema({
            'name': field().required(),
        })
        result = schema.validate("not a dict")
        assert not result.is_valid


class TestSchemaTypeCoercion:
    def test_int_coercion_in_schema(self):
        schema = Schema({
            'age': field().required().int_().min(0).max(150),
        })
        result = schema.validate({'age': '25'})
        assert result.is_valid
        assert result.cleaned_data['age'] == 25

    def test_float_coercion_in_schema(self):
        schema = Schema({
            'score': field().required().float_().positive(),
        })
        result = schema.validate({'score': '98.5'})
        assert result.is_valid
        assert result.cleaned_data['score'] == 98.5

    def test_bool_coercion_in_schema(self):
        schema = Schema({
            'active': field().required().bool_(),
        })
        result = schema.validate({'active': 'true'})
        assert result.is_valid
        assert result.cleaned_data['active'] is True

    def test_coercion_failure_in_schema(self):
        schema = Schema({
            'age': field().required().int_(),
        })
        result = schema.validate({'age': 'not_a_number'})
        assert not result.is_valid


class TestSchemaMultipleErrors:
    def test_multiple_fields_with_errors(self):
        schema = Schema({
            'name': field().required().min_length(3),
            'email': field().required().email(),
            'age': field().required().int_().min(0),
        })
        result = schema.validate({
            'name': 'Jo',
            'email': 'bad',
            'age': '-5',
        })
        assert not result.is_valid
        assert len(result.errors) >= 3

    def test_to_dict_groups_by_field(self):
        schema = Schema({
            'name': field().required().min_length(5).email(),
        })
        result = schema.validate({'name': 'Jo'})
        error_dict = result.to_dict()
        assert 'name' in error_dict
        assert len(error_dict['name']) >= 2


class TestSchemaAddField:
    def test_add_field_dynamically(self):
        schema = Schema()
        schema.add_field('name', field().required())
        result = schema.validate({'name': 'John'})
        assert result.is_valid

    def test_add_field_with_existing_name(self):
        schema = Schema({
            'name': field().min_length(10),
        })
        schema.add_field('name', field().min_length(3))
        result = schema.validate({'name': 'Joe'})
        assert result.is_valid


class TestSchemaFieldAccess:
    def test_get_field(self):
        schema = Schema({
            'name': field().required(),
        })
        f = schema.field('name')
        assert f is not None
        assert f.name == 'name'

    def test_get_nonexistent_field(self):
        schema = Schema({
            'name': field().required(),
        })
        assert schema.field('email') is None
