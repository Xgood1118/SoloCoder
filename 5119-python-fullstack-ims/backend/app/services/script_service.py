import logging
import RestrictedPython
from RestrictedPython import compile_restricted_exec, safe_globals
from RestrictedPython.Eval import default_guarded_getiter
from RestrictedPython.Guards import (
    safer_getattr,
    guarded_unpack_sequence,
)
from io import StringIO
import sys

logger = logging.getLogger(__name__)

_BLOCKED_IMPORTS = {
    "os", "subprocess", "shutil", "socket", "http", "urllib",
    "requests", "pathlib", "sys", "ctypes", "multiprocessing",
    "threading", "signal", "socketserver", "xmlrpc", "pickle",
    "shelve", "marshal", "importlib", "code", "codeop", "compile",
    "compileall", "py_compile", "zipimport", "pkgutil",
    "webbrowser", "antigravity", "tty", "pty", "fcntl",
    "resource", "syslog", "mmap", "tempfile",
}

_BLOCKED_BUILTINS = {
    "exec", "eval", "compile", "__import__", "open", "input",
    "breakpoint", "exit", "quit", "globals", "locals",
}


def _safe_import(name, *args, **kwargs):
    top_level = name.split(".")[0]
    if top_level in _BLOCKED_IMPORTS:
        raise ImportError(f"Import of '{name}' is not allowed in sandbox")
    return __import__(name, *args, **kwargs)


def _create_sandbox_globals():
    restricted_globals = safe_globals.copy()

    builtins = restricted_globals.get("__builtins__", {}).copy()
    for blocked in _BLOCKED_BUILTINS:
        builtins.pop(blocked, None)
    builtins["__import__"] = _safe_import
    builtins["min"] = min
    builtins["max"] = max
    builtins["sum"] = sum
    builtins["len"] = len
    builtins["range"] = range
    builtins["enumerate"] = enumerate
    builtins["zip"] = zip
    builtins["map"] = map
    builtins["filter"] = filter
    builtins["sorted"] = sorted
    builtins["reversed"] = reversed
    builtins["any"] = any
    builtins["all"] = all
    builtins["abs"] = abs
    builtins["round"] = round
    builtins["isinstance"] = isinstance
    builtins["hasattr"] = hasattr
    builtins["str"] = str
    builtins["int"] = int
    builtins["float"] = float
    builtins["bool"] = bool
    builtins["list"] = list
    builtins["dict"] = dict
    builtins["set"] = set
    builtins["tuple"] = tuple
    builtins["print"] = print

    restricted_globals["__builtins__"] = builtins
    restricted_globals["_getiter_"] = default_guarded_getiter
    restricted_globals["_getattr_"] = safer_getattr
    restricted_globals["_unpack_sequence_"] = guarded_unpack_sequence
    restricted_globals["_write_"] = lambda obj: obj
    restricted_globals["_inplacevar_"] = lambda op, x, y: op(x, y)

    return restricted_globals


def execute_filter_script(script: str, images_data: list[dict]) -> dict:
    output_buffer = StringIO()
    old_stdout = sys.stdout

    try:
        sys.stdout = output_buffer

        compiled = compile_restricted_exec(script)

        if compiled.errors:
            return {
                "success": False,
                "matched_ids": [],
                "error": f"Script compilation errors: {compiled.errors}",
                "log": output_buffer.getvalue(),
            }

        sandbox_globals = _create_sandbox_globals()
        sandbox_globals["images"] = images_data
        sandbox_globals["result"] = []

        exec(compiled.code, sandbox_globals)

        matched = sandbox_globals.get("result", [])
        matched_ids = []

        if "filter_image" in sandbox_globals:
            filter_func = sandbox_globals["filter_image"]
            if callable(filter_func):
                try:
                    matched_ids = []
                    for img in images_data:
                        if filter_func(img):
                            matched_ids.append(img["id"])
                except Exception as filter_e:
                    return {
                        "success": False,
                        "matched_ids": [],
                        "error": f"Filter function error: {type(filter_e).__name__}: {filter_e}",
                        "log": output_buffer.getvalue(),
                    }
        else:
            matched_ids = []
            if isinstance(matched, list):
                matched_ids = [item["id"] for item in matched if isinstance(item, dict) and "id" in item]

        return {
            "success": True,
            "matched_ids": matched_ids,
            "error": None,
            "log": output_buffer.getvalue(),
        }
    except SyntaxError as e:
        return {
            "success": False,
            "matched_ids": [],
            "error": f"Syntax error: {e}",
            "log": output_buffer.getvalue(),
        }
    except ImportError as e:
        return {
            "success": False,
            "matched_ids": [],
            "error": f"Blocked import: {e}",
            "log": output_buffer.getvalue(),
        }
    except Exception as e:
        return {
            "success": False,
            "matched_ids": [],
            "error": f"Script execution error: {type(e).__name__}: {e}",
            "log": output_buffer.getvalue(),
        }
    finally:
        sys.stdout = old_stdout
