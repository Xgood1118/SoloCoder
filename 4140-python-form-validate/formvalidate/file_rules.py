class UploadedFile:
    def __init__(self, filename, size, content_type, resolution=None):
        self.filename = filename
        self.size = size
        self.content_type = content_type
        self._resolution = resolution

    @property
    def resolution(self):
        if self._resolution is None:
            self._resolution = self._read_resolution()
        return self._resolution

    def _read_resolution(self):
        try:
            from PIL import Image
            import io
            if hasattr(self, '_data') and self._data:
                img = Image.open(io.BytesIO(self._data))
                return img.size
        except Exception:
            pass
        return None

    def set_data(self, data):
        self._data = data
        return self

    def __repr__(self):
        return (
            f"UploadedFile(filename={self.filename!r}, size={self.size}, "
            f"content_type={self.content_type!r})"
        )


_SIZE_UNITS = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 ** 2,
    'GB': 1024 ** 3,
}


def parse_size(size_str):
    if isinstance(size_str, (int, float)):
        return int(size_str)
    if isinstance(size_str, str):
        size_str = size_str.strip().upper()
        for unit, multiplier in sorted(_SIZE_UNITS.items(), key=lambda x: -len(x[0])):
            if size_str.endswith(unit):
                number = size_str[:-len(unit)].strip()
                try:
                    return int(float(number) * multiplier)
                except ValueError:
                    raise ValueError(f"无法解析文件大小: {size_str}")
        try:
            return int(size_str)
        except ValueError:
            raise ValueError(f"无法解析文件大小: {size_str}")
    raise ValueError(f"无法解析文件大小: {size_str}")


def format_size(bytes_count):
    if bytes_count < 1024:
        return f"{bytes_count}B"
    elif bytes_count < 1024 ** 2:
        return f"{bytes_count / 1024:.1f}KB"
    elif bytes_count < 1024 ** 3:
        return f"{bytes_count / (1024 ** 2):.1f}MB"
    else:
        return f"{bytes_count / (1024 ** 3):.1f}GB"
