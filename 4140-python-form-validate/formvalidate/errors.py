class ValidationError:
    __slots__ = ('field', 'rule', 'message', 'value', 'expected')

    def __init__(self, field, rule, message, value=None, expected=None):
        self.field = field
        self.rule = rule
        self.message = message
        self.value = value
        self.expected = expected

    def __repr__(self):
        return (
            f"ValidationError(field={self.field!r}, rule={self.rule!r}, "
            f"message={self.message!r})"
        )

    def __str__(self):
        return self.message

    def to_dict(self):
        result = {
            'field': self.field,
            'rule': self.rule,
            'message': self.message,
        }
        if self.value is not None:
            result['value'] = self.value
        if self.expected is not None:
            result['expected'] = self.expected
        return result


class ValidationResult:
    def __init__(self, errors=None, cleaned_data=None):
        self.errors = errors or []
        self.cleaned_data = cleaned_data

    @property
    def is_valid(self):
        return len(self.errors) == 0

    def errors_for(self, field_name):
        return [e for e in self.errors if e.field == field_name]

    def first_error(self):
        return self.errors[0] if self.errors else None

    def to_dict(self):
        result = {}
        for e in self.errors:
            if e.field not in result:
                result[e.field] = []
            result[e.field].append(e.message)
        return result

    def merge(self, other, prefix=None):
        for error in other.errors:
            field = error.field
            if prefix:
                field = f"{prefix}.{field}"
            self.errors.append(ValidationError(
                field=field,
                rule=error.rule,
                message=error.message,
                value=error.value,
                expected=error.expected,
            ))
        if other.cleaned_data is not None:
            if self.cleaned_data is None:
                self.cleaned_data = {}
            if prefix:
                self.cleaned_data[prefix] = other.cleaned_data
            else:
                if isinstance(other.cleaned_data, dict):
                    self.cleaned_data.update(other.cleaned_data)

    def __repr__(self):
        if self.is_valid:
            return f"ValidationResult(valid=True, cleaned_data={self.cleaned_data!r})"
        return f"ValidationResult(valid=False, errors={len(self.errors)})"
