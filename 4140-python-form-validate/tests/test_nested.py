import pytest
from formvalidate import field, Schema, ValidationError


class TestNestedObject:
    def test_simple_nested_valid(self):
        address_schema = Schema({
            'province': field().required(),
            'city': field().required(),
            'district': field().required(),
        })
        schema = Schema({
            'name': field().required(),
            'address': field().nested(address_schema),
        })
        result = schema.validate({
            'name': 'John',
            'address': {
                'province': 'Beijing',
                'city': 'Beijing',
                'district': 'Haidian',
            }
        })
        assert result.is_valid

    def test_simple_nested_invalid(self):
        address_schema = Schema({
            'province': field().required(),
            'city': field().required(),
            'district': field().required(),
        })
        schema = Schema({
            'name': field().required(),
            'address': field().required().nested(address_schema),
        })
        result = schema.validate({
            'name': 'John',
            'address': {
                'province': 'Beijing',
                'city': '',
            }
        })
        assert not result.is_valid

    def test_nested_missing_field(self):
        address_schema = Schema({
            'province': field().required(),
            'city': field().required(),
        })
        schema = Schema({
            'address': field().required().nested(address_schema),
        })
        result = schema.validate({
            'address': {'province': 'Beijing'}
        })
        assert not result.is_valid

    def test_deeply_nested(self):
        district_schema = Schema({
            'name': field().required(),
            'code': field().required().min_length(3),
        })
        city_schema = Schema({
            'name': field().required(),
            'district': field().nested(district_schema),
        })
        province_schema = Schema({
            'name': field().required(),
            'city': field().nested(city_schema),
        })
        schema = Schema({
            'address': field().nested(province_schema),
        })
        result = schema.validate({
            'address': {
                'name': 'Beijing',
                'city': {
                    'name': 'Beijing',
                    'district': {
                        'name': 'Haidian',
                        'code': 'HD',
                    }
                }
            }
        })
        assert not result.is_valid
        error_fields = [e.field for e in result.errors]
        has_nested_error = any('code' in f for f in error_fields)
        assert has_nested_error

    def test_nested_with_none(self):
        address_schema = Schema({
            'province': field().required(),
        })
        schema = Schema({
            'address': field().nested(address_schema),
        })
        result = schema.validate({'address': None})
        assert result.is_valid

    def test_nested_required_with_none(self):
        address_schema = Schema({
            'province': field().required(),
        })
        schema = Schema({
            'address': field().required().nested(address_schema),
        })
        result = schema.validate({'address': None})
        assert not result.is_valid
        assert result.errors[0].rule == 'required'


class TestArrayValidation:
    def test_array_type_valid(self):
        f = field('tags').array()
        result = f.validate(['python', 'js'])
        assert result.is_valid

    def test_array_type_invalid(self):
        f = field('tags').array()
        result = f.validate('not a list')
        assert not result.is_valid
        assert result.errors[0].rule == 'array'

    def test_min_items_pass(self):
        f = field('tags').min_items(2)
        result = f.validate(['a', 'b'])
        assert result.is_valid

    def test_min_items_fail(self):
        f = field('tags').min_items(3)
        result = f.validate(['a', 'b'])
        assert not result.is_valid

    def test_max_items_pass(self):
        f = field('tags').max_items(5)
        result = f.validate(['a', 'b', 'c'])
        assert result.is_valid

    def test_max_items_fail(self):
        f = field('tags').max_items(3)
        result = f.validate(['a', 'b', 'c', 'd'])
        assert not result.is_valid

    def test_each_with_field_validator(self):
        f = field('tags').array().max_items(5).each(
            field().min_length(1).max_length(20)
        )
        result = f.validate(['python', 'js', 'go'])
        assert result.is_valid

    def test_each_validates_items(self):
        f = field('tags').each(
            field().min_length(3).max_length(10)
        )
        result = f.validate(['python', 'js', 'golang'])
        assert not result.is_valid

    def test_each_with_invalid_items_collects_errors(self):
        f = field('tags').each(
            field().min_length(3)
        )
        result = f.validate(['ab', 'cd', 'efg'])
        assert not result.is_valid
        error_rules = [e.rule for e in result.errors]
        assert error_rules.count('min_length') >= 2

    def test_each_with_empty_array(self):
        f = field('tags').each(
            field().min_length(1)
        )
        result = f.validate([])
        assert result.is_valid

    def test_array_with_tuple(self):
        f = field('tags').array()
        result = f.validate(('a', 'b'))
        assert result.is_valid

    def test_schema_with_array_field(self):
        schema = Schema({
            'name': field().required(),
            'tags': field().required().array().max_items(5).each(
                field().min_length(1).max_length(20)
            ),
        })
        result = schema.validate({
            'name': 'Post',
            'tags': ['python', 'web'],
        })
        assert result.is_valid

    def test_schema_with_array_field_errors(self):
        schema = Schema({
            'tags': field().required().array().max_items(2).each(
                field().min_length(3)
            ),
        })
        result = schema.validate({
            'tags': ['ab', 'python', 'go'],
        })
        assert not result.is_valid


class TestMixedNestedAndArray:
    def test_nested_with_array_field(self):
        item_schema = Schema({
            'name': field().required().min_length(1),
            'quantity': field().required().int_().min(1),
        })
        schema = Schema({
            'order_id': field().required(),
            'items': field().required().array().min_items(1).each(
                field().nested(item_schema)
            ),
        })
        result = schema.validate({
            'order_id': 'ORD-001',
            'items': [
                {'name': 'Widget', 'quantity': '3'},
                {'name': 'Gadget', 'quantity': '1'},
            ],
        })
        assert result.is_valid

    def test_nested_with_array_invalid(self):
        item_schema = Schema({
            'name': field().required().min_length(2),
            'quantity': field().required().int_().min(1),
        })
        schema = Schema({
            'items': field().required().array().each(
                field().nested(item_schema)
            ),
        })
        result = schema.validate({
            'items': [
                {'name': 'A', 'quantity': '0'},
            ],
        })
        assert not result.is_valid
