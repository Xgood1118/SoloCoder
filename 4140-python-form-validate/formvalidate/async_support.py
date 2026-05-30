import asyncio
from .errors import ValidationError, ValidationResult
from .field import Field, _UNSET


async def validate_async(schema_or_field, data):
    if isinstance(schema_or_field, Field):
        return await schema_or_field.async_validate(data)
    return await schema_or_field.async_validate(data)


async def validate_many_async(validators_and_data):
    tasks = []
    for validator, data in validators_and_data:
        tasks.append(validator.async_validate(data))
    results = await asyncio.gather(*tasks, return_exceptions=True)
    final_results = []
    for r in results:
        if isinstance(r, Exception):
            final_results.append(ValidationResult(
                errors=[ValidationError(
                    field='', rule='async_error', message=str(r)
                )],
                cleaned_data=None,
            ))
        else:
            final_results.append(r)
    return final_results
