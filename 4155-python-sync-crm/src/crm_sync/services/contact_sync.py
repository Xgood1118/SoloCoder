from datetime import datetime
from typing import Any, Dict, List, Optional

from loguru import logger
from sqlalchemy.orm import Session

from crm_sync.adapters import CRMAdapter, MarketingAdapter
from crm_sync.config import get_settings
from crm_sync.core import SyncResult
from crm_sync.models import SyncMapping, MappingStatus
from .base_sync import BaseSyncService, SyncDirection


class ContactSyncService(BaseSyncService):
    def __init__(
        self,
        direction: SyncDirection = SyncDirection.CRM_TO_MARKETING,
        db_session: Optional[Session] = None,
    ):
        super().__init__(
            entity_type="contact",
            direction=direction,
            db_session=db_session,
        )
        self.settings = get_settings()

    def get_customer_contacts(self, customer_id: str) -> List[Dict[str, Any]]:
        crm_adapter = CRMAdapter(self.db)
        crm_source = crm_adapter.get_source("contact")
        return crm_source.read_batch(
            batch_size=100,
            customer_id=customer_id,
        )

    def get_default_contact(self, customer_id: str) -> Optional[Dict[str, Any]]:
        contacts = self.get_customer_contacts(customer_id)
        for contact in contacts:
            if contact.get("is_default"):
                return contact
        return contacts[0] if contacts else None

    def set_default_contact(
        self,
        customer_id: str,
        contact_id: str,
    ) -> bool:
        logger.info(f"Setting default contact {contact_id} for customer {customer_id}")

        crm_adapter = CRMAdapter(self.db)
        crm_target = crm_adapter.get_target("contact", self.db)

        try:
            contacts = self.get_customer_contacts(customer_id)
            for contact in contacts:
                c_id = str(contact.get("id"))
                if c_id == contact_id:
                    crm_target.update(c_id, {"is_default": True})
                else:
                    crm_target.update(c_id, {"is_default": False})
            return True
        except Exception as e:
            logger.error(f"Failed to set default contact: {e}")
            return False

    def sync_inactive_contacts(
        self,
        customer_id: Optional[str] = None,
    ) -> SyncResult:
        logger.info("Syncing inactive contacts")

        crm_adapter = CRMAdapter(self.db)
        crm_source = crm_adapter.get_source("contact")

        params = {"is_active": False}
        if customer_id:
            params["customer_id"] = customer_id

        inactive_contacts = crm_source.read_batch(
            batch_size=self.settings.sync.batch_size,
            **params,
        )

        marketing_adapter = MarketingAdapter(self.db)
        marketing_target = marketing_adapter.get_target("contact", self.db)

        processed = 0
        for contact in inactive_contacts:
            contact_id = contact.get("id")
            if not contact_id:
                continue

            mapping = (
                self.db.query(SyncMapping)
                .filter(
                    SyncMapping.local_id == str(contact_id),
                    SyncMapping.entity_type == "contact",
                    SyncMapping.status == MappingStatus.ACTIVE,
                )
                .first()
            )

            if mapping and mapping.remote_id:
                marketing_target.update(
                    mapping.remote_id,
                    {"status": "inactive"},
                )
                processed += 1

        from crm_sync.core import SyncResult as CoreSyncResult, PipelineContext

        context = PipelineContext(
            entity_type="contact",
            operation_type="incremental",
        )
        context.success_count = processed
        context.total_records = len(inactive_contacts)

        return CoreSyncResult(
            success=True,
            context=context,
            message=f"Synced {processed} inactive contacts",
        )

    def handle_contact_departure(
        self,
        contact_id: str,
        transfer_to_contact_id: Optional[str] = None,
    ) -> bool:
        logger.info(f"Handling contact departure: {contact_id}")

        crm_adapter = CRMAdapter(self.db)
        crm_target = crm_adapter.get_target("contact", self.db)

        try:
            crm_target.update(contact_id, {"is_active": False})

            if transfer_to_contact_id:
                mapping = (
                    self.db.query(SyncMapping)
                    .filter(
                        SyncMapping.local_id == str(contact_id),
                        SyncMapping.entity_type == "contact",
                    )
                    .first()
                )
                if mapping:
                    mapping.mark_deleted()
                    self.db.commit()

            return True
        except Exception as e:
            logger.error(f"Failed to handle contact departure: {e}")
            return False
