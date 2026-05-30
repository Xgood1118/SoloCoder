from .errors import ValidationError, ValidationResult
from .field import _UNSET


class Schema:
    def __init__(self, fields=None, allow_extra=False):
        self._fields = {}
        self._allow_extra = allow_extra
        if fields:
            if isinstance(fields, dict):
                for name, f in fields.items():
                    if f.name is None:
                        f.name = name
                    self._fields[name] = f

    def add_field(self, name, f):
        if f.name is None:
            f.name = name
        self._fields[name] = f
        return self

    def validate(self, data):
        if data is None:
            data = {}
        if not isinstance(data, dict):
            return ValidationResult(
                errors=[ValidationError(
                    field='',
                    rule='type',
                    message='输入数据必须是字典类型',
                    value=data,
                )],
                cleaned_data=None,
            )

        errors = []
        cleaned_data = {}

        for name, f in self._fields.items():
            value = data.get(name, _UNSET)
            if value is _UNSET:
                value = None
            result = f.validate(value)
            if result.is_valid:
                cleaned_data[name] = result.cleaned_data
            else:
                errors.extend(result.errors)
                cleaned_data[name] = result.cleaned_data

        if not self._allow_extra:
            extra_keys = set(data.keys()) - set(self._fields.keys())
            if extra_keys:
                for key in extra_keys:
                    errors.append(ValidationError(
                        field=key,
                        rule='extra_field',
                        message=f'字段 {key} 不在允许的字段列表中',
                        value=data[key],
                    ))

        return ValidationResult(errors=errors, cleaned_data=cleaned_data)

    async def async_validate(self, data):
        sync_result = self.validate(data)

        if sync_result.errors:
            return sync_result

        has_async = any(f._async_validators for f in self._fields.values())
        if not has_async:
            return sync_result

        errors = []
        for name, f in self._fields.items():
            if f._async_validators:
                value = data.get(name)
                async_result = await f.async_validate(value)
                if not async_result.is_valid:
                    errors.extend(async_result.errors)

        if errors:
            return ValidationResult(errors=errors, cleaned_data=sync_result.cleaned_data)
        return sync_result

    def field(self, name):
        return self._fields.get(name)
