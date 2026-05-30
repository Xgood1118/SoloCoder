import os
import sys
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config_store import ConfigStore, PluginConfigStore
from .descriptor import PluginDescriptorParser
from .event_bus import EventBus
from .exceptions import (
    CircularDependencyError,
    PluginDependencyError,
    PluginError,
    PluginLoadError,
    PluginVersionError,
)
from .models import PluginInstance, PluginMetadata, PluginState
from .plugin_loader import PluginLoader
from .sandbox import Sandbox
from .security import SecurityManager
from .utils import get_logger, run_with_timeout, topological_sort


logger = get_logger("plugin_manager")


class PluginManager:
    def __init__(
        self,
        plugin_dirs: Optional[List[str]] = None,
        config_path: Optional[str] = None,
        auto_approve_permissions: bool = True,
        min_api_version: str = "1.0.0",
        max_api_version: Optional[str] = None,
        activation_timeout: int = 10,
    ):
        self.plugin_dirs = [Path(d) for d in (plugin_dirs or ["plugins"])]
        self.min_api_version = min_api_version
        self.max_api_version = max_api_version
        self.activation_timeout = activation_timeout

        self._plugins: Dict[str, PluginInstance] = {}
        self._discovered_plugins: Dict[str, PluginMetadata] = {}
        self._lock = threading.RLock()

        self.loader = PluginLoader()
        self.sandbox = Sandbox()
        self.event_bus = EventBus()
        self.config_store = ConfigStore(storage_path=config_path)
        self.security = SecurityManager(auto_approve=auto_approve_permissions)

        self._rpc_services: Dict[str, Dict[str, Any]] = {}

    def discover_plugins(self) -> List[PluginMetadata]:
        logger.info("Discovering plugins...")
        discovered = []

        for plugin_dir in self.plugin_dirs:
            if not plugin_dir.exists():
                logger.warning(f"Plugin directory not found: {plugin_dir}")
                continue

            for item in plugin_dir.iterdir():
                if item.is_dir():
                    try:
                        metadata = PluginDescriptorParser.parse_plugin_directory(str(item))
                        self._discovered_plugins[metadata.name] = metadata
                        discovered.append(metadata)
                        logger.info(f"Discovered plugin: {metadata.name} v{metadata.version}")
                    except PluginError as e:
                        logger.warning(f"Failed to parse plugin at {item}: {e}")

        logger.info(f"Discovered {len(discovered)} plugins")
        return discovered

    def load_all_plugins(self) -> List[str]:
        logger.info("Loading all plugins...")

        if not self._discovered_plugins:
            self.discover_plugins()

        load_order = self._resolve_load_order()
        logger.info(f"Plugin load order: {load_order}")

        loaded = []
        for plugin_name in load_order:
            try:
                self.load_plugin(plugin_name)
                loaded.append(plugin_name)
            except PluginError as e:
                logger.error(f"Failed to load plugin '{plugin_name}': {e}")

        return loaded

    def load_plugin(self, plugin_name: str) -> PluginInstance:
        with self._lock:
            if plugin_name in self._plugins:
                logger.warning(f"Plugin already loaded: {plugin_name}")
                return self._plugins[plugin_name]

            if plugin_name not in self._discovered_plugins:
                raise PluginLoadError(f"Plugin not found: {plugin_name}")

            metadata = self._discovered_plugins[plugin_name]

            self._check_api_version(metadata)
            self._check_dependencies(metadata)

            logger.info(f"Loading plugin: {plugin_name} v{metadata.version}")

            try:
                plugin_instance = self.loader.load_plugin(metadata.path)
            except Exception as e:
                raise PluginLoadError(f"Failed to load plugin '{plugin_name}': {e}") from e

            self.security.register_plugin_permissions(
                plugin_name, metadata.permissions
            )

            if metadata.config_schema:
                for key, schema in metadata.config_schema.items():
                    full_key = f"plugins.{plugin_name}.{key}"
                    self.config_store.register_schema(full_key, schema)

            self._plugins[plugin_name] = plugin_instance
            plugin_instance.state = PluginState.LOADED

            return plugin_instance

    def activate_plugin(self, plugin_name: str) -> None:
        with self._lock:
            if plugin_name not in self._plugins:
                raise PluginLoadError(f"Plugin not loaded: {plugin_name}")

            plugin_instance = self._plugins[plugin_name]
            if plugin_instance.state == PluginState.ACTIVE:
                logger.warning(f"Plugin already active: {plugin_name}")
                return

            logger.info(f"Activating plugin: {plugin_name}")

            try:
                run_with_timeout(
                    self._activate_plugin_internal,
                    self.activation_timeout,
                    plugin_instance,
                )
                plugin_instance.state = PluginState.ACTIVE
                logger.info(f"Plugin activated: {plugin_name}")

                self.event_bus.publish(
                    "plugin.activated",
                    {"plugin_name": plugin_name},
                    source="plugin_manager",
                )
            except Exception as e:
                plugin_instance.state = PluginState.ERROR
                plugin_instance.error = str(e)
                raise PluginLoadError(f"Failed to activate plugin '{plugin_name}': {e}") from e

    def _activate_plugin_internal(self, plugin_instance: PluginInstance) -> None:
        metadata = plugin_instance.metadata
        plugin = plugin_instance.instance

        self.sandbox.create_sandbox(plugin_instance)

        if hasattr(plugin, "on_load"):
            plugin.on_load()

        if hasattr(plugin, "on_activate"):
            context = PluginContext(self, metadata.name)
            plugin.on_activate(context)

        if hasattr(plugin, "get_services"):
            services = plugin.get_services()
            self._register_rpc_services(metadata.name, services)

    def deactivate_plugin(self, plugin_name: str) -> None:
        with self._lock:
            if plugin_name not in self._plugins:
                raise PluginLoadError(f"Plugin not loaded: {plugin_name}")

            plugin_instance = self._plugins[plugin_name]
            if plugin_instance.state != PluginState.ACTIVE:
                logger.warning(f"Plugin not active: {plugin_name}")
                return

            logger.info(f"Deactivating plugin: {plugin_name}")

            try:
                plugin = plugin_instance.instance

                if hasattr(plugin, "on_deactivate"):
                    plugin.on_deactivate()

                if plugin_name in self._rpc_services:
                    del self._rpc_services[plugin_name]

                self.event_bus.unsubscribe_all(plugin_name)

                plugin_instance.state = PluginState.INACTIVE
                logger.info(f"Plugin deactivated: {plugin_name}")

                self.event_bus.publish(
                    "plugin.deactivated",
                    {"plugin_name": plugin_name},
                    source="plugin_manager",
                )
            except Exception as e:
                plugin_instance.state = PluginState.ERROR
                plugin_instance.error = str(e)
                logger.error(f"Error deactivating plugin '{plugin_name}': {e}")

    def unload_plugin(self, plugin_name: str) -> None:
        with self._lock:
            if plugin_name not in self._plugins:
                raise PluginLoadError(f"Plugin not loaded: {plugin_name}")

            plugin_instance = self._plugins[plugin_name]

            if plugin_instance.state == PluginState.ACTIVE:
                self.deactivate_plugin(plugin_name)

            logger.info(f"Unloading plugin: {plugin_name}")

            try:
                plugin = plugin_instance.instance
                if hasattr(plugin, "on_unload"):
                    plugin.on_unload()

                self.loader.unload_plugin(plugin_instance)
                self.sandbox.remove_sandbox(plugin_name)

                del self._plugins[plugin_name]
                logger.info(f"Plugin unloaded: {plugin_name}")

                self.event_bus.publish(
                    "plugin.unloaded",
                    {"plugin_name": plugin_name},
                    source="plugin_manager",
                )
            except Exception as e:
                logger.error(f"Error unloading plugin '{plugin_name}': {e}")

    def activate_all_plugins(self) -> List[str]:
        activated = []
        for plugin_name in list(self._plugins.keys()):
            try:
                self.activate_plugin(plugin_name)
                activated.append(plugin_name)
            except PluginError as e:
                logger.error(f"Failed to activate plugin '{plugin_name}': {e}")
        return activated

    def call_plugin_method(self, plugin_name: str, method_name: str, *args, **kwargs) -> Any:
        with self._lock:
            if plugin_name not in self._plugins:
                raise PluginLoadError(f"Plugin not loaded: {plugin_name}")

            plugin_instance = self._plugins[plugin_name]
            if plugin_instance.state != PluginState.ACTIVE:
                raise PluginLoadError(f"Plugin not active: {plugin_name}")

            plugin = plugin_instance.instance
            if not hasattr(plugin, method_name):
                raise AttributeError(
                    f"Plugin '{plugin_name}' has no method: {method_name}"
                )

            method = getattr(plugin, method_name)
            return self.sandbox.execute_in_sandbox(plugin_name, method, *args, **kwargs)

    def call_rpc(self, plugin_name: str, service_name: str, *args, **kwargs) -> Any:
        if plugin_name not in self._rpc_services:
            raise PluginError(f"Plugin '{plugin_name}' has no registered services")

        services = self._rpc_services[plugin_name]
        if service_name not in services:
            raise PluginError(
                f"Service '{service_name}' not found in plugin '{plugin_name}'"
            )

        service = services[service_name]
        return service(*args, **kwargs)

    def get_plugin_config(self, plugin_name: str) -> PluginConfigStore:
        return PluginConfigStore(plugin_name, self.config_store)

    def get_plugin(self, plugin_name: str) -> Optional[PluginInstance]:
        return self._plugins.get(plugin_name)

    def get_all_plugins(self) -> Dict[str, PluginInstance]:
        return self._plugins.copy()

    def get_active_plugins(self) -> List[str]:
        return [
            name
            for name, instance in self._plugins.items()
            if instance.state == PluginState.ACTIVE
        ]

    def _resolve_load_order(self) -> List[str]:
        nodes = {}
        dependencies = {}

        for name, metadata in self._discovered_plugins.items():
            nodes[name] = metadata
            dependencies[name] = [dep.name for dep in metadata.dependencies]

        try:
            return topological_sort(nodes, dependencies)
        except ValueError as e:
            raise CircularDependencyError(str(e)) from e

    def _check_api_version(self, metadata: PluginMetadata) -> None:
        try:
            from .utils import is_version_compatible

            if not is_version_compatible(
                metadata.api_version, self.min_api_version, self.max_api_version
            ):
                raise PluginVersionError(
                    metadata.name,
                    f">={self.min_api_version}"
                    + (f", <{self.max_api_version}" if self.max_api_version else ""),
                    metadata.api_version,
                )
        except PluginVersionError:
            raise
        except Exception as e:
            logger.warning(f"Failed to check API version for {metadata.name}: {e}")

    def _check_dependencies(self, metadata: PluginMetadata) -> None:
        for dep in metadata.dependencies:
            if dep.name not in self._discovered_plugins:
                raise PluginDependencyError(
                    f"Plugin '{metadata.name}' requires '{dep.name}' which is not installed"
                )

            dep_metadata = self._discovered_plugins[dep.name]
            if not dep.is_satisfied_by(dep_metadata.version):
                raise PluginDependencyError(
                    f"Plugin '{metadata.name}' requires '{dep.name}' {dep.version_range}, "
                    f"but version {dep_metadata.version} is installed"
                )

    def _register_rpc_services(self, plugin_name: str, services: Dict[str, Any]) -> None:
        if plugin_name not in self._rpc_services:
            self._rpc_services[plugin_name] = {}
        self._rpc_services[plugin_name].update(services)
        logger.info(f"Registered {len(services)} RPC services for '{plugin_name}'")

    def shutdown(self) -> None:
        logger.info("Shutting down plugin manager...")

        for plugin_name in reversed(list(self._plugins.keys())):
            try:
                self.unload_plugin(plugin_name)
            except Exception as e:
                logger.error(f"Error during shutdown for plugin '{plugin_name}': {e}")

        self.event_bus.stop()
        logger.info("Plugin manager shutdown complete")


class PluginContext:
    def __init__(self, manager: PluginManager, plugin_name: str):
        self._manager = manager
        self._plugin_name = plugin_name

    @property
    def plugin_name(self) -> str:
        return self._plugin_name

    @property
    def config(self) -> PluginConfigStore:
        return self._manager.get_plugin_config(self._plugin_name)

    @property
    def event_bus(self) -> EventBus:
        return self._manager.event_bus

    def subscribe_event(self, event_type: str, callback, priority: int = 0) -> None:
        self._manager.event_bus.subscribe(
            event_type, callback, self._plugin_name, priority
        )

    def publish_event(self, event_type: str, data: Optional[Dict] = None) -> None:
        self._manager.event_bus.publish(event_type, data, source=self._plugin_name)

    def call_plugin(self, plugin_name: str, method_name: str, *args, **kwargs) -> Any:
        return self._manager.call_plugin_method(plugin_name, method_name, *args, **kwargs)

    def call_service(self, plugin_name: str, service_name: str, *args, **kwargs) -> Any:
        return self._manager.call_rpc(plugin_name, service_name, *args, **kwargs)

    def request_permission(self, permission: str) -> bool:
        return self._manager.security.request_permission(self._plugin_name, permission)

    def has_permission(self, permission: str) -> bool:
        return self._manager.security.has_permission(self._plugin_name, permission)

    def get_logger(self):
        return get_logger(f"plugin.{self._plugin_name}")
