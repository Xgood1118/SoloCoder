import builtins
import importlib.abc
import importlib.util
import os
import sys
import threading
from pathlib import Path
from types import ModuleType
from typing import Any, Callable, Dict, List, Optional, Set

from .exceptions import PluginSandboxError
from .models import PluginInstance
from .utils import get_logger


logger = get_logger("sandbox")


class RestrictedBuiltins:
    SAFE_BUILTINS = {
        "abs",
        "all",
        "any",
        "ascii",
        "bin",
        "bool",
        "bytearray",
        "bytes",
        "callable",
        "chr",
        "classmethod",
        "complex",
        "delattr",
        "dict",
        "dir",
        "divmod",
        "enumerate",
        "filter",
        "float",
        "format",
        "frozenset",
        "getattr",
        "hasattr",
        "hash",
        "hex",
        "id",
        "int",
        "isinstance",
        "issubclass",
        "iter",
        "len",
        "list",
        "locals",
        "map",
        "max",
        "min",
        "next",
        "object",
        "oct",
        "ord",
        "pow",
        "print",
        "property",
        "range",
        "repr",
        "reversed",
        "round",
        "set",
        "setattr",
        "slice",
        "sorted",
        "staticmethod",
        "str",
        "sum",
        "super",
        "tuple",
        "type",
        "vars",
        "zip",
        "True",
        "False",
        "None",
        "Exception",
        "BaseException",
        "ValueError",
        "TypeError",
        "IndexError",
        "KeyError",
        "AttributeError",
        "RuntimeError",
        "NotImplementedError",
        "ZeroDivisionError",
    }

    def __init__(self, plugin_name: str, allowed_paths: List[str]):
        self.plugin_name = plugin_name
        self.allowed_paths = [Path(p).resolve() for p in allowed_paths]
        self._original_open = builtins.open
        self._original_import = builtins.__import__

    def create_restricted_globals(self) -> Dict[str, Any]:
        restricted = {}
        for name in self.SAFE_BUILTINS:
            if hasattr(builtins, name):
                restricted[name] = getattr(builtins, name)

        restricted["__import__"] = self._restricted_import
        restricted["open"] = self._restricted_open
        return {"__builtins__": restricted}

    def _restricted_import(
        self,
        name: str,
        globals: Optional[Dict[str, Any]] = None,
        locals: Optional[Dict[str, Any]] = None,
        fromlist: tuple = (),
        level: int = 0,
    ) -> ModuleType:
        if level > 0:
            raise PluginSandboxError(
                f"Plugin '{self.plugin_name}' cannot use relative imports"
            )

        if not self._is_module_allowed(name):
            raise PluginSandboxError(
                f"Plugin '{self.plugin_name}' is not allowed to import module: {name}"
            )

        return self._original_import(name, globals, locals, fromlist, level)

    def _restricted_open(
        self,
        file: str,
        mode: str = "r",
        buffering: int = -1,
        encoding: Optional[str] = None,
        errors: Optional[str] = None,
        newline: Optional[str] = None,
        closefd: bool = True,
        opener: Optional[Callable] = None,
    ) -> Any:
        file_path = Path(file).resolve()

        if not self._is_path_allowed(file_path):
            raise PluginSandboxError(
                f"Plugin '{self.plugin_name}' cannot access file: {file}"
            )

        if "w" in mode or "a" in mode or "+" in mode:
            if not self._is_write_allowed(file_path):
                raise PluginSandboxError(
                    f"Plugin '{self.plugin_name}' cannot write to file: {file}"
                )

        return self._original_open(
            file, mode, buffering, encoding, errors, newline, closefd, opener
        )

    def _is_module_allowed(self, module_name: str) -> bool:
        base_module = module_name.split(".")[0]
        return base_module in Sandbox.ALLOWED_MODULES

    def _is_path_allowed(self, path: Path) -> bool:
        for allowed_path in self.allowed_paths:
            try:
                path.relative_to(allowed_path)
                return True
            except ValueError:
                continue
        return False

    def _is_write_allowed(self, path: Path) -> bool:
        return self._is_path_allowed(path)


class Sandbox:
    ALLOWED_MODULES = {
        "math",
        "json",
        "re",
        "collections",
        "datetime",
        "time",
        "random",
        "string",
        "textwrap",
        "unicodedata",
        "urllib",
        "http",
        "logging",
        "typing",
        "dataclasses",
        "enum",
        "functools",
        "itertools",
        "operator",
        "pathlib",
    }

    def __init__(self):
        self._sandboxed_plugins: Dict[str, RestrictedBuiltins] = {}
        self._thread_local = threading.local()
        self._original_import = builtins.__import__
        self._original_open = builtins.open

    def create_sandbox(
        self, plugin_instance: PluginInstance, allowed_paths: Optional[List[str]] = None
    ) -> RestrictedBuiltins:
        plugin_name = plugin_instance.metadata.name
        plugin_path = plugin_instance.metadata.path

        paths = [plugin_path] if plugin_path else []
        if allowed_paths:
            paths.extend(allowed_paths)

        sandbox = RestrictedBuiltins(plugin_name, paths)
        self._sandboxed_plugins[plugin_name] = sandbox
        return sandbox

    def execute_in_sandbox(
        self, plugin_name: str, func: Callable, *args: Any, **kwargs: Any
    ) -> Any:
        if plugin_name not in self._sandboxed_plugins:
            raise PluginSandboxError(f"No sandbox found for plugin: {plugin_name}")

        sandbox = self._sandboxed_plugins[plugin_name]
        self._thread_local.current_plugin = plugin_name

        try:
            return func(*args, **kwargs)
        except PluginSandboxError:
            raise
        except Exception as e:
            logger.error(f"Error in sandboxed execution for {plugin_name}: {e}")
            raise
        finally:
            if hasattr(self._thread_local, "current_plugin"):
                del self._thread_local.current_plugin

    def get_current_plugin(self) -> Optional[str]:
        return getattr(self._thread_local, "current_plugin", None)

    def remove_sandbox(self, plugin_name: str) -> None:
        if plugin_name in self._sandboxed_plugins:
            del self._sandboxed_plugins[plugin_name]

    def enable_global_restrictions(self) -> None:
        builtins.__import__ = self._import_hook
        builtins.open = self._open_hook

    def disable_global_restrictions(self) -> None:
        builtins.__import__ = self._original_import
        builtins.open = self._original_open

    def _import_hook(
        self,
        name: str,
        globals: Optional[Dict[str, Any]] = None,
        locals: Optional[Dict[str, Any]] = None,
        fromlist: tuple = (),
        level: int = 0,
    ) -> ModuleType:
        current_plugin = self.get_current_plugin()
        if current_plugin:
            sandbox = self._sandboxed_plugins.get(current_plugin)
            if sandbox:
                if not sandbox._is_module_allowed(name):
                    raise PluginSandboxError(
                        f"Plugin '{current_plugin}' cannot import module: {name}"
                    )

        return self._original_import(name, globals, locals, fromlist, level)

    def _open_hook(
        self,
        file: str,
        mode: str = "r",
        buffering: int = -1,
        encoding: Optional[str] = None,
        errors: Optional[str] = None,
        newline: Optional[str] = None,
        closefd: bool = True,
        opener: Optional[Callable] = None,
    ) -> Any:
        current_plugin = self.get_current_plugin()
        if current_plugin:
            sandbox = self._sandboxed_plugins.get(current_plugin)
            if sandbox:
                file_path = Path(file).resolve()
                if not sandbox._is_path_allowed(file_path):
                    raise PluginSandboxError(
                        f"Plugin '{current_plugin}' cannot access file: {file}"
                    )

        return self._original_open(
            file, mode, buffering, encoding, errors, newline, closefd, opener
        )
