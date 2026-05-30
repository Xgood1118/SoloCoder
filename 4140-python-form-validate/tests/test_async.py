import pytest
import asyncio
from formvalidate import field, Schema, validate_async, validate_many_async, ValidationError


class TestAsyncCustomValidator:
    def test_async_custom_pass(self):
        async def check_unique(value):
            await asyncio.sleep(0.01)
            return value != 'taken'

        f = field('username').required().min_length(3).async_custom(check_unique)

        async def run():
            result = await f.async_validate('available')
            assert result.is_valid

        asyncio.run(run())

    def test_async_custom_fail(self):
        async def check_unique(value):
            await asyncio.sleep(0.01)
            return value != 'taken'

        f = field('username').required().async_custom(check_unique)

        async def run():
            result = await f.async_validate('taken')
            assert not result.is_valid
            assert result.errors[0].rule == 'async_custom'

        asyncio.run(run())

    def test_async_custom_with_message(self):
        async def check_unique(value):
            return value != 'taken'

        f = field('username').required().async_custom(
            check_unique, message='用户名 {value} 已被占用'
        )

        async def run():
            result = await f.async_validate('taken')
            assert not result.is_valid
            assert '已被占用' in result.errors[0].message

        asyncio.run(run())

    def test_async_custom_return_string(self):
        async def validator(value):
            return 'This value is forbidden'

        f = field('code').required().async_custom(validator)

        async def run():
            result = await f.async_validate('any')
            assert not result.is_valid
            assert result.errors[0].message == 'This value is forbidden'

        asyncio.run(run())

    def test_async_custom_exception(self):
        async def validator(value):
            raise ValueError("Database connection failed")

        f = field('code').required().async_custom(validator)

        async def run():
            result = await f.async_validate('any')
            assert not result.is_valid
            assert 'Database connection failed' in result.errors[0].message

        asyncio.run(run())

    def test_async_skip_on_sync_error(self):
        async def check_unique(value):
            return value != 'taken'

        f = field('username').required().min_length(5).async_custom(check_unique)

        async def run():
            result = await f.async_validate('Jo')
            assert not result.is_valid
            assert all(e.rule != 'async_custom' for e in result.errors)

        asyncio.run(run())


class TestAsyncSchema:
    def test_schema_async_validate(self):
        async def check_email_domain(value):
            await asyncio.sleep(0.01)
            return value.endswith('@company.com')

        schema = Schema({
            'name': field().required().min_length(2),
            'email': field().required().email().async_custom(
                check_email_domain, message='必须使用公司邮箱'
            ),
        })

        async def run():
            result = await schema.async_validate({
                'name': 'John',
                'email': 'john@company.com',
            })
            assert result.is_valid

        asyncio.run(run())

    def test_schema_async_validate_failure(self):
        async def check_email_domain(value):
            return value.endswith('@company.com')

        schema = Schema({
            'name': field().required(),
            'email': field().required().email().async_custom(
                check_email_domain, message='必须使用公司邮箱'
            ),
        })

        async def run():
            result = await schema.async_validate({
                'name': 'John',
                'email': 'john@gmail.com',
            })
            assert not result.is_valid

        asyncio.run(run())

    def test_schema_async_skip_without_async_validators(self):
        schema = Schema({
            'name': field().required(),
        })

        async def run():
            result = await schema.async_validate({'name': 'John'})
            assert result.is_valid

        asyncio.run(run())


class TestValidateAsync:
    def test_validate_async_with_field(self):
        async def check(value):
            return True

        f = field('test').required().async_custom(check)

        async def run():
            result = await validate_async(f, 'hello')
            assert result.is_valid

        asyncio.run(run())

    def test_validate_async_with_schema(self):
        schema = Schema({
            'name': field().required(),
        })

        async def run():
            result = await validate_async(schema, {'name': 'John'})
            assert result.is_valid

        asyncio.run(run())


class TestValidateManyAsync:
    def test_validate_many(self):
        f1 = field('a').required()
        f2 = field('b').required()

        async def run():
            results = await validate_many_async([
                (f1, 'hello'),
                (f2, None),
            ])
            assert results[0].is_valid
            assert not results[1].is_valid

        asyncio.run(run())
