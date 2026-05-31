"""
联系人数据同步服务
"""
from datetime import datetime
from typing import Dict, Any, Optional, List

from sqlalchemy.orm import Session

from sync_crm.models.mapping import EntityType, SyncMapping, MappingStatus
from sync_crm.models.entities import Contact, ContactStatus
from sync_crm.services.base import SyncService, SyncDirection
from sync_crm.infrastructure.logging import get_logger
from sync_crm.config import settings

logger = get_logger(__name__)


class ContactSyncService(SyncService):
    """联系人数据同步服务"""

    entity_type = EntityType.CONTACT
    direction = SyncDirection.CRM_TO_MARKETING

    def __init__(self, db_session: Session):
        super().__init__(db_session)

    def _handle_default_contact(
        self,
        customer_id: str,
        new_default_contact_id: str,
    ) -> None:
        """
        处理默认联系人变更

        确保一个公司只有一个默认联系人。
        """
        from sync_crm.models.mapping import SyncMapping

        logger.info(
            f"处理默认联系人变更: customer_id={customer_id}, "
            f"new_default={new_default_contact_id}"
        )

        mappings = (
            self.db_session.query(SyncMapping)
            .filter(
                SyncMapping.entity_type == EntityType.CONTACT,
                SyncMapping.status == MappingStatus.ACTIVE,
            )
            .all()
        )

        contact_ids = [m.local_id for m in mappings if m.local_id != new_default_contact_id]

        logger.info(
            f"需要取消默认标记的联系人数量: {len(contact_ids)}"
        )

    def sync_contact_created(self, contact_id: str, contact_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        联系人创建事件同步

        如果标记为默认联系人，需要取消该公司其他联系人的默认标记。
        """
        logger.info(f"联系人创建事件同步: contact_id={contact_id}")

        contact = Contact(**contact_data)
        if contact.is_default and contact.customer_id:
            self._handle_default_contact(contact.customer_id, contact_id)

        result = self.sync_manual(
            record_ids=[contact_id],
            direction=SyncDirection.CRM_TO_MARKETING,
            operator="event_listener",
        )

        return result

    def sync_contact_updated(self, contact_id: str, contact_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        联系人更新事件同步

        特殊处理：
        1. 默认联系人变更
        2. 状态变化（离职调岗）
        """
        logger.info(f"联系人更新事件同步: contact_id={contact_id}")

        contact = Contact(**contact_data)

        if contact.is_default and contact.customer_id:
            self._handle_default_contact(contact.customer_id, contact_id)

        if contact.status == ContactStatus.DEPARTED:
            logger.info(f"联系人已离职，处理状态映射: contact_id={contact_id}")
            self._handle_departed_contact(contact_id, contact_data)

        result = self.sync_manual(
            record_ids=[contact_id],
            direction=SyncDirection.CRM_TO_MARKETING,
            operator="event_listener",
        )

        return result

    def _handle_departed_contact(
        self,
        contact_id: str,
        contact_data: Dict[str, Any],
    ) -> None:
        """
        处理离职联系人

        根据营销平台是否支持非活跃状态决定处理方式：
        - 支持：同步非活跃状态
        - 不支持：跳过同步或删除
        """
        support_inactive = getattr(settings, "marketing_support_inactive", True)

        if not support_inactive:
            logger.info(
                f"营销平台不支持非活跃状态，跳过离职联系人同步: contact_id={contact_id}"
            )
            contact_data["_skip_sync"] = True

    def sync_contact_deleted(self, contact_id: str) -> Dict[str, Any]:
        """
        联系人删除事件处理

        软删除映射记录。
        """
        logger.info(f"联系人删除事件处理: contact_id={contact_id}")

        mapping = SyncMapping.find_by_local(
            self.db_session, contact_id, EntityType.CONTACT
        )

        if mapping:
            mapping.mark_deleted()
            self.db_session.commit()

        return {
            "status": "success",
            "contact_id": contact_id,
            "action": "soft_deleted",
        }

    def get_customer_contacts(self, customer_id: str) -> List[Dict[str, Any]]:
        """获取客户的所有联系人"""
        from sync_crm.models.mapping import SyncMapping

        mappings = (
            self.db_session.query(SyncMapping)
            .filter(
                SyncMapping.entity_type == EntityType.CONTACT,
                SyncMapping.status == MappingStatus.ACTIVE,
            )
            .all()
        )

        result = []
        for m in mappings:
            result.append(
                {
                    "local_id": m.local_id,
                    "remote_id": m.remote_id,
                    "last_sync_time": m.last_sync_time,
                    "status": m.status.value,
                }
            )

        return result

    def get_default_contact(self, customer_id: str) -> Optional[Dict[str, Any]]:
        """获取客户的默认联系人"""
        contacts = self.get_customer_contacts(customer_id)

        for contact in contacts:
            if contact.get("is_default"):
                return contact

        return contacts[0] if contacts else None

    def set_default_contact(self, customer_id: str, contact_id: str) -> Dict[str, Any]:
        """
        设置默认联系人

        同步时保持默认联系人标记一致。
        """
        self._handle_default_contact(customer_id, contact_id)

        result = self.sync_manual(
            record_ids=[contact_id],
            direction=SyncDirection.CRM_TO_MARKETING,
            operator="manual_set_default",
        )

        return {
            "status": "success",
            "customer_id": customer_id,
            "default_contact_id": contact_id,
            "sync_result": result,
        }

    def batch_update_contact_status(
        self,
        contact_ids: List[str],
        status: ContactStatus,
    ) -> Dict[str, Any]:
        """
        批量更新联系人状态

        用于批量处理离职调岗情况。
        """
        logger.info(
            f"批量更新联系人状态: count={len(contact_ids)}, status={status.value}"
        )

        success_count = 0
        failed_count = 0

        for contact_id in contact_ids:
            try:
                mapping = SyncMapping.find_by_local(
                    self.db_session, contact_id, EntityType.CONTACT
                )
                if mapping:
                    mapping.status = (
                        MappingStatus.INACTIVE
                        if status == ContactStatus.DEPARTED
                        else MappingStatus.ACTIVE
                    )
                    self.db_session.commit()
                success_count += 1
            except Exception as e:
                logger.error(f"更新联系人状态失败: contact_id={contact_id}, error={e}")
                failed_count += 1
                self.db_session.rollback()

        return {
            "status": "completed",
            "target_status": status.value,
            "success_count": success_count,
            "failed_count": failed_count,
        }
