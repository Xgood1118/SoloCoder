"""
CRM系统适配器
实现与自研CRM系统的API对接
"""
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Generator, AsyncGenerator

import httpx
import requests
from sqlalchemy.orm import Session

from sync_crm.config import settings
from sync_crm.models.mapping import EntityType, SyncMapping, MappingStatus
from sync_crm.pipeline.base import Source, Target, PipelineContext
from sync_crm.infrastructure.retry import retry_with_backoff, retry_with_backoff_async
from sync_crm.infrastructure.logging import get_logger
from sync_crm.utils.sync_source import check_sync_loop, SyncOrigin

logger = get_logger(__name__)


class CRMHttpClient:
    """CRM HTTP客户端"""

    def __init__(self):
        self.base_url = settings.crm.base_url.rstrip("/")
        self.api_key = settings.crm.api_key
        self.timeout = settings.crm.timeout
        self.max_attempts = settings.crm.retry_max_attempts
        self.health_check_path = settings.crm.health_check_path

    def _get_headers(self) -> Dict[str, str]:
        """获取请求头"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def health_check(self) -> bool:
        """健康检查"""
        try:
            response = requests.get(
                f"{self.base_url}{self.health_check_path}",
                headers=self._get_headers(),
                timeout=5,
            )
            return response.status_code == 200
        except Exception as e:
            logger.warning(f"CRM健康检查失败: {e}")
            return False

    @retry_with_backoff(
        max_attempts=5,
        wait_min=1.0,
        wait_max=60.0,
        retry_exceptions=(requests.RequestException, httpx.HTTPError),
    )
    def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """发送GET请求"""
        response = requests.get(
            f"{self.base_url}/{endpoint.lstrip('/')}",
            headers=self._get_headers(),
            params=params,
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.json()

    @retry_with_backoff(
        max_attempts=5,
        wait_min=1.0,
        wait_max=60.0,
        retry_exceptions=(requests.RequestException, httpx.HTTPError),
    )
    def post(self, endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """发送POST请求"""
        response = requests.post(
            f"{self.base_url}/{endpoint.lstrip('/')}",
            headers=self._get_headers(),
            json=data,
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.json()

    @retry_with_backoff(
        max_attempts=5,
        wait_min=1.0,
        wait_max=60.0,
        retry_exceptions=(requests.RequestException, httpx.HTTPError),
    )
    def put(self, endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """发送PUT请求"""
        response = requests.put(
            f"{self.base_url}/{endpoint.lstrip('/')}",
            headers=self._get_headers(),
            json=data,
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.json()

    @retry_with_backoff_async(
        max_attempts=5,
        wait_min=1.0,
        wait_max=60.0,
        retry_exceptions=(httpx.HTTPError,),
    )
    async def get_async(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """异步发送GET请求"""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.base_url}/{endpoint.lstrip('/')}",
                headers=self._get_headers(),
                params=params,
            )
            response.raise_for_status()
            return response.json()

    @retry_with_backoff_async(
        max_attempts=5,
        wait_min=1.0,
        wait_max=60.0,
        retry_exceptions=(httpx.HTTPError,),
    )
    async def post_async(self, endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """异步发送POST请求"""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/{endpoint.lstrip('/')}",
                headers=self._get_headers(),
                json=data,
            )
            response.raise_for_status()
            return response.json()

    @retry_with_backoff_async(
        max_attempts=5,
        wait_min=1.0,
        wait_max=60.0,
        retry_exceptions=(httpx.HTTPError,),
    )
    async def put_async(self, endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """异步发送PUT请求"""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.put(
                f"{self.base_url}/{endpoint.lstrip('/')}",
                headers=self._get_headers(),
                json=data,
            )
            response.raise_for_status()
            return response.json()


class CRMSource(Source):
    """CRM数据源实现"""

    _ENDPOINT_MAP = {
        EntityType.CUSTOMER: "customers",
        EntityType.CONTACT: "contacts",
        EntityType.LEAD: "leads",
        EntityType.ORDER: "orders",
        EntityType.OPPORTUNITY: "opportunities",
    }

    def __init__(self, entity_type: EntityType, http_client: CRMHttpClient, db_session: Session):
        super().__init__(entity_type)
        self.http_client = http_client
        self.db_session = db_session
        self.endpoint = self._ENDPOINT_MAP.get(entity_type, "records")

    def health_check(self) -> bool:
        """健康检查"""
        return self.http_client.health_check()

    def get_count(self, last_sync_time: Optional[datetime] = None) -> int:
        """获取待同步数据总数"""
        try:
            params = {"count_only": "true"}
            if last_sync_time:
                params["updated_after"] = last_sync_time.isoformat()
            result = self.http_client.get(self.endpoint, params=params)
            return result.get("total", 0)
        except Exception as e:
            logger.error(f"获取CRM数据总数失败: {e}")
            return 0

    def read(
        self,
        context: PipelineContext,
        last_sync_time: Optional[datetime] = None,
        batch_size: int = 100,
    ) -> Generator[Dict[str, Any], None, None]:
        """
        从CRM读取数据

        Args:
            context: 管道上下文
            last_sync_time: 上次同步时间，用于增量同步
            batch_size: 每批读取条数

        Yields:
            CRM数据记录
        """
        page = 1
        has_more = True

        while has_more:
            try:
                params = {
                    "page": page,
                    "page_size": batch_size,
                    "order_by": "updated_at",
                    "order_dir": "asc",
                }
                if last_sync_time:
                    params["updated_after"] = last_sync_time.isoformat()

                result = self.http_client.get(self.endpoint, params=params)
                records = result.get("data", [])
                has_more = len(records) == batch_size
                page += 1

                for record in records:
                    if check_sync_loop(record, SyncOrigin.MARKETING):
                        context.records_skipped += 1
                        continue
                    yield record

            except Exception as e:
                logger.error(
                    f"从CRM读取数据失败: entity={self.entity_type.value}, page={page}, error={e}",
                    exc_info=True,
                )
                raise

    async def read_async(
        self,
        context: PipelineContext,
        last_sync_time: Optional[datetime] = None,
        batch_size: int = 100,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """异步从CRM读取数据"""
        page = 1
        has_more = True

        while has_more:
            try:
                params = {
                    "page": page,
                    "page_size": batch_size,
                    "order_by": "updated_at",
                    "order_dir": "asc",
                }
                if last_sync_time:
                    params["updated_after"] = last_sync_time.isoformat()

                result = await self.http_client.get_async(self.endpoint, params=params)
                records = result.get("data", [])
                has_more = len(records) == batch_size
                page += 1

                for record in records:
                    if check_sync_loop(record, SyncOrigin.MARKETING):
                        context.records_skipped += 1
                        continue
                    yield record

            except Exception as e:
                logger.error(
                    f"异步从CRM读取数据失败: entity={self.entity_type.value}, page={page}, error={e}",
                    exc_info=True,
                )
                raise


class CRMTarget(Target):
    """CRM目标系统实现"""

    _ENDPOINT_MAP = {
        EntityType.CUSTOMER: "customers",
        EntityType.CONTACT: "contacts",
        EntityType.LEAD: "leads",
        EntityType.ORDER: "orders",
        EntityType.OPPORTUNITY: "opportunities",
    }

    def __init__(self, entity_type: EntityType, http_client: CRMHttpClient, db_session: Session):
        super().__init__(entity_type)
        self.http_client = http_client
        self.db_session = db_session
        self.endpoint = self._ENDPOINT_MAP.get(entity_type, "records")

    def health_check(self) -> bool:
        """健康检查"""
        return self.http_client.health_check()

    def write(
        self,
        record: Dict[str, Any],
        context: PipelineContext,
    ) -> Optional[Dict[str, Any]]:
        """
        写入数据到CRM

        Args:
            record: 待写入的数据
            context: 管道上下文

        Returns:
            写入后的结果
        """
        if check_sync_loop(record, SyncOrigin.CRM):
            logger.debug(f"检测到循环同步，跳过: id={record.get('id')}")
            return None

        try:
            remote_id = record.get("remote_id") or record.get("id")
            mapping = SyncMapping.find_by_remote(
                self.db_session, str(remote_id), self.entity_type
            )

            if mapping and mapping.local_id:
                result = self.http_client.put(
                    f"{self.endpoint}/{mapping.local_id}", record
                )
                logger.info(
                    f"更新CRM记录成功: entity={self.entity_type.value}, "
                    f"local_id={mapping.local_id}"
                )
            else:
                result = self.http_client.post(self.endpoint, record)
                logger.info(
                    f"创建CRM记录成功: entity={self.entity_type.value}, "
                    f"new_id={result.get('id')}"
                )

            return result

        except Exception as e:
            logger.error(
                f"写入CRM失败: entity={self.entity_type.value}, "
                f"record_id={record.get('id')}, error={e}",
                exc_info=True,
            )
            raise

    async def write_async(
        self,
        record: Dict[str, Any],
        context: PipelineContext,
    ) -> Optional[Dict[str, Any]]:
        """异步写入数据到CRM"""
        if check_sync_loop(record, SyncOrigin.CRM):
            logger.debug(f"检测到循环同步，跳过: id={record.get('id')}")
            return None

        try:
            remote_id = record.get("remote_id") or record.get("id")
            mapping = SyncMapping.find_by_remote(
                self.db_session, str(remote_id), self.entity_type
            )

            if mapping and mapping.local_id:
                result = await self.http_client.put_async(
                    f"{self.endpoint}/{mapping.local_id}", record
                )
            else:
                result = await self.http_client.post_async(self.endpoint, record)

            return result

        except Exception as e:
            logger.error(
                f"异步写入CRM失败: entity={self.entity_type.value}, "
                f"record_id={record.get('id')}, error={e}",
                exc_info=True,
            )
            raise

    def update_mapping(self, local_id: str, remote_id: str) -> None:
        """更新映射关系"""
        if not local_id or not remote_id:
            return

        try:
            mapping = SyncMapping.find_by_local(self.db_session, local_id, self.entity_type)
            if mapping:
                mapping.remote_id = remote_id
                mapping.last_sync_time = datetime.utcnow()
                mapping.increment_version()
            else:
                mapping = SyncMapping(
                    local_id=local_id,
                    remote_id=remote_id,
                    entity_type=self.entity_type,
                    last_sync_time=datetime.utcnow(),
                    status=MappingStatus.ACTIVE,
                )
                self.db_session.add(mapping)
            self.db_session.commit()
        except Exception as e:
            logger.error(f"更新映射关系失败: local_id={local_id}, error={e}")
            self.db_session.rollback()


class CRMAdapter:
    """CRM适配器门面类"""

    def __init__(self, db_session: Session):
        self.db_session = db_session
        self.http_client = CRMHttpClient()

    def get_source(self, entity_type: EntityType) -> CRMSource:
        """获取CRM数据源"""
        return CRMSource(entity_type, self.http_client, self.db_session)

    def get_target(self, entity_type: EntityType) -> CRMTarget:
        """获取CRM目标系统"""
        return CRMTarget(entity_type, self.http_client, self.db_session)

    def health_check(self) -> bool:
        """健康检查"""
        return self.http_client.health_check()
