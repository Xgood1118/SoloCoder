from fastapi import APIRouter
from pydantic import BaseModel

from crm_sync.adapters import CRMAdapter, MarketingAdapter
from crm_sync.infrastructure import get_db_session
from crm_sync.infrastructure.redis_client import get_redis_client

router = APIRouter()


class HealthStatus(BaseModel):
    status: str
    database: str
    redis: str
    crm_api: str
    marketing_api: str


@router.get("/health", response_model=HealthStatus)
async def health_check():
    database_status = "healthy"
    redis_status = "healthy"
    crm_status = "healthy"
    marketing_status = "healthy"

    try:
        with get_db_session() as db:
            db.execute("SELECT 1")
    except Exception:
        database_status = "unhealthy"

    try:
        redis = get_redis_client()
        if not redis.ping():
            redis_status = "unhealthy"
    except Exception:
        redis_status = "unhealthy"

    try:
        crm = CRMAdapter()
        if not crm.api.health_check():
            crm_status = "degraded"
    except Exception:
        crm_status = "unhealthy"

    try:
        marketing = MarketingAdapter()
        if not marketing.api.health_check():
            marketing_status = "degraded"
    except Exception:
        marketing_status = "unhealthy"

    overall_status = "healthy"
    if any(
        s == "unhealthy"
        for s in [database_status, redis_status, crm_status, marketing_status]
    ):
        overall_status = "unhealthy"
    elif any(
        s == "degraded" for s in [crm_status, marketing_status]
    ):
        overall_status = "degraded"

    return HealthStatus(
        status=overall_status,
        database=database_status,
        redis=redis_status,
        crm_api=crm_status,
        marketing_api=marketing_status,
    )
