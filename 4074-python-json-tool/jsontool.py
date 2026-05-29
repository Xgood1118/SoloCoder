import sys
import json
import os

from jsonpath import query, JSONPathError
from transformer import transform, parse_rules, TransformError
from aggregator import aggregate, format_table, parse_metrics, AggregateError
from schema import validate, format_errors, SchemaError


import math


def _sanitize_for_output(obj):
    if isinstance(obj, float):
        if math.isnan(obj):
            return '__NAN__'
        if math.isinf(obj):
            return '__INF__' if obj > 0 else '__NEG_INF__'
        return obj
    if isinstance(obj, dict):
        return {k: _sanitize_for_output(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_for_output(v) for v in obj]
    return obj


def _custom_serializer(obj):
    sanitized = _sanitize_for_output(obj)
    return json.dumps(sanitized, ensure_ascii=False, indent=2)


def _object_hook(obj):
    for key, val in obj.items():
        if isinstance(val, str):
            if val == '__NAN__':
                import math
                obj[key] = math.nan
            elif val == '__INF__':
                import math
                obj[key] = math.inf
            elif val == '__NEG_INF__':
                import math
                obj[key] = -math.inf
    return obj


def _load_json(source):
    if source and os.path.isfile(source):
        with open(source, 'r', encoding='utf-8') as f:
            return json.load(f, object_hook=_object_hook)
    if source:
        try:
            return json.loads(source, object_hook=_object_hook)
        except json.JSONDecodeError:
            pass
    return json.load(sys.stdin, object_hook=_object_hook)


def _output(data):
    if isinstance(data, str):
        print(data)
    else:
        print(_custom_serializer(data))


def cmd_query(args):
    if not args:
        print("Usage: jsontool.py query <expression> [input.json]", file=sys.stderr)
        sys.exit(1)
    expression = args[0]
    source = args[1] if len(args) > 1 else None
    data = _load_json(source)
    try:
        result = query(data, expression)
    except JSONPathError as e:
        print("JSONPath error: %s" % e, file=sys.stderr)
        sys.exit(1)
    _output(result)


def cmd_transform(args):
    if not args:
        print("Usage: jsontool.py transform <rule1> [rule2] ... -- [input.json]", file=sys.stderr)
        sys.exit(1)
    rules_str = []
    source = None
    dash_seen = False
    for a in args:
        if a == '--' and not dash_seen:
            dash_seen = True
            continue
        if dash_seen:
            source = a
        else:
            rules_str.append(a)
    data = _load_json(source)
    rules = parse_rules(rules_str)
    try:
        result = transform(data, rules)
    except TransformError as e:
        print("Transform error: %s" % e, file=sys.stderr)
        sys.exit(1)
    _output(result)


def cmd_aggregate(args):
    if not args:
        print("Usage: jsontool.py aggregate --group-by <field> --metrics <func:field> ... -- [input.json]", file=sys.stderr)
        sys.exit(1)
    group_by = None
    metrics_str = []
    source = None
    i = 0
    while i < len(args):
        if args[i] == '--group-by' and i + 1 < len(args):
            group_by = args[i + 1]
            i += 2
        elif args[i] == '--metrics' and i + 1 < len(args):
            metrics_str.append(args[i + 1])
            i += 2
        elif args[i] == '--':
            source = args[i + 1] if i + 1 < len(args) else None
            break
        else:
            source = args[i]
            i += 1
    if not group_by:
        print("Error: --group-by is required", file=sys.stderr)
        sys.exit(1)
    data = _load_json(source)
    metrics = parse_metrics(metrics_str)
    if not metrics:
        print("Error: at least one --metrics is required (format: func:field)", file=sys.stderr)
        sys.exit(1)
    try:
        results, unknown_count = aggregate(data, group_by, metrics)
    except AggregateError as e:
        print("Aggregate error: %s" % e, file=sys.stderr)
        sys.exit(1)
    print(format_table(results, unknown_count, group_by))


def cmd_validate(args):
    if not args:
        print("Usage: jsontool.py validate <schema.json> [input.json]", file=sys.stderr)
        sys.exit(1)
    schema_source = args[0]
    data_source = args[1] if len(args) > 1 else None
    schema = _load_json(schema_source)
    data = _load_json(data_source)
    errors = validate(data, schema)
    print(format_errors(errors))
    if errors:
        sys.exit(1)


def main():
    if len(sys.argv) < 2:
        print("Usage: jsontool.py <command> [args...]", file=sys.stderr)
        print("Commands: query, transform, aggregate, validate", file=sys.stderr)
        sys.exit(1)

    command = sys.argv[1]
    args = sys.argv[2:]

    commands = {
        'query': cmd_query,
        'transform': cmd_transform,
        'aggregate': cmd_aggregate,
        'validate': cmd_validate,
    }

    if command not in commands:
        print("Unknown command: %s" % command, file=sys.stderr)
        print("Available commands: %s" % ', '.join(commands.keys()), file=sys.stderr)
        sys.exit(1)

    commands[command](args)


if __name__ == '__main__':
    main()
