import copy
import re


class TransformError(Exception):
    pass


_SAFE_NAMES = {'abs', 'int', 'float', 'str', 'len', 'min', 'max', 'round'}
_SAFE_BUILTINS = {k: __builtins__[k] for k in _SAFE_NAMES if k in __builtins__} if isinstance(__builtins__, dict) else {}


def _resolve_field(data, field_path):
    parts = field_path.split('.')
    current = data
    for part in parts:
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return None
    return current


def _deep_update(data, field_path, value):
    parts = field_path.split('.')
    current = data
    for part in parts[:-1]:
        if part not in current or not isinstance(current[part], dict):
            current[part] = {}
        current = current[part]
    current[parts[-1]] = value


def _format_eval_value(val):
    import math
    if isinstance(val, float):
        if math.isnan(val):
            return 'float("nan")'
        if math.isinf(val):
            return 'float("inf")' if val > 0 else 'float("-inf")'
    return repr(val)


def _eval_expression(expr, record):
    def replacer(m):
        field = m.group(1)
        val = _resolve_field(record, field)
        if val is None:
            return 'None'
        if isinstance(val, str):
            return repr(val)
        return _format_eval_value(val)

    safe_expr = re.sub(r'\$\{([^}]+)\}', replacer, expr)
    try:
        return eval(safe_expr, {"__builtins__": _SAFE_BUILTINS}, {})
    except Exception:
        return None


def transform(data, rules):
    if isinstance(data, list):
        return [_transform_record(copy.deepcopy(rec), rules) for rec in data]
    elif isinstance(data, dict):
        return _transform_record(copy.deepcopy(data), rules)
    else:
        raise TransformError("Data must be a JSON object or array")


def _transform_record(record, rules):
    for rule in rules:
        action = rule.get('action')
        if action == 'add':
            _do_add(record, rule)
        elif action == 'delete':
            _do_delete(record, rule)
        elif action == 'rename':
            _do_rename(record, rule)
        elif action == 'update':
            _do_update(record, rule)
        elif action == 'compute':
            _do_compute(record, rule)
    return record


def _do_add(record, rule):
    field = rule.get('field', '')
    value = rule.get('value')
    _deep_update(record, field, value)


def _do_delete(record, rule):
    field = rule.get('field', '')
    parts = field.split('.')
    current = record
    for part in parts[:-1]:
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return
    if isinstance(current, dict) and parts[-1] in current:
        del current[parts[-1]]


def _do_rename(record, rule):
    old_name = rule.get('from', '')
    new_name = rule.get('to', '')
    old_parts = old_name.split('.')
    current = record
    for part in old_parts[:-1]:
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return
    if isinstance(current, dict) and old_parts[-1] in current:
        current[new_name] = current.pop(old_parts[-1])


def _do_update(record, rule):
    field = rule.get('field', '')
    value = rule.get('value')
    parts = field.split('.')
    current = record
    for part in parts[:-1]:
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            _deep_update(record, field, value)
            return
    if isinstance(current, dict) and parts[-1] in current:
        current[parts[-1]] = value
    else:
        _deep_update(record, field, value)


def _do_compute(record, rule):
    field = rule.get('field', '')
    expr = rule.get('expr', '')
    value = _eval_expression(expr, record)
    _deep_update(record, field, value)


def parse_rules(rule_strings):
    rules = []
    if not rule_strings:
        return rules
    for rs in rule_strings:
        parts = rs.split(':', 1)
        action = parts[0]
        if action == 'add' and len(parts) > 1:
            kv = parts[1].split('=', 1)
            if len(kv) == 2:
                rules.append({'action': 'add', 'field': kv[0].strip(), 'value': _parse_value(kv[1].strip())})
            else:
                rules.append({'action': 'add', 'field': kv[0].strip(), 'value': None})
        elif action == 'delete' and len(parts) > 1:
            rules.append({'action': 'delete', 'field': parts[1].strip()})
        elif action == 'rename' and len(parts) > 1:
            kv = parts[1].split('->', 1)
            if len(kv) == 2:
                rules.append({'action': 'rename', 'from': kv[0].strip(), 'to': kv[1].strip()})
        elif action == 'update' and len(parts) > 1:
            kv = parts[1].split('=', 1)
            if len(kv) == 2:
                rules.append({'action': 'update', 'field': kv[0].strip(), 'value': _parse_value(kv[1].strip())})
        elif action == 'compute' and len(parts) > 1:
            kv = parts[1].split('=', 1)
            if len(kv) == 2:
                rules.append({'action': 'compute', 'field': kv[0].strip(), 'expr': kv[1].strip()})
    return rules


def _parse_value(s):
    if s.lower() == 'null' or s.lower() == 'none':
        return None
    if s.lower() == 'true':
        return True
    if s.lower() == 'false':
        return False
    try:
        return int(s)
    except ValueError:
        pass
    try:
        return float(s)
    except ValueError:
        pass
    if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
        return s[1:-1]
    return s
