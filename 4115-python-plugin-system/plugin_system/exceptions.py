class PluginError(Exception):
    pass


class PluginLoadError(PluginError):
    pass


class PluginDependencyError(PluginError):
    pass


class PluginSecurityError(PluginError):
    pass


class PluginTimeoutError(PluginError):
    pass


class PluginConfigError(PluginError):
    pass


class PluginEventError(PluginError):
    pass


class PluginSandboxError(PluginError):
    pass


class CircularDependencyError(PluginDependencyError):
    def __init__(self, cycle):
        self.cycle = cycle
        super().__init__(f"Circular dependency detected: {' -> '.join(cycle)}")


class PluginVersionError(PluginError):
    def __init__(self, plugin_name, required, actual):
        self.plugin_name = plugin_name
        self.required = required
        self.actual = actual
        super().__init__(
            f"Plugin '{plugin_name}' version mismatch: required {required}, got {actual}"
        )


class PluginPermissionError(PluginSecurityError):
    def __init__(self, plugin_name, permission):
        self.plugin_name = plugin_name
        self.permission = permission
        super().__init__(
            f"Plugin '{plugin_name}' is not authorized for permission: {permission}"
        )
