"""
映射管理接口
提供ID映射表的查询和管理功能
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, status, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session

from sync_crm.infrastructure.database import get_db
from sync_crm.infrastructure.logging import get_logger
from sync_crm.models.mapping import EntityType, SyncMapping, MappingStatus

router = APIRouter()
logger = get_logger(__name__)


class MappingResolveRequest(BaseModel):
    """映射解析请求"""
    local_id: Optional[str] = None
    remote_id: Optional[str] = None


class MappingUpdateRequest(BaseModel):
    """映射更新请求"""
    status: Optional[MappingStatus] = None
    sync_version: Optional[int] = None


@router.get("", summary="查询映射列表")
async def list_mappings(
    entity_type: Optional[EntityType] = Query(None, description="实体类型"),
    status: Optional[MappingStatus] = Query(None, description="映射状态"),
    local_id: Optional[str] = Query(None, description="本地ID"),
    remote_id: Optional[str] = Query(None, description="远程ID"),
    limit: int = Query(50, ge=1, le=500, description="返回数量"),
    offset: int = Query(0, ge=0, description="偏移量"),
    db: Session = Depends(get_db),
):
    """
    查询ID映射列表
    """
    try:
        query = db.query(SyncMapping)

        if entity_type:
            query = query.filter(SyncMapping.entity_type == entity_type)
        if status:
            query = query.filter(SyncMapping.status == status)
        if local_id:
            query = query.filter(SyncMapping.local_id == local_id)
        if remote_id:
            query = query.filter(SyncMapping.remote_id == remote_id)

        total = query.count()
        mappings = (
            query.order_by(SyncMapping.updated_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        return {
            "total": total,
            "offset": offset,
            "limit": limit,
            "items": [m.to_dict() for m in mappings],
        }
    except Exception as e:
        logger.error(f"查询映射列表失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/{mapping_id}", summary="获取映射详情")
async def get_mapping(
    mapping_id: int,
    db: Session = Depends(get_db),
):
    """
    获取指定映射的详情
    """
    try:
        mapping = db.query(SyncMapping).filter(
            SyncMapping.id == mapping_id
        ).first()

        if not mapping:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"映射不存在: {mapping_id}",
            )

        return mapping.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取映射详情失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/resolve", summary="解析映射关系")
async def resolve_mapping(
    entity_type: EntityType,
    request: MappingResolveRequest,
    db: Session = Depends(get_db),
):
    """
    根据本地ID或远程ID解析映射关系
    """
    try:
        if request.local_id:
            mapping = SyncMapping.find_by_local(
                db, entity_type, request.local_id
            )
        elif request.remote_id:
            mapping = SyncMapping.find_by_remote(
                db, entity_type, request.remote_id
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="必须提供local_id或remote_id",
            )

        if not mapping:
            return {
                "found": False,
                "mapping": None,
            }

        return {
            "found": True,
            "mapping": mapping.to_dict(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"解析映射失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.put("/{mapping_id}", summary="更新映射")
async def update_mapping(
    mapping_id: int,
    request: MappingUpdateRequest,
    db: Session = Depends(get_db),
):
    """
    更新映射状态或版本
    """
    try:
        mapping = db.query(SyncMapping).filter(
            SyncMapping.id == mapping_id
        ).first()

        if not mapping:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"映射不存在: {mapping_id}",
            )

        if request.status:
            if request.status == MappingStatus.DELETED:
                mapping.mark_deleted()
            elif request.status == MappingStatus.CONFLICT:
                mapping.mark_conflict()
            else:
                mapping.status = request.status

        if request.sync_version:
            mapping.sync_version = request.sync_version

        db.commit()
        db.refresh(mapping)

        logger.info(f"更新映射成功: id={mapping_id}, status={mapping.status}")

        return mapping.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"更新映射失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/{mapping_id}/increment-version", summary="递增映射版本")
async def increment_mapping_version(
    mapping_id: int,
    db: Session = Depends(get_db),
):
    """
    手动递增映射版本号（用于乐观锁冲突处理）
    """
    try:
        mapping = db.query(SyncMapping).filter(
            SyncMapping.id == mapping_id
        ).first()

        if not mapping:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"映射不存在: {mapping_id}",
            )

        old_version = mapping.sync_version
        mapping.increment_version()
        db.commit()
        db.refresh(mapping)

        logger.info(
            f"递增映射版本成功: id={mapping_id}, "
            f"version {old_version} -> {mapping.sync_version}"
        )

        return {
            "id": mapping_id,
            "old_version": old_version,
            "new_version": mapping.sync_version,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"递增映射版本失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/{mapping_id}/mark-deleted", summary="标记映射为已删除")
async def mark_mapping_deleted(
    mapping_id: int,
    db: Session = Depends(get_db),
):
    """
    软删除映射记录
    """
    try:
        mapping = db.query(SyncMapping).filter(
            SyncMapping.id == mapping_id
        ).first()

        if not mapping:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"映射不存在: {mapping_id}",
            )

        mapping.mark_deleted()
        db.commit()

        logger.info(f"标记映射已删除: id={mapping_id}")

        return {
            "id": mapping_id,
            "status": MappingStatus.DELETED.value,
            "message": "映射已标记为已删除",
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"标记映射删除失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/conflicts", summary="获取冲突映射列表")
async def get_conflict_mappings(
    entity_type: Optional[EntityType] = Query(None, description="实体类型"),
    limit: int = Query(100, ge=1, le=500, description="返回数量"),
    db: Session = Depends(get_db),
):
    """
    获取标记为冲突状态的映射列表
    """
    try:
        query = db.query(SyncMapping).filter(
            SyncMapping.status == MappingStatus.CONFLICT
        )

        if entity_type:
            query = query.filter(SyncMapping.entity_type == entity_type)

        total = query.count()
        mappings = (
            query.order_by(SyncMapping.updated_at.desc())
            .limit(limit)
            .all()
        )

        return {
            "total": total,
            "items": [m.to_dict() for m in mappings],
        }
    except Exception as e:
        logger.error(f"获取冲突映射失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/conflicts/{mapping_id}/resolve", summary="解决映射冲突")
async def resolve_mapping_conflict(
    mapping_id: int,
    resolution: str = Body(..., embed=True, description="冲突解决策略: keep_local/keep_remote/merge"),
    db: Session = Depends(get_db),
):
    """
    解决映射冲突
    """
    allowed_resolutions = ["keep_local", "keep_remote", "merge"]
    if resolution not in allowed_resolutions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"冲突解决策略必须是以下之一: {allowed_resolutions}",
        )

    try:
        mapping = db.query(SyncMapping).filter(
            SyncMapping.id == mapping_id
        ).first()

        if not mapping:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"映射不存在: {mapping_id}",
            )

        if mapping.status != MappingStatus.CONFLICT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"该映射状态不是冲突状态: {mapping.status}",
            )

        mapping.status = MappingStatus.ACTIVE
        mapping.increment_version()
        db.commit()

        logger.info(
            f"解决映射冲突成功: id={mapping_id}, resolution={resolution}"
        )

        return {
            "id": mapping_id,
            "resolution": resolution,
            "status": MappingStatus.ACTIVE.value,
            "message": "冲突已解决",
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"解决映射冲突失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.delete("/{mapping_id}", summary="物理删除映射")
async def delete_mapping_permanently(
    mapping_id: int,
    db: Session = Depends(get_db),
):
    """
    物理删除映射记录（谨慎使用，建议使用软删除）
    """
    try:
        mapping = db.query(SyncMapping).filter(
            SyncMapping.id == mapping_id
        ).first()

        if not mapping:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"映射不存在: {mapping_id}",
            )

        db.delete(mapping)
        db.commit()

        logger.warning(f"物理删除映射: id={mapping_id}, entity={mapping.entity_type}")

        return {
            "id": mapping_id,
            "message": "映射已永久删除",
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"物理删除映射失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
