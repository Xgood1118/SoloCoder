#!/usr/bin/env python3
"""
插件系统测试用例
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from plugin_system import (
    ConfigStore,
    EventBus,
    PluginDescriptorParser,
    PluginLoader,
    PluginManager,
    SecurityManager,
)
from plugin_system.exceptions import (
    CircularDependencyError,
    PluginConfigError,
    PluginLoadError,
)
from plugin_system.models import PluginDependency, PluginState
from plugin_system.utils import topological_sort


class TestPluginDependencyTests(unittest.TestCase):
    def test_version_check(self):
        dep = PluginDependency(name="test", version_range=">=1.0.0")
        self.assertTrue(dep.is_satisfied_by("1.0.0"))
        self.assertTrue(dep.is_satisfied_by("2.0.0"))
        self.assertFalse(dep.is_satisfied_by("0.9.0"))

    def test_version_complex_range(self):
        dep = PluginDependency(name="test", version_range=">=1.0.0,<2.0.0")
        self.assertTrue(dep.is_satisfied_by("1.5.0"))
        self.assertFalse(dep.is_satisfied_by("2.0.0"))
        self.assertFalse(dep.is_satisfied_by("0.9.0"))


class TestTopologicalSort(unittest.TestCase):
    def test_simple_sort(self):
        nodes = {"A": 1, "B": 2, "C": 3}
        deps = {"A": ["B"], "B": ["C"], "C": []}
        result = topological_sort(nodes, deps)
        self.assertEqual(result, ["C", "B", "A"])

    def test_circular_dependency(self):
        nodes = {"A": 1, "B": 2}
        deps = {"A": ["B"], "B": ["A"]}
        with self.assertRaises(ValueError):
            topological_sort(nodes, deps)


class TestConfigStore(unittest.TestCase):
    def setUp(self):
        self.config = ConfigStore()

    def test_basic_get_set(self):
        self.config.set("test.key", "value")
        self.assertEqual(self.config.get("test.key"), "value")

    def test_default_value(self):
        self.assertEqual(self.config.get("nonexistent", "default"), "default")

    def test_layered_config(self):
        self.config.set("key", "default", layer="defaults")
        self.config.set("key", "plugin", layer="plugin")
        self.config.set("key", "runtime", layer="runtime")
        self.assertEqual(self.config.get("key"), "runtime")

    def test_config_validation(self):
        self.config.register_schema(
            "test.int_value",
            {"type": "integer", "min_value": 1, "max_value": 10},
        )
        self.config.set("test.int_value", 5)
        self.assertEqual(self.config.get("test.int_value"), 5)

    def test_invalid_config(self):
        self.config.register_schema(
            "test.ranged",
            {"type": "integer", "min_value": 0, "max_value": 100},
        )
        with self.assertRaises(PluginConfigError):
            self.config.set("test.ranged", 101)


class TestEventBus(unittest.TestCase):
    def setUp(self):
        self.bus = EventBus(async_workers=0)

    def test_subscribe_publish(self):
        received = []

        def handler(event):
            received.append(event)

        self.bus.subscribe("test.event", handler, "test")
        results = self.bus.publish("test.event", {"data": 123})

        self.assertEqual(len(received), 1)
        self.assertEqual(received[0].data["data"], 123)

    def test_unsubscribe(self):
        received = []

        def handler(event):
            received.append(event)

        self.bus.subscribe("test.event", handler, "test")
        self.bus.unsubscribe("test.event", "test")
        self.bus.publish("test.event", {})

        self.assertEqual(len(received), 0)

    def test_priority(self):
        order = []

        def low_priority_low(event):
            order.append("low")

        def high_priority(event):
            order.append("high")

        self.bus.subscribe("test", low_priority_low, "low", priority=0)
        self.bus.subscribe("test", high_priority, "high", priority=10)
        self.bus.publish("test", {}, wait_for_completion=True)

        self.assertEqual(order, ["high", "low"])

    def tearDown(self):
        self.bus.stop()


class TestSecurityManager(unittest.TestCase):
    def setUp(self):
        self.security = SecurityManager(auto_approve=False)

    def test_permission_denied(self):
        self.assertFalse(self.security.has_permission("test", "file:read"))

    def test_auto_approve(self):
        sec_auto = SecurityManager(auto_approve=True)
        sec_auto.register_plugin_permissions("test", ["file:read"])
        self.assertTrue(sec_auto.has_permission("test", "file:read"))

    def test_grant_revoke(self):
        self.security.grant_permission("test", "file:read")
        self.assertTrue(self.security.has_permission("test", "file:read"))
        self.security.revoke_permission("test", "file:read")
        self.assertFalse(self.security.has_permission("test", "file:read"))

    def test_audit_log(self):
        self.security.grant_permission("test", "file:read")
        logs = self.security.get_audit_log(plugin_name="test")
        self.assertGreater(len(logs), 0)


class TestDescriptorParser(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def test_parse_toml_descriptor(self):
        plugin_dir = Path(self.temp_dir) / "test_plugin"
        plugin_dir.mkdir()

        toml_file = plugin_dir / "plugin.toml"
        toml_file.write_text(
            '''
name = "test_plugin"
version = "1.0.0"
author = "Test"
description = "Test plugin"
entry_point = "main"
'''
        )

        main_file = plugin_dir / "main.py"
        main_file.write_text("class Plugin:\n    pass\n")

        metadata = PluginDescriptorParser.parse_plugin_directory(str(plugin_dir))
        self.assertEqual(metadata.name, "test_plugin")
        self.assertEqual(metadata.version, "1.0.0")


class TestPluginManager(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.plugin_dir = Path(self.temp_dir) / "plugins"
        self.plugin_dir.mkdir()

    def _create_plugin(self, name, version="1.0.0", entry_point="main", deps=None):
        plugin_path = self.plugin_dir / name
        plugin_path.mkdir(parents=True)

        toml_content = f'''
name = "{name}"
version = "{version}"
author = "Test"
description = "Test plugin {name}"
entry_point = "{entry_point}"
'''
        if deps:
            toml_content += '\ndependencies = [\n'
            for dep in deps:
                toml_content += f'    {{ name = "{dep}", version_range = ">=1.0.0" }},\n'
            toml_content += ']\n'

        (plugin_path / "plugin.toml").write_text(toml_content)

        main_content = f'''
class Plugin:
    def __init__(self):
        pass
        self.activated = False
        self.deactivated = False

    def on_activate(self, context):
        self.activated = True

    def on_deactivate(self):
        self.deactivated = True

    def get_name(self):
        return "{name}"
'''
        (plugin_path / f"{entry_point}.py").write_text(main_content)

    def test_discover_plugins(self):
        self._create_plugin("plugin_a")
        self._create_plugin("plugin_b")

        manager = PluginManager(plugin_dirs=[str(self.plugin_dir)])
        discovered = manager.discover_plugins()

        self.assertEqual(len(discovered), 2)
        self.assertEqual({p.name for p in discovered}, {"plugin_a", "plugin_b"})

    def test_load_plugin(self):
        self._create_plugin("test_plugin")

        manager = PluginManager(plugin_dirs=[str(self.plugin_dir)])

        manager.discover_plugins()
        manager.load_plugin("test_plugin")
        manager.activate_plugin("test_plugin")

        self.assertIn("test_plugin", manager.get_active_plugins())

    def test_dependency_order(self):
        self._create_plugin("base_plugin")
        self._create_plugin("dependent_plugin", deps=["base_plugin"])

        manager = PluginManager(plugin_dirs=[str(self.plugin_dir)])
        manager.discover_plugins()

        order = manager._resolve_load_order()
        self.assertEqual(order.index("base_plugin"), 0)
        self.assertLess(order.index("base_plugin"), order.index("dependent_plugin"))

    def test_circular_dependency(self):
        self._create_plugin("plugin_a", deps=["plugin_b"])
        self._create_plugin("plugin_b", deps=["plugin_a"])

        manager = PluginManager(plugin_dirs=[str(self.plugin_dir)])
        manager.discover_plugins()

        with self.assertRaises(CircularDependencyError):
            manager.load_all_plugins()

    def test_plugin_method_call(self):
        self._create_plugin("test_plugin")

        manager = PluginManager(plugin_dirs=[str(self.plugin_dir)])

        manager.discover_plugins()
        manager.load_plugin("test_plugin")
        manager.activate_plugin("test_plugin")

        result = manager.call_plugin_method("test_plugin", "get_name")
        self.assertEqual(result, "test_plugin")

    def test_lifecycle(self):
        self._create_plugin("test_plugin")

        manager = PluginManager(plugin_dirs=[str(self.plugin_dir)])

        manager.discover_plugins()
        manager.load_plugin("test_plugin")
        manager.activate_plugin("test_plugin")

        plugin = manager.get_plugin("test_plugin")
        self.assertEqual(plugin.state, PluginState.ACTIVE)

        manager.deactivate_plugin("test_plugin")
        self.assertEqual(plugin.state, PluginState.INACTIVE)

        manager.unload_plugin("test_plugin")
        self.assertNotIn("test_plugin", manager.get_all_plugins())

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir)


def run_tests():
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestPluginDependencyTests)
    suite.addTests(loader.loadTestsFromTestCase(TestTopologicalSort))
    suite.addTests(loader.loadTestsFromTestCase(TestConfigStore))
    suite.addTests(loader.loadTestsFromTestCase(TestEventBus))
    suite.addTests(loader.loadTestsFromTestCase(TestSecurityManager))
    suite.addTests(loader.loadTestsFromTestCase(TestDescriptorParser))
    suite.addTests(loader.loadTestsFromTestCase(TestPluginManager))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
