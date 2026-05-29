import re


class JSONPathError(Exception):
    pass


_TOKEN_PATTERNS = [
    ('ROOT', r'\$'),
    ('DOT_KEY', r'\.(?P<key>[a-zA-Z_][a-zA-Z0-9_]*)'),
    ('BRACKET_WILDCARD', r'\[\*\]'),
    ('BRACKET_SLICE', r'\[-?\d*:-?\d*(?::-?\d*)?\]'),
    ('BRACKET_INDEX', r'\[-?\d+\]'),
    ('BRACKET_KEY', r'\[\'(?P<bkey>[^\']+)\'\]'),
    ('PIPE', r'\|'),
    ('WS', r'\s+'),
]

_TOKEN_RE = re.compile(
    '|'.join('(?P<%s>%s)' % (name, pattern) for name, pattern in _TOKEN_PATTERNS)
)


def _tokenize(expression):
    tokens = []
    pos = 0
    while pos < len(expression):
        m = _TOKEN_RE.match(expression, pos)
        if not m:
            raise JSONPathError(
                "Unexpected character at position %d: '%s'" % (pos, expression[pos])
            )
        kind = m.lastgroup
        value = m.group()
        if kind == 'WS':
            pos = m.end()
            continue
        if kind == 'DOT_KEY':
            tokens.append(('KEY', m.group('key')))
        elif kind == 'BRACKET_KEY':
            tokens.append(('KEY', m.group('bkey')))
        elif kind == 'BRACKET_WILDCARD':
            tokens.append(('WILDCARD', '*'))
        elif kind == 'BRACKET_INDEX':
            idx_str = value[1:-1]
            tokens.append(('INDEX', int(idx_str)))
        elif kind == 'BRACKET_SLICE':
            inner = value[1:-1]
            tokens.append(('SLICE', _parse_slice(inner)))
        elif kind == 'ROOT':
            tokens.append(('ROOT', '$'))
        elif kind == 'PIPE':
            tokens.append(('PIPE', '|'))
        pos = m.end()
    return tokens


def _parse_slice(s):
    s = s.strip()
    parts = s.split(':')
    if len(parts) == 1:
        return (int(parts[0]) if parts[0] else None, None, None)
    elif len(parts) == 2:
        start = int(parts[0]) if parts[0] else None
        end = int(parts[1]) if parts[1] else None
        return (start, end, None)
    else:
        start = int(parts[0]) if parts[0] else None
        end = int(parts[1]) if parts[1] else None
        step = int(parts[2]) if parts[2] else None
        return (start, end, step)


def _split_by_pipe(tokens):
    segments = []
    current = []
    for tok in tokens:
        if tok[0] == 'PIPE':
            if current:
                segments.append(current)
            current = []
        else:
            current.append(tok)
    if current:
        segments.append(current)
    return segments


def _apply_single(data, step):
    kind = step[0]
    if kind == 'KEY':
        key = step[1]
        if isinstance(data, dict):
            return data.get(key)
        return None
    elif kind == 'WILDCARD':
        if isinstance(data, dict):
            return list(data.values())
        elif isinstance(data, list):
            return list(data)
        return None
    elif kind == 'INDEX':
        idx = step[1]
        if isinstance(data, list):
            if -len(data) <= idx < len(data):
                return data[idx]
        return None
    elif kind == 'SLICE':
        start, end, step_val = step[1]
        if isinstance(data, list):
            return data[start:end:step_val]
        return None
    return data


def _apply_steps(data, steps, iterating=False):
    result = data
    for step in steps:
        if step[0] == 'ROOT':
            result = data
            continue
        if step[0] == 'WILDCARD':
            iterating = True
            if isinstance(result, dict):
                result = list(result.values())
            continue
        if iterating and isinstance(result, list):
            collected = []
            for item in result:
                val = _apply_single(item, step)
                if val is not None:
                    collected.append(val)
            if collected:
                result = collected
            else:
                result = _apply_single(result, step)
                if result is None:
                    return None, iterating
        elif not iterating and isinstance(result, list) and step[0] == 'KEY':
            collected = []
            for item in result:
                val = _apply_single(item, step)
                if val is not None:
                    collected.append(val)
            if not collected:
                return None, iterating
            result = collected
        else:
            result = _apply_single(result, step)
            if result is None:
                return None, iterating
    return result, iterating


def query(data, expression):
    tokens = _tokenize(expression)
    segments = _split_by_pipe(tokens)
    result = data
    iterating = False
    for seg_tokens in segments:
        if not seg_tokens:
            continue
        has_root = any(t[0] == 'ROOT' for t in seg_tokens)
        steps = seg_tokens if has_root else [('ROOT', '$')] + seg_tokens
        result, iterating = _apply_steps(result, steps, iterating)
        if result is None:
            return None
    return result
