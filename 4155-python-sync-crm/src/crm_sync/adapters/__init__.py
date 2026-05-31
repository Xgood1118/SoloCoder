from .crm_adapter import CRMAdapter, CRMContactAdapter, CRMLeadAdapter, CRMOrderAdapter
from .marketing_adapter import (
    MarketingAdapter,
    MarketingContactAdapter,
    MarketingLeadAdapter,
    MarketingOrderAdapter,
)
from .base import BaseAPIAdapter

__all__ = [
    "BaseAPIAdapter",
    "CRMAdapter",
    "CRMContactAdapter",
    "CRMLeadAdapter",
    "CRMOrderAdapter",
    "MarketingAdapter",
    "MarketingContactAdapter",
    "MarketingLeadAdapter",
    "MarketingOrderAdapter",
]
