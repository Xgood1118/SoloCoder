"""
销售线索同步服务
"""
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
import random

from sqlalchemy.orm import Session

from sync_crm.config import settings
from sync_crm.models.mapping import EntityType, SyncMapping, MappingStatus
from sync_crm.models.entities import Lead, LeadStatus
from sync_crm.services.base import SyncService, SyncDirection
from sync_crm.infrastructure.logging import get_logger
from sync_crm.utils.data_converter import normalize_phone

logger = get_logger(__name__)


class LeadConflictResolver:
    """
    线索冲突解决器

    当同一个手机号在两边都有记录但公司名称不一致时，
    进行合并判断。
    """

    def __init__(self, db_session: Session):
        self.db_session = db_session

    def check_conflict(
        self,
        new_lead: Dict[str, Any],
    ) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        检查线索冲突

        先按手机号匹配，如果手机号一样但公司名不一样，
        返回冲突信息。

        Args:
            new_lead: 新线索数据

        Returns:
            (是否冲突, 已存在的线索数据)
        """
        phone = normalize_phone(new_lead.get("phone", ""))
        if not phone:
            return False, None

        existing_lead = self._find_lead_by_phone(phone)
        if not existing_lead:
            return False, None

        new_company = new_lead.get("company_name", "").strip()
        existing_company = existing_lead.get("company_name", "").strip()

        if new_company and existing_company and new_company != existing_company:
            conflict_info = {
                "new_lead": {
                    "phone": phone,
                    "company_name": new_company,
                    "contact_name": new_lead.get("contact_name"),
                    "source": "marketing",
                },
                "existing_lead": existing_lead,
                "conflict_fields": ["company_name"],
                "resolution_strategy": "manual_confirmation",
            }
            return True, conflict_info

        return False, existing_lead

    def _find_lead_by_phone(self, phone: str) -> Optional[Dict[str, Any]]:
        """根据手机号查找已存在的线索"""
        from sync_crm.models.mapping import SyncMapping

        mapping = (
            self.db_session.query(SyncMapping)
            .filter(
                SyncMapping.entity_type == EntityType.LEAD,
                SyncMapping.status == MappingStatus.ACTIVE,
            )
            .first()
        )

        if mapping:
            return {
                "id": mapping.local_id,
                "remote_id": mapping.remote_id,
                "phone": phone,
                "company_name": "",
            }

        return None

    def resolve_conflict(
        self,
        conflict_info: Dict[str, Any],
        resolution: str = "keep_existing",
    ) -> Dict[str, Any]:
        """
        解决冲突

        Args:
            conflict_info: 冲突信息
            resolution: 解决策略: keep_existing / use_new / merge

        Returns:
            解决后的结果
        """
        if resolution == "keep_existing":
            return {
                "status": "resolved",
                "resolution": "keep_existing",
                "lead_id": conflict_info["existing_lead"]["id"],
                "action": "skipped",
            }
        elif resolution == "use_new":
            return {
                "status": "resolved",
                "resolution": "use_new",
                "lead_id": None,
                "action": "create_new",
            }
        elif resolution == "merge":
            merged = self._merge_leads(
                conflict_info["existing_lead"],
                conflict_info["new_lead"],
            )
            return {
                "status": "resolved",
                "resolution": "merge",
                "lead_id": conflict_info["existing_lead"]["id"],
                "merged_data": merged,
                "action": "update",
            }
        else:
            return {
                "status": "pending",
                "resolution": "manual_confirmation",
                "action": "wait_for_manual",
            }

    def _merge_leads(
        self,
        existing: Dict[str, Any],
        new: Dict[str, Any],
    ) -> Dict[str, Any]:
        """合并两条线索数据"""
        merged = existing.copy()

        for key, value in new.items():
            if key not in merged or merged[key] is None or merged[key] == "":
                merged[key] = value

        merged["conflict_merged"] = True
        merged["merged_at"] = datetime.utcnow().isoformat()
        merged["sources"] = ["crm", "marketing"]

        return merged

    def require_manual_confirmation(
        self,
        conflict_info: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        标记需要人工确认

        将冲突信息保存，等待运营手工确认。
        """
        conflict_info["status"] = "pending_confirmation"
        conflict_info["created_at"] = datetime.utcnow().isoformat()

        logger.warning(
            f"线索冲突需要人工确认: phone={conflict_info['new_lead']['phone']}"
        )

        return conflict_info


class LeadOwnerAssigner:
    """
    线索负责人分配器

    支持按区域、行业、随机等分配策略。
    """

    def __init__(self, db_session: Session):
        self.db_session = db_session

    def assign_owner(
        self,
        lead: Dict[str, Any],
        strategy: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        分配线索负责人

        Args:
            lead: 线索数据
            strategy: 分配策略，默认使用配置

        Returns:
            带负责人信息的线索数据
        """
        strategy = strategy or settings.sync.default_owner_assignment

        if strategy == "by_region":
            owner = self._assign_by_region(lead)
        elif strategy == "by_industry":
            owner = self._assign_by_industry(lead)
        elif strategy == "random":
            owner = self._assign_random(lead)
        else:
            owner = self._assign_by_region(lead)

        if owner:
            lead["owner_id"] = owner["id"]
            lead["owner_name"] = owner["name"]
            lead["status"] = LeadStatus.ASSIGNED.value

        return lead

    def _assign_by_region(self, lead: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """按区域分配"""
        region = lead.get("region") or lead.get("city") or lead.get("province")

        region_owners = self._get_region_owners()

        if region and region in region_owners:
            owners = region_owners[region]
            return random.choice(owners) if owners else None

        return self._get_default_owner()

    def _assign_by_industry(self, lead: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """按行业分配"""
        industry = lead.get("industry")

        industry_owners = self._get_industry_owners()

        if industry and industry in industry_owners:
            owners = industry_owners[industry]
            return random.choice(owners) if owners else None

        return self._get_default_owner()

    def _assign_random(self, lead: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """随机分配"""
        all_owners = self._get_all_owners()
        if all_owners:
            return random.choice(all_owners)
        return None

    def _get_region_owners(self) -> Dict[str, List[Dict[str, Any]]]:
        """获取区域负责人映射（实际应从数据库读取）"""
        return {
            "北京": [{"id": "sales_001", "name": "张三"}],
            "上海": [{"id": "sales_002", "name": "李四"}],
            "广州": [{"id": "sales_003", "name": "王五"}],
            "深圳": [{"id": "sales_003", "name": "王五"}],
        }

    def _get_industry_owners(self) -> Dict[str, List[Dict[str, Any]]]:
        """获取行业负责人映射"""
        return {
            "金融": [{"id": "sales_fin_001", "name": "赵六"}],
            "互联网": [{"id": "sales_it_001", "name": "钱七"}],
            "教育": [{"id": "sales_edu_001", "name": "孙八"}],
        }

    def _get_all_owners(self) -> List[Dict[str, Any]]:
        """获取所有销售人员"""
        return [
            {"id": "sales_001", "name": "张三"},
            {"id": "sales_002", "name": "李四"},
            {"id": "sales_003", "name": "王五"},
        ]

    def _get_default_owner(self) -> Optional[Dict[str, Any]]:
        """获取默认负责人"""
        owners = self._get_all_owners()
        return owners[0] if owners else None


class LeadSyncService(SyncService):
    """销售线索同步服务"""

    entity_type = EntityType.LEAD
    direction = SyncDirection.MARKETING_TO_CRM

    def __init__(self, db_session: Session):
        super().__init__(db_session)
        self.conflict_resolver = LeadConflictResolver(db_session)
        self.owner_assigner = LeadOwnerAssigner(db_session)

    def sync_lead_from_marketing(
        self,
        lead_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        从营销平台同步线索到CRM

        处理逻辑：
        1. 检查冲突
        2. 分配负责人
        3. 执行同步
        """
        has_conflict, conflict_info = self.conflict_resolver.check_conflict(lead_data)

        if has_conflict:
            logger.warning(
                f"检测到线索冲突: phone={lead_data.get('phone')}"
            )
            conflict_result = self.conflict_resolver.require_manual_confirmation(
                conflict_info
            )
            return {
                "status": "conflict",
                "conflict_info": conflict_result,
                "action": "manual_confirmation_required",
            }

        lead_data = self.owner_assigner.assign_owner(lead_data)

        result = self.sync_manual(
            record_ids=[lead_data.get("id")],
            direction=SyncDirection.MARKETING_TO_CRM,
            operator="marketing_event",
        )

        return {
            "status": "success",
            "owner_id": lead_data.get("owner_id"),
            "owner_name": lead_data.get("owner_name"),
            "sync_result": result,
        }

    def batch_sync_leads(
        self,
        leads_data: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        批量同步线索

        处理批量线索的冲突检测和负责人分配。
        """
        results = []
        conflict_count = 0
        success_count = 0

        for lead_data in leads_data:
            result = self.sync_lead_from_marketing(lead_data)
            results.append(result)

            if result.get("status") == "conflict":
                conflict_count += 1
            else:
                success_count += 1

        return {
            "total": len(leads_data),
            "success": success_count,
            "conflicts": conflict_count,
            "results": results,
        }

    def resolve_lead_conflict(
        self,
        conflict_id: str,
        resolution: str,
    ) -> Dict[str, Any]:
        """
        人工解决线索冲突

        Args:
            conflict_id: 冲突ID
            resolution: 解决策略

        Returns:
            解决结果
        """
        logger.info(
            f"人工解决线索冲突: conflict_id={conflict_id}, resolution={resolution}"
        )

        return {
            "status": "success",
            "conflict_id": conflict_id,
            "resolution": resolution,
        }

    def reassign_lead_owner(
        self,
        lead_id: str,
        owner_id: str,
        operator: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        重新分配线索负责人

        同步更新到营销平台。
        """
        logger.info(
            f"重新分配线索负责人: lead_id={lead_id}, new_owner={owner_id}"
        )

        result = self.sync_manual(
            record_ids=[lead_id],
            direction=SyncDirection.CRM_TO_MARKETING,
            operator=operator or "manual_reassign",
        )

        return {
            "status": "success",
            "lead_id": lead_id,
            "new_owner_id": owner_id,
            "sync_result": result,
        }

    def get_pending_conflicts(self) -> List[Dict[str, Any]]:
        """获取待处理的冲突列表"""
        return []

    def get_leads_by_owner(
        self,
        owner_id: str,
        status: Optional[LeadStatus] = None,
    ) -> List[Dict[str, Any]]:
        """获取某个负责人的线索列表"""
        from sync_crm.models.mapping import SyncMapping

        query = self.db_session.query(SyncMapping).filter(
            SyncMapping.entity_type == EntityType.LEAD,
            SyncMapping.status == MappingStatus.ACTIVE,
        )

        mappings = query.all()

        return [
            {
                "local_id": m.local_id,
                "remote_id": m.remote_id,
                "last_sync_time": m.last_sync_time,
            }
            for m in mappings
        ]
