import re
from .cache import RegexCache
from .converters import to_int, to_float, to_bool, to_string, ConversionError
from .errors import ValidationError, ValidationResult
from .messages import get_message_registry


_UNSET = object()

_EMAIL_LOCAL_UNQUOTED = r"[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+"
_EMAIL_LOCAL_QUOTED = r'"(?:[^"\\]|\\.)*"'
_EMAIL_LOCAL = r"(?:" + _EMAIL_LOCAL_UNQUOTED + r"|" + _EMAIL_LOCAL_QUOTED + r")"
_EMAIL_DOMAIN_LABEL = r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
_EMAIL_DOMAIN = r"(?:" + _EMAIL_DOMAIN_LABEL + r"\.)+" + _EMAIL_DOMAIN_LABEL
_EMAIL_RE = r"^" + _EMAIL_LOCAL + r"@" + _EMAIL_DOMAIN + r"$"
_EMAIL_LOCAL_MAX = 64
_EMAIL_ADDRESS_MAX = 254
_URL_RE = r"^https?://(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)(?::\d{1,5})?(?:/[^\s]*)?$"
_ALPHA_RE = r"^[a-zA-Z]+$"
_ALPHANUM_RE = r"^[a-zA-Z0-9]+$"
_USERNAME_RE = r"^[a-zA-Z0-9_]+$"
_PHONE_CN_RE = r"^1[3-9]\d{9}$"


class Field:
    def __init__(self, name=None):
        self._name = name
        self._validators = []
        self._is_required = False
        self._coerce_fn = None
        self._coerce_error_key = None
        self._default = _UNSET
        self._should_trim = False
        self._custom_messages = {}
        self._nested_schema = None
        self._each_validator = None
        self._async_validators = []

    def _make_error(self, rule, context):
        if rule in self._custom_messages:
            template = self._custom_messages[rule]
            try:
                message = template.format(**context)
            except KeyError:
                message = template
        else:
            message = get_message_registry().get(rule, **context)
        return ValidationError(
            field=self._name or '',
            rule=rule,
            message=message,
            value=context.get('value'),
            expected=context.get('expected'),
        )

    def _ctx(self, value, **extra):
        ctx = {'field': self._name or '', 'value': value}
        ctx.update(extra)
        return ctx

    def required(self):
        self._is_required = True

        def _validate(value, ctx):
            if value is None:
                return self._make_error('required', ctx)
            if isinstance(value, str) and value.strip() == '':
                return self._make_error('required', ctx)
            return None
        self._validators.append(('required', _validate))
        return self

    def optional(self, default=_UNSET):
        self._is_required = False
        self._default = default
        return self

    def default(self, value):
        self._default = value
        return self

    def trim(self):
        self._should_trim = True
        return self

    def custom_message(self, rule, message):
        self._custom_messages[rule] = message
        return self

    def int_(self):
        self._coerce_fn = to_int
        self._coerce_error_key = 'int_type'
        return self

    def integer(self):
        return self.int_()

    def float_(self):
        self._coerce_fn = to_float
        self._coerce_error_key = 'float_type'
        return self

    def floating(self):
        return self.float_()

    def bool_(self):
        self._coerce_fn = to_bool
        self._coerce_error_key = 'bool_type'
        return self

    def boolean(self):
        return self.bool_()

    def string(self):
        def _validate_string(value, ctx):
            if not isinstance(value, str):
                return self._make_error('string_type', self._ctx(value))
            return None
        self._validators.append(('string_type', _validate_string))
        return self

    def min_length(self, n):
        def _validate(value, ctx):
            try:
                length = len(value)
            except TypeError:
                return self._make_error('not_string', self._ctx(value))
            if length < n:
                return self._make_error('min_length', self._ctx(value, min_length=n, value_length=length))
            return None
        self._validators.append(('min_length', _validate))
        return self

    def max_length(self, n):
        def _validate(value, ctx):
            try:
                length = len(value)
            except TypeError:
                return self._make_error('not_string', self._ctx(value))
            if length > n:
                return self._make_error('max_length', self._ctx(value, max_length=n, value_length=length))
            return None
        self._validators.append(('max_length', _validate))
        return self

    def length(self, n):
        def _validate(value, ctx):
            try:
                actual = len(value)
            except TypeError:
                return self._make_error('not_string', self._ctx(value))
            if actual != n:
                return self._make_error('length', self._ctx(value, exact_length=n, value_length=actual))
            return None
        self._validators.append(('length', _validate))
        return self

    def email(self):
        compiled = RegexCache.get_instance().get(_EMAIL_RE, re.IGNORECASE)

        def _validate(value, ctx):
            if not isinstance(value, str):
                return self._make_error('not_string', self._ctx(value))
            if len(value) > _EMAIL_ADDRESS_MAX:
                return self._make_error('email', self._ctx(value))
            at_idx = value.rfind('@')
            if at_idx < 1:
                return self._make_error('email', self._ctx(value))
            local_part = value[:at_idx]
            if len(local_part) > _EMAIL_LOCAL_MAX:
                return self._make_error('email', self._ctx(value))
            # RFC 5321 Section 4.1: dot-atom-local cannot contain adjacent dots
            # or start/end with a dot
            if '..' in local_part or local_part.startswith('.') or local_part.endswith('.'):
                return self._make_error('email', self._ctx(value))
            if not compiled.match(value):
                return self._make_error('email', self._ctx(value))
            return None
        self._validators.append(('email', _validate))
        return self

    def url(self):
        compiled = RegexCache.get_instance().get(_URL_RE, re.IGNORECASE)

        def _validate(value, ctx):
            if not isinstance(value, str):
                return self._make_error('not_string', self._ctx(value))
            if not compiled.match(value):
                return self._make_error('url', self._ctx(value))
            return None
        self._validators.append(('url', _validate))
        return self

    def regex(self, pattern, flags=0):
        compiled = RegexCache.get_instance().get(pattern, flags)

        def _validate(value, ctx):
            if not isinstance(value, str):
                return self._make_error('not_string', self._ctx(value))
            if not compiled.match(value):
                return self._make_error('regex', self._ctx(value, pattern=pattern))
            return None
        self._validators.append(('regex', _validate))
        return self

    def alpha(self):
        compiled = RegexCache.get_instance().get(_ALPHA_RE)

        def _validate(value, ctx):
            if not isinstance(value, str):
                return self._make_error('not_string', self._ctx(value))
            if not compiled.match(value):
                return self._make_error('alpha', self._ctx(value))
            return None
        self._validators.append(('alpha', _validate))
        return self

    def alphanum(self):
        compiled = RegexCache.get_instance().get(_ALPHANUM_RE)

        def _validate(value, ctx):
            if not isinstance(value, str):
                return self._make_error('not_string', self._ctx(value))
            if not compiled.match(value):
                return self._make_error('alphanum', self._ctx(value))
            return None
        self._validators.append(('alphanum', _validate))
        return self

    def username(self):
        compiled = RegexCache.get_instance().get(_USERNAME_RE)

        def _validate(value, ctx):
            if not isinstance(value, str):
                return self._make_error('not_string', self._ctx(value))
            if not compiled.match(value):
                return self._make_error('username', self._ctx(value))
            return None
        self._validators.append(('username', _validate))
        return self

    def phone(self, pattern=None):
        actual_pattern = pattern or _PHONE_CN_RE
        compiled = RegexCache.get_instance().get(actual_pattern)

        def _validate(value, ctx):
            if not isinstance(value, str):
                return self._make_error('not_string', self._ctx(value))
            if not compiled.match(value):
                return self._make_error('phone', self._ctx(value))
            return None
        self._validators.append(('phone', _validate))
        return self

    def min(self, n):
        def _validate(value, ctx):
            if not isinstance(value, (int, float)):
                return self._make_error('not_numeric', self._ctx(value))
            if value < n:
                return self._make_error('min', self._ctx(value, min_value=n))
            return None
        self._validators.append(('min', _validate))
        return self

    def max(self, n):
        def _validate(value, ctx):
            if not isinstance(value, (int, float)):
                return self._make_error('not_numeric', self._ctx(value))
            if value > n:
                return self._make_error('max', self._ctx(value, max_value=n))
            return None
        self._validators.append(('max', _validate))
        return self

    def range(self, min_val, max_val):
        def _validate(value, ctx):
            if not isinstance(value, (int, float)):
                return self._make_error('not_numeric', self._ctx(value))
            if value < min_val or value > max_val:
                return self._make_error('range', self._ctx(value, min_value=min_val, max_value=max_val))
            return None
        self._validators.append(('range', _validate))
        return self

    def positive(self):
        def _validate(value, ctx):
            if not isinstance(value, (int, float)):
                return self._make_error('not_numeric', self._ctx(value))
            if value <= 0:
                return self._make_error('positive', self._ctx(value))
            return None
        self._validators.append(('positive', _validate))
        return self

    def negative(self):
        def _validate(value, ctx):
            if not isinstance(value, (int, float)):
                return self._make_error('not_numeric', self._ctx(value))
            if value >= 0:
                return self._make_error('negative', self._ctx(value))
            return None
        self._validators.append(('negative', _validate))
        return self

    def one_of(self, choices):
        choices_list = list(choices)

        def _validate(value, ctx):
            if value not in choices_list:
                return self._make_error('one_of', self._ctx(value, choices=choices_list))
            return None
        self._validators.append(('one_of', _validate))
        return self

    def not_in(self, choices):
        choices_list = list(choices)

        def _validate(value, ctx):
            if value in choices_list:
                return self._make_error('not_in', self._ctx(value, choices=choices_list))
            return None
        self._validators.append(('not_in', _validate))
        return self

    def equals(self, expected):
        def _validate(value, ctx):
            if value != expected:
                return self._make_error('equals', self._ctx(value, expected=expected))
            return None
        self._validators.append(('equals', _validate))
        return self

    def not_equals(self, forbidden):
        def _validate(value, ctx):
            if value == forbidden:
                return self._make_error('not_equals', self._ctx(value, forbidden=forbidden))
            return None
        self._validators.append(('not_equals', _validate))
        return self

    def contains(self, substring):
        def _validate(value, ctx):
            if not isinstance(value, str):
                return self._make_error('not_string', self._ctx(value))
            if substring not in value:
                return self._make_error('contains', self._ctx(value, substring=substring))
            return None
        self._validators.append(('contains', _validate))
        return self

    def not_contains(self, substring):
        def _validate(value, ctx):
            if not isinstance(value, str):
                return self._make_error('not_string', self._ctx(value))
            if substring in value:
                return self._make_error('not_contains', self._ctx(value, substring=substring))
            return None
        self._validators.append(('not_contains', _validate))
        return self

    def starts_with(self, prefix):
        def _validate(value, ctx):
            if not isinstance(value, str):
                return self._make_error('not_string', self._ctx(value))
            if not value.startswith(prefix):
                return self._make_error('starts_with', self._ctx(value, prefix=prefix))
            return None
        self._validators.append(('starts_with', _validate))
        return self

    def ends_with(self, suffix):
        def _validate(value, ctx):
            if not isinstance(value, str):
                return self._make_error('not_string', self._ctx(value))
            if not value.endswith(suffix):
                return self._make_error('ends_with', self._ctx(value, suffix=suffix))
            return None
        self._validators.append(('ends_with', _validate))
        return self

    def nested(self, schema):
        self._nested_schema = schema
        return self

    def array(self):
        def _validate(value, ctx):
            if not isinstance(value, (list, tuple)):
                return self._make_error('array', self._ctx(value))
            return None
        self._validators.append(('array', _validate))
        return self

    def min_items(self, n):
        def _validate(value, ctx):
            if not isinstance(value, (list, tuple)):
                return self._make_error('array', self._ctx(value))
            if len(value) < n:
                return self._make_error('min_items', self._ctx(value, min_items=n, actual_count=len(value)))
            return None
        self._validators.append(('min_items', _validate))
        return self

    def max_items(self, n):
        def _validate(value, ctx):
            if not isinstance(value, (list, tuple)):
                return self._make_error('array', self._ctx(value))
            if len(value) > n:
                return self._make_error('max_items', self._ctx(value, max_items=n, actual_count=len(value)))
            return None
        self._validators.append(('max_items', _validate))
        return self

    def each(self, validator):
        self._each_validator = validator
        return self

    def custom(self, fn, message=None, rule_name='custom'):
        def _validate(value, ctx):
            try:
                result = fn(value)
                if result is False:
                    if message:
                        error_msg = message.format(**ctx)
                    else:
                        error_msg = get_message_registry().get(rule_name, **ctx)
                    return ValidationError(
                        field=self._name or '',
                        rule=rule_name,
                        message=error_msg,
                        value=value,
                    )
                if isinstance(result, str):
                    return ValidationError(
                        field=self._name or '',
                        rule=rule_name,
                        message=result,
                        value=value,
                    )
                if isinstance(result, ValidationError):
                    return result
            except Exception as e:
                return ValidationError(
                    field=self._name or '',
                    rule=rule_name,
                    message=str(e),
                    value=value,
                )
            return None
        self._validators.append((rule_name, _validate))
        return self

    def async_custom(self, fn, message=None, rule_name='async_custom'):
        self._async_validators.append({
            'fn': fn,
            'message': message,
            'rule_name': rule_name,
        })
        return self

    def file(self):
        from .file_rules import UploadedFile

        def _validate(value, ctx):
            if not isinstance(value, UploadedFile):
                return self._make_error('custom', self._ctx(value))
            return None
        self._validators.append(('file', _validate))
        return self

    def file_max_size(self, max_bytes):
        from .file_rules import UploadedFile, format_size

        def _validate(value, ctx):
            if not isinstance(value, UploadedFile):
                return None
            if value.size > max_bytes:
                return self._make_error('file_max_size', self._ctx(
                    value, max_size=format_size(max_bytes), actual_size=format_size(value.size)
                ))
            return None
        self._validators.append(('file_max_size', _validate))
        return self

    def file_allowed_types(self, allowed_types):
        from .file_rules import UploadedFile

        allowed = list(allowed_types)

        def _validate(value, ctx):
            if not isinstance(value, UploadedFile):
                return None
            if value.content_type not in allowed:
                return self._make_error('file_allowed_types', self._ctx(
                    value, allowed_types=allowed, content_type=value.content_type
                ))
            return None
        self._validators.append(('file_allowed_types', _validate))
        return self

    def file_min_resolution(self, min_width, min_height):
        from .file_rules import UploadedFile

        def _validate(value, ctx):
            if not isinstance(value, UploadedFile):
                return None
            w, h = value.resolution or (0, 0)
            if w < min_width or h < min_height:
                return self._make_error('file_min_resolution', self._ctx(
                    value, width=w, height=h, min_width=min_width, min_height=min_height
                ))
            return None
        self._validators.append(('file_min_resolution', _validate))
        return self

    def file_max_resolution(self, max_width, max_height):
        from .file_rules import UploadedFile

        def _validate(value, ctx):
            if not isinstance(value, UploadedFile):
                return None
            w, h = value.resolution or (0, 0)
            if w > max_width or h > max_height:
                return self._make_error('file_max_resolution', self._ctx(
                    value, width=w, height=h, max_width=max_width, max_height=max_height
                ))
            return None
        self._validators.append(('file_max_resolution', _validate))
        return self

    def file_aspect_ratio(self, min_ratio, max_ratio):
        from .file_rules import UploadedFile

        def _validate(value, ctx):
            if not isinstance(value, UploadedFile):
                return None
            w, h = value.resolution or (0, 0)
            if h == 0:
                return self._make_error('file_aspect_ratio', self._ctx(
                    value, ratio=0, min_ratio=min_ratio, max_ratio=max_ratio
                ))
            ratio = w / h
            if ratio < min_ratio or ratio > max_ratio:
                return self._make_error('file_aspect_ratio', self._ctx(
                    value, ratio=round(ratio, 2), min_ratio=min_ratio, max_ratio=max_ratio
                ))
            return None
        self._validators.append(('file_aspect_ratio', _validate))
        return self

    def validate(self, value):
        errors = []
        ctx = self._ctx(value)

        if value is None:
            for rule_name, validator_fn in self._validators:
                if rule_name == 'required':
                    result = validator_fn(value, ctx)
                    if result is not None:
                        if isinstance(result, list):
                            errors.extend(result)
                        else:
                            errors.append(result)
            default = self._default if self._default is not _UNSET else None
            return ValidationResult(errors=errors, cleaned_data=default)

        current_value = value

        if self._should_trim and isinstance(current_value, str):
            current_value = current_value.strip()
            ctx['value'] = current_value

        if self._coerce_fn is not None:
            try:
                current_value = self._coerce_fn(current_value)
                ctx['value'] = current_value
            except ConversionError:
                errors.append(self._make_error(self._coerce_error_key, ctx))
                return ValidationResult(errors=errors, cleaned_data=None)

        for rule_name, validator_fn in self._validators:
            result = validator_fn(current_value, ctx)
            if result is not None:
                if isinstance(result, list):
                    errors.extend(result)
                else:
                    errors.append(result)

        if self._nested_schema is not None and isinstance(current_value, dict):
            nested_result = self._nested_schema.validate(current_value)
            if not nested_result.is_valid:
                prefix = self._name or ''
                for err in nested_result.errors:
                    nested_field = f"{prefix}.{err.field}" if prefix else err.field
                    errors.append(ValidationError(
                        field=nested_field,
                        rule=err.rule,
                        message=err.message,
                        value=err.value,
                        expected=err.expected,
                    ))
                return ValidationResult(errors=errors, cleaned_data=current_value)
            current_value = nested_result.cleaned_data

        if self._each_validator is not None and isinstance(current_value, (list, tuple)):
            cleaned_items = []
            for i, item in enumerate(current_value):
                item_validator = self._each_validator
                item_result = item_validator.validate(item)
                if not item_result.is_valid:
                    prefix = self._name or ''
                    for err in item_result.errors:
                        nested_field = f"{prefix}.{i}.{err.field}" if err.field else f"{prefix}.{i}"
                        errors.append(ValidationError(
                            field=nested_field,
                            rule=err.rule,
                            message=err.message,
                            value=err.value,
                            expected=err.expected,
                        ))
                cleaned_items.append(item_result.cleaned_data if item_result.is_valid else item)
            current_value = cleaned_items

        return ValidationResult(errors=errors, cleaned_data=current_value)

    async def async_validate(self, value):
        sync_result = self.validate(value)

        if sync_result.errors:
            return sync_result

        if not self._async_validators:
            return sync_result

        errors = []
        ctx = self._ctx(sync_result.cleaned_data)

        for av in self._async_validators:
            try:
                result = await av['fn'](sync_result.cleaned_data)
                if result is False:
                    if av['message']:
                        error_msg = av['message'].format(**ctx)
                    else:
                        error_msg = get_message_registry().get(av['rule_name'], **ctx)
                    errors.append(ValidationError(
                        field=self._name or '',
                        rule=av['rule_name'],
                        message=error_msg,
                        value=sync_result.cleaned_data,
                    ))
                elif isinstance(result, str):
                    errors.append(ValidationError(
                        field=self._name or '',
                        rule=av['rule_name'],
                        message=result,
                        value=sync_result.cleaned_data,
                    ))
                elif isinstance(result, ValidationError):
                    errors.append(result)
            except Exception as e:
                errors.append(ValidationError(
                    field=self._name or '',
                    rule=av['rule_name'],
                    message=str(e),
                    value=sync_result.cleaned_data,
                ))

        if errors:
            return ValidationResult(errors=errors, cleaned_data=sync_result.cleaned_data)
        return sync_result

    @property
    def name(self):
        return self._name

    @name.setter
    def name(self, value):
        self._name = value


def field(name=None):
    return Field(name=name)
