class ConversionError(Exception):
    def __init__(self, target_type, value):
        self.target_type = target_type
        self.value = value
        super().__init__(f"Cannot convert {value!r} to {target_type}")


_TRUE_VALUES = frozenset({'true', '1', 'yes', 'on', 'y', 't'})
_FALSE_VALUES = frozenset({'false', '0', 'no', 'off', 'n', 'f'})


def to_int(value):
    try:
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ConversionError('int', value)
        return int(value)
    except (ValueError, TypeError):
        raise ConversionError('int', value)


def to_float(value):
    try:
        if isinstance(value, bool):
            return float(value)
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ConversionError('float', value)
        return float(value)
    except (ValueError, TypeError):
        raise ConversionError('float', value)


def to_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in _TRUE_VALUES:
            return True
        if normalized in _FALSE_VALUES:
            return False
        raise ConversionError('bool', value)
    if isinstance(value, (int, float)):
        return bool(value)
    raise ConversionError('bool', value)


def to_string(value):
    if value is None:
        return ''
    return str(value)
