import math


class AggregateError(Exception):
    pass


_UNKNOWN = '__UNKNOWN__'


def aggregate(data, group_by, metrics):
    if not isinstance(data, list):
        raise AggregateError("Data must be a JSON array for aggregation")
    if len(data) == 0:
        raise AggregateError("Cannot aggregate an empty array")

    field_exists = any(group_by in rec for rec in data if isinstance(rec, dict))
    if not field_exists:
        raise AggregateError("Group field '%s' does not exist in any record" % group_by)

    groups = {}
    unknown_count = 0
    for rec in data:
        if not isinstance(rec, dict):
            unknown_count += 1
            continue
        key = rec.get(group_by, None)
        if key is None or key == '':
            unknown_count += 1
            key = _UNKNOWN
        else:
            key = str(key)
        if key not in groups:
            groups[key] = []
        groups[key].append(rec)

    results = []
    for group_key in groups:
        row = {group_by: group_key}
        records = groups[group_key]
        for metric in metrics:
            field = metric['field']
            func = metric['func']
            values = []
            for r in records:
                v = r.get(field)
                if v is not None and isinstance(v, (int, float)):
                    values.append(v)
            if func == 'count':
                row['%s_%s' % (func, field)] = len(records)
            elif func == 'sum':
                row['%s_%s' % (func, field)] = sum(values) if values else 0
            elif func == 'avg':
                row['%s_%s' % (func, field)] = (sum(values) / len(values)) if values else 0
            elif func == 'min':
                row['%s_%s' % (func, field)] = min(values) if values else None
            elif func == 'max':
                row['%s_%s' % (func, field)] = max(values) if values else None
        results.append(row)

    if _UNKNOWN in groups:
        sorted_keys = [k for k in groups if k != _UNKNOWN]
        sorted_keys.sort()
        sorted_keys.append(_UNKNOWN)
        ordered = []
        for k in sorted_keys:
            for r in results:
                if r[group_by] == k:
                    ordered.append(r)
                    break
        results = ordered

    return results, unknown_count


def format_table(results, unknown_count, group_by):
    if not results:
        return "(empty result)"

    columns = list(results[0].keys())
    col_widths = {}
    for col in columns:
        col_widths[col] = len(col)
        for row in results:
            val = _format_val(row.get(col))
            col_widths[col] = max(col_widths[col], len(val))

    sep = '+' + '+'.join('-' * (col_widths[c] + 2) for c in columns) + '+'
    header = '|' + '|'.join(' %s ' % c.ljust(col_widths[c]) for c in columns) + '|'

    lines = [sep, header, sep]
    for row in results:
        line = '|' + '|'.join(
            ' %s ' % _format_val(row.get(c)).ljust(col_widths[c]) for c in columns
        ) + '|'
        lines.append(line)
    lines.append(sep)

    if unknown_count > 0:
        lines.append("(records with missing '%s' field: %d)" % (group_by, unknown_count))

    return '\n'.join(lines)


def _format_val(v):
    if v is None:
        return 'N/A'
    if isinstance(v, float):
        if v == int(v) and not math.isinf(v):
            return str(int(v))
        return '%.2f' % v
    return str(v)


def parse_metrics(metric_strings):
    metrics = []
    if not metric_strings:
        return metrics
    for ms in metric_strings:
        parts = ms.split(':', 1)
        if len(parts) == 2:
            func = parts[0].strip().lower()
            field = parts[1].strip()
            if func in ('sum', 'avg', 'count', 'min', 'max'):
                metrics.append({'func': func, 'field': field})
    return metrics
