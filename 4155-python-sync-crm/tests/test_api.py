"""
API接口测试
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi import status


@pytest.mark.unit
class TestHealthEndpoints:
    """健康检查接口测试"""

    def test_health_check(self, app_client):
        """测试健康检查接口"""
        response = app_client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "app" in data
        assert "version" in data

    def test_ready_check(self, app_client):
        """测试就绪检查接口"""
        with patch("sync_crm.api.app.engine") as mock_engine, \
             patch("sync_crm.api.app.get_redis_client") as mock_redis:

            mock_conn = MagicMock()
            mock_engine.connect.return_value.__enter__.return_value = mock_conn
            mock_redis.return_value.ping.return_value = True

            response = app_client.get("/ready")
            assert response.status_code == 200
            data = response.json()
            assert "status" in data
            assert "checks" in data


@pytest.mark.unit
class TestSyncEndpoints:
    """同步管理接口测试"""

    def test_get_sync_status(self, app_client, db_session):
        """测试获取同步状态"""
        with patch("sync_crm.api.routes.sync.CustomerSyncService") as mock_service:
            mock_instance = MagicMock()
            mock_instance.get_sync_status.return_value = {
                "last_sync_time": "2024-01-01T12:00:00",
                "latest_tasks": [],
            }
            mock_instance.check_delay.return_value = (False, 60)
            mock_service.return_value = mock_instance

            response = app_client.get("/api/v1/sync/status/customer")
            assert response.status_code == 200
            data = response.json()
            assert data["entity_type"] == "customer"
            assert data["is_delay"] is False
            assert data["delay_seconds"] == 60

    def test_get_sync_status_invalid_entity(self, app_client):
        """测试获取同步状态 - 无效实体类型"""
        response = app_client.get("/api/v1/sync/status/invalid")
        assert response.status_code == 422

    def test_trigger_incremental_sync(self, app_client):
        """测试触发增量同步"""
        with patch("sync_crm.api.routes.sync.CustomerSyncService") as mock_service:
            mock_instance = MagicMock()
            mock_instance.sync_incremental.return_value = {
                "task_id": "task-001",
                "status": "success",
            }
            mock_service.return_value = mock_instance

            response = app_client.post(
                "/api/v1/sync/incremental/customer",
                json={"operator": "test_user"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["task_id"] == "task-001"
            assert "增量同步已触发" in data["message"]

    def test_trigger_full_sync(self, app_client):
        """测试触发全量同步"""
        with patch("sync_crm.api.routes.sync.sync_customer_full") as mock_task:
            mock_task.delay.return_value.id = "async-task-001"

            response = app_client.post(
                "/api/v1/sync/full/customer",
                json={"operator": "test_user"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["task_id"] == "async-task-001"
            assert data["status"] == "queued"

    def test_get_task_status(self, app_client):
        """测试查询任务状态"""
        with patch("sync_crm.api.routes.sync.celery_app") as mock_celery:
            mock_result = MagicMock()
            mock_result.state = "SUCCESS"
            mock_result.ready.return_value = True
            mock_result.result = {"status": "completed"}
            mock_result.failed.return_value = False
            mock_result.traceback = None
            mock_celery.AsyncResult.return_value = mock_result

            response = app_client.get("/api/v1/sync/task/test-task-001")
            assert response.status_code == 200
            data = response.json()
            assert data["task_id"] == "test-task-001"
            assert data["status"] == "SUCCESS"

    def test_customer_event_callback(self, app_client):
        """测试客户变更事件回调"""
        with patch("sync_crm.api.routes.sync.sync_customer_event") as mock_task:
            mock_task.delay.return_value.id = "event-task-001"

            response = app_client.post(
                "/api/v1/sync/event/customer",
                params={
                    "customer_id": "1001",
                    "operation": "created",
                },
            )
            assert response.status_code == 200
            data = response.json()
            assert data["task_id"] == "event-task-001"
            assert "事件已接收" in data["message"]

    def test_customer_event_callback_invalid_operation(self, app_client):
        """测试客户变更事件回调 - 无效操作"""
        response = app_client.post(
            "/api/v1/sync/event/customer",
            params={
                "customer_id": "1001",
                "operation": "invalid_op",
            },
        )
        assert response.status_code == 400


@pytest.mark.unit
class TestConfigEndpoints:
    """配置管理接口测试"""

    def test_list_field_mappings(self, app_client, db_session, create_test_field_mapping):
        """测试查询字段映射列表"""
        create_test_field_mapping(source_field="field1")
        create_test_field_mapping(source_field="field2")

        response = app_client.get("/api/v1/config/field-mapping")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 2

    def test_get_conversion_rules(self, app_client):
        """测试获取转换规则"""
        response = app_client.get("/api/v1/config/conversion-rules")
        assert response.status_code == 200
        data = response.json()
        assert "conversion_rules" in data
        assert "field_types" in data
        assert "missing_actions" in data


@pytest.mark.unit
class TestMonitorEndpoints:
    """监控统计接口测试"""

    def test_get_statistics_async(self, app_client):
        """测试获取统计数据 - 异步模式"""
        with patch("sync_crm.api.routes.monitor.get_sync_statistics") as mock_task:
            mock_task.delay.return_value.id = "stats-task-001"

            response = app_client.get("/api/v1/monitor/statistics?async_mode=true")
            assert response.status_code == 200
            data = response.json()
            assert data["task_id"] == "stats-task-001"
            assert data["status"] == "queued"

    def test_celery_health_check(self, app_client):
        """测试Celery健康检查"""
        with patch("sync_crm.api.routes.monitor.ping") as mock_task:
            mock_task.delay.return_value.get.return_value = {"status": "ok"}

            response = app_client.get("/api/v1/monitor/health/celery")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"

    def test_test_alert(self, app_client):
        """测试告警通道"""
        with patch("sync_crm.api.routes.monitor.get_alert_notifier") as mock_notifier:
            mock_instance = MagicMock()
            mock_instance.send_alert.return_value = {"dingtalk": True, "email": False}
            mock_notifier.return_value = mock_instance

            response = app_client.post(
                "/api/v1/monitor/test-alert",
                params={
                    "level": "info",
                    "title": "测试告警",
                    "content": "测试内容",
                },
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success_count"] == 1
            assert data["failed_count"] == 1


@pytest.mark.unit
class TestMappingEndpoints:
    """映射管理接口测试"""

    def test_list_mappings(self, app_client, db_session, create_test_mapping):
        """测试查询映射列表"""
        create_test_mapping(local_id="1001", remote_id="r1001")
        create_test_mapping(local_id="1002", remote_id="r1002")

        response = app_client.get("/api/v1/mapping")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 2

    def test_resolve_mapping(self, app_client, db_session, create_test_mapping):
        """测试解析映射关系"""
        mapping = create_test_mapping(local_id="resolve-test", remote_id="remote-resolve")

        response = app_client.post(
            "/api/v1/mapping/resolve",
            params={"entity_type": "customer"},
            json={"local_id": "resolve-test"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["found"] is True
        assert data["mapping"]["local_id"] == "resolve-test"

    def test_get_conflict_mappings(self, app_client, db_session, create_test_mapping):
        """测试获取冲突映射列表"""
        create_test_mapping(status="conflict", local_id="conflict-1")
        create_test_mapping(status="conflict", local_id="conflict-2")

        response = app_client.get("/api/v1/mapping/conflicts")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 2

    def test_increment_version(self, app_client, db_session, create_test_mapping):
        """测试递增映射版本"""
        mapping = create_test_mapping()
        old_version = mapping.sync_version

        response = app_client.post(f"/api/v1/mapping/{mapping.id}/increment-version")
        assert response.status_code == 200
        data = response.json()
        assert data["old_version"] == old_version
        assert data["new_version"] == old_version + 1
