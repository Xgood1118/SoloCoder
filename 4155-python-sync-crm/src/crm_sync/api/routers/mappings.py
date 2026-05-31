from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from crm_sync.config import (
    FieldMappingConfig,
    load_field_mapping,
    save_field_mapping,
    validate_field_mapping,
)
from crm_sync.infrastructure import get_db_session
from crm_sync.models import SyncMapping, MappingStatus

router = APIRouter()


class MappingResponse(BaseModel):
    id: int
    local_id: str
    remote_id: Optional[str]
    entity_type: str
    status: str
    last_sync_time: Optional[str]
    sync_version: int


@router.get("/{entity_type}", response_model=List[MappingResponse])
async def get_mappings(
    entity_type: str,
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
):
    try:
        with get_db_session() as db:
            query = db.query(SyncMapping).filter(SyncMapping.entity_type == entity_type)

            if status:
                query = query.filter(SyncMapping.status == MappingStatus(status))

            mappings = query.offset(offset).limit(limit).all()

            return [
                MappingResponse(
                    id=m.id,
                    local_id=m.local_id,
                    remote_id=m.remote_id,
                    entity_type=m.entity_type,
                    status=m.status,
                    last_sync_time=m.last_sync_time.isoformat() if m.last_sync_time else None,
                    sync_version=m.sync_version,
                )
                for m in mappings
            ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{entity_type}/config")
async def get_field_mapping_config(entity_type: str):
    try:
        mapping_file = f"config/field_mappings/{entity_type}.json"
        config = load_field_mapping(mapping_file)
        return config.model_dump()
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Field mapping config for {entity_type} not found"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{entity_type}/config")
async def update_field_mapping_config(
    entity_type: str,
    config: FieldMappingConfig,
):
    try:
        errors = validate_field_mapping(config)
        if errors:
            raise HTTPException(
                status_code=400,
                detail={"message": "Invalid field mapping", "errors": errors},
            )

        mapping_file = f"config/field_mappings/{entity_type}.json"
        save_field_mapping(config, mapping_file)
        return {"status": "success", "message": "Field mapping updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{entity_type}/config/validate")
async def validate_mapping_config(
    entity_type: str,
    config: FieldMappingConfig,
):
    try:
        errors = validate_field_mapping(config)
        return {
            "valid": len(errors) == 0,
            "errors": errors,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{entity_type}/{local_id}")
async def delete_mapping(entity_type: str, local_id: str):
    try:
        with get_db_session() as db:
            mapping = (
                db.query(SyncMapping)
                .filter(
                    SyncMapping.entity_type == entity_type,
                    SyncMapping.local_id == local_id,
                )
                .first()
            )
            if not mapping:
                mapping.mark_deleted()
                db.commit()
                return {"status": "success", "message": "Mapping marked as deleted"}
            raise HTTPException(status_code=404, detail="Mapping not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{entity_type}/{local_id}/restore")
async def restore_mapping(entity_type: str, local_id: str):
    try:
        with get_db_session() as db:
            mapping = (
                db.query(SyncMapping)
                .filter(
                    SyncMapping.entity_type == entity_type,
                    SyncMapping.local_id == local_id,
                )
                .first()
            )
            if not mapping:
                mapping.mark_active()
                db.commit()
                return {"status": "success", "message": "Mapping restored"}
            raise HTTPException(status_code=404, detail="Mapping not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
