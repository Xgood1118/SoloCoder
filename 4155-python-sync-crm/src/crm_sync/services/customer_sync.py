from datetime import datetime
from typing import Any, Dict, List, Optional

from loguru import logger
from sqlalchemy.orm import Session

from crm_sync.adapters import CRMAdapter, MarketingAdapter
from crm_sync.config import get_settings
from crm_sync.core import SyncResult
from crm_sync.models import SyncMapping, MappingStatus
from .base_sync import BaseSyncService, SyncDirection


class CustomerSyncService(BaseSyncService):
    def __init__(
        self,
        direction: SyncDirection = SyncDirection.CRM_TO_MARKETING,
        db_session: Optional[Session] = None,
    ):
        super().__init__(
            entity_type="customer",
            direction=direction,
            db_session=db_session,
        )
        self.settings = get_settings()

    def get_customers_with_pending_contacts(self) -> List[Dict[str, Any]]:
        crm_adapter = CRMAdapter(self.db)
        crm_source = crm_adapter.get_source("customer")
        return crm_source.read_batch(100)

    def sync_customer_with_contacts(
        self,
        customer_id: str,
        since: Optional[datetime] = None,
    ) -> Dict[str, SyncResult]:
        logger.info(f"Syncing customer {customer_id} with contacts")

        from .contact_sync import ContactSyncService

        contact_service = ContactSyncService(
            direction=self.direction,
            db_session=self.db,
        )

        customer_result = self.sync_single(customer_id)

        crm_adapter = CRMAdapter(self.db)
        crm_source = crm_adapter.get_source("contact")
        contacts = crm_source.read_batch(
            batch_size=100,
            customer_id=customer_id,
        )

        contact_results = []
        for contact in contacts:
            contact_id = contact.get("id")
            if contact_id:
                result = contact_service.sync_single(str(contact_id))
                contact_results.append(result)

        return {
            "customer": customer_result,
            "contacts": contact_results,
        }

    def get_orphan_customers(self) -> List[Dict[str, Any]]:
        marketing_adapter = MarketingAdapter(self.db)
        marketing_source = marketing_adapter.get_source("customer")
        customers = marketing_source.read_batch(1000)

        orphans = []
        for customer in customers:
            remote_id = customer.get("uuid") or customer.get("id")
            if not remote_id:
                continue

            mapping = (
                self.db.query(SyncMapping)
                .filter(
                    SyncMapping.remote_id == str(remote_id),
                    SyncMapping.entity_type == "customer",
                    SyncMapping.status == MappingStatus.ACTIVE,
                )
                .first()
            )

            if not mapping:
                orphans.append(
                    {
                        "remote_id": remote_id,
                        "customer_name": customer.get("name"),
                    }
                )

        return orphans

    def merge_duplicate_customers(
        self,
        primary_id: str,
        duplicate_ids: List[str],
    ) -> bool:
        logger.info(f"Merging customers: primary={primary_id}, duplicates={duplicate_ids}")

        crm_adapter = CRMAdapter(self.db)
        crm_target = crm_adapter.get_target("customer", self.db)

        try:
            for dup_id in duplicate_ids:
                mapping = (
                    self.db.query(SyncMapping)
                    .filter(
                        SyncMapping.local_id == str(dup_id),
                        SyncMapping.entity_type == "customer",
                    )
                    .first()
                )
                if mapping:
                    mapping.mark_deleted()
                    self.db.commit()

            logger.info(f"Successfully merged customers")
            return True
        except Exception as e:
            logger.error(f"Failed to merge customers: {e}")
            return False
