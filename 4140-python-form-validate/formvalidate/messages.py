DEFAULT_MESSAGES = {
    'required': '字段 {field} 是必填项',
    'min_length': '字段 {field} 的值长度不能少于 {min_length}，当前长度为 {value_length}',
    'max_length': '字段 {field} 的值长度不能超过 {max_length}，当前长度为 {value_length}',
    'length': '字段 {field} 的值长度必须为 {exact_length}，当前长度为 {value_length}',
    'email': '字段 {field} 的值 {value} 不是有效的邮箱地址，期望格式为 user@example.com',
    'url': '字段 {field} 的值 {value} 不是有效的URL地址',
    'regex': '字段 {field} 的值 {value} 不符合格式要求，期望匹配模式 {pattern}',
    'min': '字段 {field} 的值 {value} 不能小于 {min_value}',
    'max': '字段 {field} 的值 {value} 不能大于 {max_value}',
    'range': '字段 {field} 的值 {value} 必须在 {min_value} 到 {max_value} 之间',
    'positive': '字段 {field} 的值 {value} 必须为正数',
    'negative': '字段 {field} 的值 {value} 必须为负数',
    'one_of': '字段 {field} 的值 {value} 不在允许的选项中，期望值为 {choices}',
    'not_in': '字段 {field} 的值 {value} 不能是 {choices} 中的任何一个',
    'alpha': '字段 {field} 的值 {value} 只能包含字母',
    'alphanum': '字段 {field} 的值 {value} 只能包含字母和数字',
    'username': '字段 {field} 的值 {value} 只能包含字母、数字和下划线',
    'phone': '字段 {field} 的值 {value} 不是有效的手机号码',
    'equals': '字段 {field} 的值 {value} 必须等于 {expected}',
    'not_equals': '字段 {field} 的值 {value} 不能等于 {forbidden}',
    'contains': '字段 {field} 的值必须包含 {substring}',
    'not_contains': '字段 {field} 的值不能包含 {substring}',
    'starts_with': '字段 {field} 的值必须以 {prefix} 开头',
    'ends_with': '字段 {field} 的值必须以 {suffix} 结尾',
    'int_type': '字段 {field} 的值 {value} 无法转换为整数',
    'float_type': '字段 {field} 的值 {value} 无法转换为浮点数',
    'bool_type': '字段 {field} 的值 {value} 无法转换为布尔值',
    'string_type': '字段 {field} 的值必须是字符串类型',
    'nested': '字段 {field} 的嵌套数据校验失败',
    'array': '字段 {field} 的值必须是数组类型',
    'min_items': '字段 {field} 的元素数量不能少于 {min_items}，当前数量为 {actual_count}',
    'max_items': '字段 {field} 的元素数量不能超过 {max_items}，当前数量为 {actual_count}',
    'file_max_size': '字段 {field} 的文件大小不能超过 {max_size}，当前大小为 {actual_size}',
    'file_allowed_types': '字段 {field} 的文件类型 {content_type} 不在允许的类型 {allowed_types} 中',
    'file_min_resolution': '字段 {field} 的图片分辨率 {width}x{height} 低于最低要求 {min_width}x{min_height}',
    'file_max_resolution': '字段 {field} 的图片分辨率 {width}x{height} 超过最大限制 {max_width}x{max_height}',
    'file_aspect_ratio': '字段 {field} 的图片宽高比 {ratio} 不在要求的 {min_ratio} 到 {max_ratio} 范围内',
    'custom': '字段 {field} 的值 {value} 不符合自定义校验规则',
    'async_custom': '字段 {field} 的值 {value} 异步校验失败',
    'each': '字段 {field} 的第 {index} 个元素校验失败',
    'not_string': '字段 {field} 的值类型不是字符串，无法进行字符串校验',
    'not_numeric': '字段 {field} 的值 {value} 不是数值类型，无法进行数值校验',
}


class MessageRegistry:
    def __init__(self):
        self._messages = dict(DEFAULT_MESSAGES)
        self._locale = 'zh_CN'
        self._locales = {'zh_CN': dict(DEFAULT_MESSAGES)}

    def get(self, key, **kwargs):
        template = self._messages.get(key)
        if template is None:
            field_name = kwargs.get('field', '')
            if field_name:
                return f'字段 {field_name} 校验失败: {key}'
            return f'字段校验失败: {key}'
        try:
            return template.format(**kwargs)
        except KeyError:
            return template

    def register(self, key, message, locale='zh_CN'):
        if locale not in self._locales:
            self._locales[locale] = dict(DEFAULT_MESSAGES)
        self._locales[locale][key] = message
        if locale == self._locale:
            self._messages[key] = message

    def set_locale(self, locale):
        self._locale = locale
        if locale in self._locales:
            self._messages = dict(self._locales[locale])
        else:
            self._messages = dict(DEFAULT_MESSAGES)

    def add_locale(self, locale, messages):
        self._locales[locale] = {**DEFAULT_MESSAGES, **messages}

    def current_locale(self):
        return self._locale


_default_registry = MessageRegistry()


def get_message_registry():
    return _default_registry
