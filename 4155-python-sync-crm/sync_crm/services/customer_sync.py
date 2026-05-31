"""
客户主数据同步服务
"""
from datetime import datetime
from typing import Dict, Any, Optional, List

from sqlalchemy.orm import Session

from sync_crm.config import settings
from sync_crm.models.mapping import EntityType
from sync_crm.models.entities import Customer
from sync_crm.services.base import SyncService, SyncDirection
from sync_crm.infrastructure.logging import get_logger
from sync_crm.utils.sync_source import SyncOrigin, mark_sync_source

logger = get_logger(__name__)


class CustomerSyncService(SyncService):
    """客户主数据同步服务"""

    entity_type = EntityType.CUSTOMER
    direction = SyncDirection.CRM_TO_MARKETING

    def __init__(self, db_session: Session):
        super().__init__(db_session)

    def sync_customer_created(self, customer_id: str, customer_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        客户创建事件触发同步

        新增客户时先在CRM创建，然后同步到营销平台，
        营销平台返回的ID要回写到映射表。
        """
        logger.info(f"客户创建事件同步: customer_id={customer_id}")

        customer = Customer(**customer_data)
        customer.id = customer_id
        customer = mark_sync_source(customer.model_dump(), SyncOrigin.CRM)

        result = self.sync_manual(
            record_ids=[customer_id],
            direction=SyncDirection.CRM_TO_MARKETING,
            operator="event_listener",
        )

        return result

    def sync_customer_updated(self, customer_id: str, customer_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        客户更新事件触发同步

        更新时走映射表，根据CRM ID找到营销平台ID进行更新。
        """
        logger.info(f"客户更新事件同步: customer_id={customer_id}")

        result = self.sync_manual(
            record_ids=[customer_id],
            direction=SyncDirection.CRM_TO_MARKETING,
            operator="event_listener",
        )

        return result

    def sync_customer_deleted(self, customer_id: str) -> Dict[str, Any]:
        """
        客户删除事件处理

        软删除映射记录，不物理删除，方便对账。
        """
        from sync_crm.models.mapping import SyncMapping, MappingStatus

        logger.info(f"客户删除事件处理: customer_id={customer_id}")

        mapping = SyncMapping.find_by_local(
            self.db_session, customer_id, EntityType.CUSTOMER
        )

        if mapping:
            mapping.mark_deleted()
            self.db_session.commit()
            logger.info(f"已标记客户映射为软删除: local_id={customer_id}, remote_id={mapping.remote_id}")

        return {
            "status": "success",
            "customer_id": customer_id,
            "action": "soft_deleted",
        }

    def get_customer_mapping(self, customer_id: str) -> Optional[Dict[str, Any]]:
        """获取客户映射关系"""
        from sync_crm.models.mapping import SyncMapping

        mapping = SyncMapping.find_by_local(
            self.db_session, customer_id, EntityType.CUSTOMER
        )

        if mapping:
            return {
                "local_id": mapping.local_id,
                "remote_id": mapping.remote_id,
                "entity_type": mapping.entity_type.value,
                "last_sync_time": mapping.last_sync_time,
                "sync_version": mapping.sync_version,
                "status": mapping.status.value,
            }
        return None

    def get_customer_by_remote_id(self, remote_id: str) -> Optional[Dict[str, Any]]:
        """根据营销平台ID查找客户"""
        from sync_crm.models.mapping import SyncMapping

        mapping = SyncMapping.find_by_remote(
            self.db_session, remote_id, EntityType.CUSTOMER
        )

        if mapping:
            return {
                "local_id": mapping.local_id,
                "remote_id": mapping.remote_id,
                "entity_type": mapping.entity_type.value,
                "last_sync_time": mapping.last_sync_time,
            }
        return None

    def mark_as_customer_converted(
        self,
        customer_id: str,
        order_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        标记客户为成交客户

        当客户签约时，在营销平台标记为成交用户，
        触发相应的营销动作。
        """
        from sync_crm.models.mapping import SyncMapping

        logger.info(f"标记客户为成交客户: customer_id={customer_id}")

        mapping = SyncMapping.find_by_local(
            self.db_session, customer_id, EntityType.CUSTOMER
        )

        if not mapping or not mapping.remote_id:
            logger.warning(f"客户映射不存在，跳过标记成交: customer_id={customer_id}")
            return {"status": "skipped", "reason": "no_mapping"}

        try:
            data = order_data or {}
            data["converted"] = True
            data["converted_at"] = datetime.utcnow().isoformat()

            result = self.marketing_adapter.mark_customer_converted(
                mapping.remote_id, data
            )

            logger.info(f"客户成交标记成功: customer_id={customer_id}, remote_id={mapping.remote_id}")

            return {
                "status": "success",
                "customer_id": customer_id,
                "remote_id": mapping.remote_id,
                "result": result,
            }

        except Exception as e:
            logger.error(
                f"标记客户成交失败: customer_id={customer_id}, error={e}",
                exc_info=True,
            )
            raise

    def batch_sync_by_region(self, region: str) -> Dict[str, Any]:
        """
        按地区批量同步客户

        用于修复某个地区的数据问题。
        """
        logger.info(f"按地区批量同步客户: region={region}")

        result = self.sync_manual(
            direction=SyncDirection.CRM_TO_MARKETING,
            operator="manual_region_sync",
        )
        result["region"] = region

        return result

    def batch_sync_by_industry(self, industry: str) -> Dict[str, Any]:
        """
        按行业批量同步客户

        用于修复某个行业的数据问题。
        """
        logger.info(f"按行业批量同步客户: industry={industry}")

        result = self.sync_manual(
            direction=SyncDirection.CRM_TO_MARKETING,
            operator="manual_industry_sync",
        )
        result["industry"] = industry

        return result
