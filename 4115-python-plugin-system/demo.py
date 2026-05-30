#!/usr/bin/env python3
"""
演示应用 - 展示 Python 插件系统的功能
"""

import logging
import sys
import time

from plugin_system import PluginManager
from plugin_system.utils import get_logger


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = get_logger("demo")


def demo_basic_usage():
    """演示基本的插件加载和使用"""
    print("\n" + "=" * 60)
    print("1. 基本使用演示")
    print("=" * 60)

    manager = PluginManager(plugin_dirs=["plugins"])

    logger.info("发现插件...")
    discovered = manager.discover_plugins()
    print(f"\n发现 {len(discovered)} 个插件:")
    for plugin in discovered:
        print(f"  - {plugin.name} v{plugin.version}: {plugin.description}")

    logger.info("加载所有插件...")
    loaded = manager.load_all_plugins()
    print(f"\n已加载 {len(loaded)} 个插件")

    logger.info("激活所有插件...")
    activated = manager.activate_all_plugins()
    print(f"\n已激活 {len(activated)} 个插件: {activated}")

    print("\n活跃插件列表:")
    for name in manager.get_active_plugins():
        plugin = manager.get_plugin(name)
        print(f"  - {name} (状态: {plugin.state.value})")

    return manager


def demo_plugin_method_call(manager):
    """演示调用插件方法"""
    print("\n" + "=" * 60)
    print("2. 调用插件方法演示")
    print("=" * 60)

    logger.info("调用 hello_world 插件的 get_greeting 方法...")
    greeting = manager.call_plugin_method("hello_world", "get_greeting")
    print(f"\n问候语:\n{greeting}")

    logger.info("使用自定义名称调用...")
    greeting = manager.call_plugin_method("hello_world", "get_greeting", "Alice")
    print(f"\n自定义问候语:\n{greeting}")

    logger.info("调用 data_processor 插件的 process_data 方法...")
    test_data = {"name": "test", "value": 42, "status": "active"}
    result = manager.call_plugin_method("data_processor", "process_data", test_data)
    print(f"\n数据处理结果:")
    print(f"  原始: {result['original']}")
    print(f"  转换后: {result['transformed']}")


def demo_rpc_service(manager):
    """演示 RPC 服务调用"""
    print("\n" + "=" * 60)
    print("3. RPC 服务调用演示")
    print("=" * 60)

    logger.info("通过 RPC 调用 hello_world 服务...")
    greeting = manager.call_rpc("hello_world", "get_greeting", "Bob")
    print(f"\nRPC 问候语: {greeting}")

    logger.info("data_processor 调用 hello_world 的服务...")
    result = manager.call_rpc("data_processor", "say_hello", "Charlie")
    print(f"\n跨插件服务调用结果: {result}")


def demo_event_system(manager):
    """演示事件总线系统"""
    print("\n" + "=" * 60)
    print("4. 事件系统演示")
    print("=" * 60)

    messages_received = []

    def on_chat_message(event):
        messages_received.append(event.data)
        print(f"\n收到聊天消息: {event.data.get('message')}")

    logger.info("订阅 chat.message 事件...")
    manager.event_bus.subscribe("chat.message", on_chat_message, "demo_app")

    logger.info("触发 user.joined 事件...")
    manager.event_bus.publish("user.joined", {"name": "David"}, source="demo_app")

    time.sleep(0.1)
    print(f"\n共收到 {len(messages_received)} 条消息")

    logger.info("触发 data.received 事件...")

    def on_data_processed(event):
        print(f"\n数据已处理: {event.data['processed']['transformed']}")

    manager.event_bus.subscribe("data.processed", on_data_processed, "demo_app")
    manager.event_bus.publish("data.received", {"data": {"x": 10, "y": "hello"}}, source="demo_app")

    time.sleep(0.1)
    manager.event_bus.unsubscribe_all("demo_app")


def demo_config_system(manager):
    """演示配置系统"""
    print("\n" + "=" * 60)
    print("5. 配置系统演示")
    print("=" * 60)

    config = manager.get_plugin_config("hello_world")

    logger.info("获取 hello_world 的当前配置...")
    print(f"\n当前配置:")
    print(f"  greeting: {config.get('greeting')}")
    print(f"  name: {config.get('name')}")
    print(f"  count: {config.get('count')}")

    logger.info("修改配置...")
    config.set("greeting", "Hi")
    config.set("count", 3)

    logger.info("再次调用插件方法...")
    greeting = manager.call_plugin_method("hello_world", "get_greeting")
    print(f"\n新的问候语:\n{greeting}")

    logger.info("配置变更通知...")

    def on_config_change(key, old_value, new_value):
        print(f"\n配置变更: {key}: {old_value} -> {new_value}")

    config.subscribe("greeting", on_config_change)
    config.set("greeting", "Hey")

    print(f"\n完整配置: {config.to_dict()}")


def demo_lifecycle_management(manager):
    """演示生命周期管理"""
    print("\n" + "=" * 60)
    print("6. 生命周期管理演示")
    print("=" * 60)

    logger.info("停用 hello_world 插件...")
    manager.deactivate_plugin("hello_world")
    print(f"\n活跃插件: {manager.get_active_plugins()}")

    logger.info("重新激活 hello_world 插件...")
    manager.activate_plugin("hello_world")
    print(f"\n活跃插件: {manager.get_active_plugins()}")

    greeting = manager.call_plugin_method("hello_world", "get_greeting", "Restored")
    print(f"\n验证插件功能正常: {greeting[:50]}...")


def demo_security_audit(manager):
    """演示安全和审计功能"""
    print("\n" + "=" * 60)
    print("7. 安全审计演示")
    print("=" * 60)

    logger.info("查看 hello_world 插件的权限...")
    requested = manager.security.get_requested_permissions("hello_world")
    granted = manager.security.get_granted_permissions("hello_world")
    print(f"\n请求的权限: {requested}")
    print(f"授予的权限: {granted}")

    logger.info("查看审计日志...")
    audit_logs = manager.security.get_audit_log(limit=5)
    print(f"\n最近 {len(audit_logs)} 条审计记录:")
    for log in audit_logs[:3]:
        status = "✓" if log.granted else "✗"
        print(f"  {status} {log.action}: {log.resource} ({log.plugin_name})")


def main():
    print("\n" + "#" * 60)
    print("# Python 插件系统演示")
    print("#" * 60)

    manager = None
    try:
        manager = demo_basic_usage()

        demo_plugin_method_call(manager)
        demo_rpc_service(manager)
        demo_event_system(manager)
        demo_config_system(manager)
        demo_lifecycle_management(manager)
        demo_security_audit(manager)

        print("\n" + "=" * 60)
        print("所有演示完成!")
        print("=" * 60)

    except Exception as e:
        logger.error(f"演示出错: {e}", exc_info=True)
        sys.exit(1)

    finally:
        if manager:
            logger.info("关闭插件管理器...")
            manager.shutdown()
            logger.info("完成!")


if __name__ == "__main__":
    main()
