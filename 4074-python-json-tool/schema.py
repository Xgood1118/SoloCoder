import re


class SchemaError(Exception):
    pass


_TYPE_MAP = {
    'string': str,
    'integer': int,
    'number': (int, float),
    'boolean': bool,
    'object': dict,
    'array': list,
    'null': type(None),
}


def validate(data, schema, path='$', root_schema=None):
    if root_schema is None:
        root_schema = schema
    errors = []
    _validate_node(data, schema, path, root_schema, errors)
    return errors


def _resolve_ref(schema_part, root_schema, path, errors):
    if '$ref' in schema_part:
        ref = schema_part['$ref']
        if not ref.startswith('#/'):
            errors.append({
                'path': path,
                'message': "Unsupported $ref format: %s (only internal references #/ supported)" % ref
            })
            return {}
        parts = ref[2:].split('/')
        target = root_schema
        for p in parts:
            if isinstance(target, dict) and p in target:
                target = target[p]
            else:
                errors.append({
                    'path': path,
                    'message': "$ref target '%s' does not exist at path '%s'" % (ref, path)
                })
                return {}
        return target
    return schema_part


def _validate_node(data, schema, path, root_schema, errors):
    if not isinstance(schema, dict):
        return

    schema = _resolve_ref(schema, root_schema, path, errors)
    if not schema:
        return

    if 'type' in schema:
        _check_type(data, schema['type'], path, errors)

    if 'enum' in schema:
        if data not in schema['enum']:
            errors.append({
                'path': path,
                'message': "Value %s is not one of the allowed enum values: %s" % (
                    _repr(data), schema['enum']
                )
            })

    if 'pattern' in schema and isinstance(data, str):
        if not re.search(schema['pattern'], data):
            errors.append({
                'path': path,
                'message': "String '%s' does not match pattern '%s'" % (data, schema['pattern'])
            })

    if 'minimum' in schema and isinstance(data, (int, float)):
        if data < schema['minimum']:
            errors.append({
                'path': path,
                'message': "Value %s is less than minimum %s" % (data, schema['minimum'])
            })

    if 'maximum' in schema and isinstance(data, (int, float)):
        if data > schema['maximum']:
            errors.append({
                'path': path,
                'message': "Value %s is greater than maximum %s" % (data, schema['maximum'])
            })

    if 'required' in schema and isinstance(data, dict):
        for req_field in schema['required']:
            if req_field not in data:
                errors.append({
                    'path': path,
                    'message': "Required field '%s' is missing" % req_field
                })

    if 'properties' in schema and isinstance(data, dict):
        for prop_name, prop_schema in schema['properties'].items():
            if prop_name in data:
                _validate_node(
                    data[prop_name], prop_schema,
                    '%s.%s' % (path, prop_name), root_schema, errors
                )

    if 'items' in schema and isinstance(data, list):
        items_schema = _resolve_ref(schema['items'], root_schema, '%s[items]' % path, errors)
        if isinstance(items_schema, dict):
            for i, item in enumerate(data):
                _validate_node(
                    item, items_schema,
                    '%s[%d]' % (path, i), root_schema, errors
                )

    if 'minItems' in schema and isinstance(data, list):
        if len(data) < schema['minItems']:
            errors.append({
                'path': path,
                'message': "Array has %d items, but minimum is %d" % (
                    len(data), schema['minItems']
                )
            })

    if 'maxItems' in schema and isinstance(data, list):
        if len(data) > schema['maxItems']:
            errors.append({
                'path': path,
                'message': "Array has %d items, but maximum is %d" % (
                    len(data), schema['maxItems']
                )
            })

    if 'minLength' in schema and isinstance(data, str):
        if len(data) < schema['minLength']:
            errors.append({
                'path': path,
                'message': "String length %d is less than minimum %d" % (
                    len(data), schema['minLength']
                )
            })

    if 'maxLength' in schema and isinstance(data, str):
        if len(data) > schema['maxLength']:
            errors.append({
                'path': path,
                'message': "String length %d is greater than maximum %d" % (
                    len(data), schema['maxLength']
                )
            })


def _check_type(data, expected_type, path, errors):
    if isinstance(expected_type, list):
        matched = False
        for t in expected_type:
            if _type_matches(data, t):
                matched = True
                break
        if not matched:
            errors.append({
                'path': path,
                'message': "Expected type one of %s, got %s (%s)" % (
                    expected_type, _actual_type(data), _repr(data)
                )
            })
    else:
        if not _type_matches(data, expected_type):
            errors.append({
                'path': path,
                'message': "Expected type '%s', got '%s' (%s)" % (
                    expected_type, _actual_type(data), _repr(data)
                )
            })


def _type_matches(data, type_name):
    if type_name not in _TYPE_MAP:
        return True
    expected = _TYPE_MAP[type_name]
    if type_name == 'integer':
        return isinstance(data, int) and not isinstance(data, bool)
    if type_name == 'number':
        return isinstance(data, (int, float)) and not isinstance(data, bool)
    return isinstance(data, expected)


def _actual_type(data):
    if data is None:
        return 'null'
    if isinstance(data, bool):
        return 'boolean'
    if isinstance(data, int):
        return 'integer'
    if isinstance(data, float):
        return 'number'
    if isinstance(data, str):
        return 'string'
    if isinstance(data, dict):
        return 'object'
    if isinstance(data, list):
        return 'array'
    return type(data).__name__


def _repr(data):
    if data is None:
        return 'null'
    if isinstance(data, str):
        return '"%s"' % data
    if isinstance(data, bool):
        return str(data).lower()
    return repr(data)


def format_errors(errors):
    if not errors:
        return "Validation passed."
    lines = []
    for e in errors:
        lines.append("  [%s] %s" % (e['path'], e['message']))
    return "Validation failed with %d error(s):\n%s" % (len(errors), '\n'.join(lines))
