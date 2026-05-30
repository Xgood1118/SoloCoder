import importlib
import importlib.util
import sys
from pathlib import Path
from typing import Any, Dict, Optional

from .descriptor import PluginDescriptorParser
from .exceptions import PluginLoadError
from .models import PluginInstance, PluginMetadata, PluginState
from .utils import get_logger, run_with_timeout


logger = get_logger("plugin_loader")


class PluginLoader:
    def __init__(self, load_timeout: int = 30):
        self.load_timeout = load_timeout
        self._loaded_modules: Dict[str, Any] = {}

    def load_plugin(self, plugin_path: str) -> PluginInstance:
        logger.info(f"Loading plugin from: {plugin_path}")

        try:
            metadata = PluginDescriptorParser.parse_plugin_directory(plugin_path)
            module = self._load_module(metadata)
            instance = self._create_instance(module, metadata)
            plugin_instance = PluginInstance(
                metadata=metadata,
                module=module,
                instance=instance,
                state=PluginState.LOADED,
            )

            logger.info(f"Successfully loaded plugin: {metadata.name} v{metadata.version}")
            return plugin_instance

        except Exception as e:
            logger.error(f"Failed to load plugin {plugin_path}: {e}")
            raise PluginLoadError(f"Failed to load plugin: {e}") from e

    def _load_module(self, metadata: PluginMetadata) -> Any:
        plugin_path = Path(metadata.path)
        entry_point = metadata.entry_point

        module_name = f"plugin_{metadata.name}_{metadata.version.replace('.', '_')}"
        module_name = module_name.replace("-", "_")

        if str(plugin_path) not in sys.path:
            sys.path.insert(0, str(plugin_path))

        try:
            module = run_with_timeout(
                importlib.import_module,
                self.load_timeout,
                entry_point,
            )
            self._loaded_modules[module_name] = module
            return module

        except Exception as e:
            if str(plugin_path) in sys.path:
                sys.path.remove(str(plugin_path))
            raise PluginLoadError(f"Failed to import module '{entry_point}': {e}") from e

    def _create_instance(self, module: Any, metadata: PluginMetadata) -> Any:
        plugin_class = getattr(module, "Plugin", None)
        if plugin_class is None:
            raise PluginLoadError(
                f"Plugin module '{metadata.entry_point}' does not define a 'Plugin' class"
            )

        try:
            instance = plugin_class()
            return instance
        except Exception as e:
            raise PluginLoadError(f"Failed to create plugin instance: {e}") from e

    def unload_plugin(self, plugin_instance: PluginInstance) -> None:
        logger.info(f"Unloading plugin: {plugin_instance.metadata.name}")

        metadata = plugin_instance.metadata
        plugin_path = metadata.path

        if hasattr(plugin_instance.instance, "on_unload"):
            try:
                plugin_instance.instance.on_unload()
            except Exception as e:
                logger.warning(f"Error during on_unload: {e}")

        module = plugin_instance.module
        module_name = module.__name__

        if module_name in sys.modules:
            del sys.modules[module_name]

        for name, mod in list(sys.modules.items()):
            if hasattr(mod, "__file__") and mod.__file__:
                if plugin_path and str(mod.__file__).startswith(str(plugin_path)):
                    del sys.modules[name]

        if plugin_path and str(plugin_path) in sys.path:
            sys.path.remove(str(plugin_path))

        plugin_instance.state = PluginState.INACTIVE
        logger.info(f"Successfully unloaded plugin: {metadata.name}")

    def reload_plugin(self, plugin_instance: PluginInstance) -> PluginInstance:
        metadata = plugin_instance.metadata
        self.unload_plugin(plugin_instance)
        return self.load_plugin(metadata.path)
