from datetime import datetime
from typing import Any, Dict, List, Optional

from loguru import logger
from sqlalchemy.orm import Session

from crm_sync.adapters import CRMAdapter, MarketingAdapter
from crm_sync.config import get_settings
from crm_sync.core import SyncResult
from crm_sync.models import SyncMapping, MappingStatus
from .base_sync import BaseSyncService, SyncDirection


class LeadMergeStrategy(str):
    SKIP = "skip"
    OVERWRITE = "overwrite"
    MERGE = "merge"
    MANUAL = "manual"


class LeadSyncService(BaseSyncService):
    def __init__(
        self,
        direction: SyncDirection = SyncDirection.MARKETING_TO_CRM,
        db_session: Optional[Session] = None,
    ):
        super().__init__(
            entity_type="lead",
            direction=direction,
            db_session=db_session,
        )
        self.settings = get_settings()
        self.merge_strategy = LeadMergeStrategy.MERGE

    def set_merge_strategy(self, strategy: LeadMergeStrategy) -> None:
        self.merge_strategy = strategy

    def find_duplicate_leads(
        self,
        phone: Optional[str] = None,
        email: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        crm_adapter = CRMAdapter(self.db)
        crm_source = crm_adapter.get_source("lead")

        params = {}
        if phone:
            params["phone"] = phone
        if email:
            params["email"] = email

        return crm_source.read_batch(batch_size=100, **params)

    def check_conflict(
        self,
        marketing_lead: Dict[str, Any],
        crm_lead: Dict[str, Any],
    ) -> List[str]:
        conflicts = []

        m_company = marketing_lead.get("company_name", "")
        c_company = crm_lead.get("company_name", "")
        if m_company and c_company and m_company != c_company:
            conflicts.append(
                f"Company name conflict: marketing='{m_company}', crm='{c_company}'"
            )

        m_name = marketing_lead.get("contact_name", "")
        c_name = crm_lead.get("contact_name", "")
        if m_name and c_name and m_name != c_name:
            conflicts.append(
                f"Contact name conflict: marketing='{m_name}', crm='{c_name}'"
            )

        return conflicts

    def merge_leads(
        self,
        source_lead: Dict[str, Any],
        target_lead: Dict[str, Any],
    ) -> Dict[str, Any]:
        merged = target_lead.copy()

        for key, value in source_lead.items():
            if value and (key not in merged or not merged[key]):
                merged[key] = value

        merged["is_merged"] = True
        merged["merged_sources"] = target_lead.get("merged_sources", []) + [
            source_lead.get("id")
        ]

        return merged

    def assign_lead_owner(
        self,
        lead_id: str,
        region: Optional[str] = None,
        industry: Optional[str] = None,
    ) -> Optional[str]:
        logger.info(f"Assigning owner for lead {lead_id}")

        owner_id = self._get_owner_by_rules(region, industry)
        if not owner_id:
            owner_id = self._get_default_owner()

        if owner_id:
            crm_adapter = CRMAdapter(self.db)
            crm_target = crm_adapter.get_target("lead", self.db)
            crm_target.update(lead_id, {"owner_id": owner_id})

        return owner_id

    def _get_owner_by_rules(
        self,
        region: Optional[str] = None,
        industry: Optional[str] = None,
    ) -> Optional[str]:
        owner_map = {
            ("north", "tech"): "owner_001",
            ("south", "tech"): "owner_002",
            ("east", "finance"): "owner_003",
        }

        if region and industry:
            return owner_map.get((region.lower(), industry.lower()))
        return None

    def _get_default_owner(self) -> str:
        return "default_owner_001"

    def sync_with_conflict_detection(
        self,
        since: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        logger.info("Starting lead sync with conflict detection")

        marketing_adapter = MarketingAdapter(self.db)
        marketing_source = marketing_adapter.get_source("lead")

        since_time = since or self.get_default_since()
        leads = list(marketing_source.read_incremental(since=since_time))

        results = {
            "total": len(leads),
            "success": 0,
            "conflicts": 0,
            "skipped": 0,
            "conflict_details": [],
        }

        for lead in leads:
            phone = lead.get("phone")
            if phone:
                duplicates = self.find_duplicate_leads(phone=phone)
                if duplicates:
                    conflicts = self.check_conflict(lead, duplicates[0])
                    if conflicts:
                        results["conflicts"] += 1
                        results["conflict_details"].append(
                            {
                                "marketing_lead_id": lead.get("id"),
                                "crm_lead_id": duplicates[0].get("id"),
                                "conflicts": conflicts,
                            }
                        )
                        continue

            result = self.sync_single(str(lead.get("id")))
            if result.success:
                results["success"] += 1
            else:
                results["skipped"] += 1

        return results

    def batch_assign_leads(
        self,
        lead_ids: List[str],
        owner_id: str,
    ) -> Dict[str, Any]:
        logger.info(f"Batch assigning {len(lead_ids)} leads to {owner_id}")

        crm_adapter = CRMAdapter(self.db)
        crm_target = crm_adapter.get_target("lead", self.db)

        success_count = 0
        for lead_id in lead_ids:
            try:
                crm_target.update(lead_id, {"owner_id": owner_id})
                success_count += 1
            except Exception as e:
                logger.error(f"Failed to assign lead {lead_id}: {e}")

        return {
            "total": len(lead_ids),
            "success": success_count,
            "failed": len(lead_ids) - success_count,
        }
