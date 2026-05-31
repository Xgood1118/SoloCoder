"""
配置管理接口
提供字段映射配置的CRUD操作
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, status, Body
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from sync_crm.infrastructure.database import get_db
from sync_crm.infrastructure.logging import get_logger
from sync_crm.models.mapping import EntityType
from sync_crm.models.field_mapping import (
    FieldMappingConfig,
    FieldType,
    ConversionRule,
    MissingFieldAction,
)

router = APIRouter()
logger = get_logger(__name__)


class FieldMappingCreate(BaseModel):
    """字段映射创建请求"""
    entity_type: EntityType
    direction: str = Field(..., description="映射方向: crm_to_marketing/marketing_to_crm")
    source_field: str = Field(..., description="源字段名")
    target_field: str = Field(..., description="目标字段名")
    source_field_type: FieldType = Field(default=FieldType.STRING, description="字段类型")
    target_field_type: FieldType = Field(default=FieldType.STRING, description="目标字段类型")
    conversion_rule: Optional[ConversionRule] = Field(None, description="转换规则")
    conversion_params: Optional[dict] = Field(None, description="转换参数")
    custom_expression: Optional[str] = Field(None, description="自定义转换表达式")
    missing_action: MissingFieldAction = Field(
        default=MissingFieldAction.NULL,
        description="缺失字段处理方式",
    )
    default_value: Optional[str] = Field(None, description="默认值")
    is_active: bool = Field(default=True, description="是否启用")
    description: Optional[str] = Field(None, description="说明")


class FieldMappingUpdate(BaseModel):
    """字段映射更新请求"""
    source_field: Optional[str] = Field(None, description="源字段名")
    target_field: Optional[str] = Field(None, description="目标字段名")
    source_field_type: Optional[FieldType] = Field(None, description="字段类型")
    target_field_type: Optional[FieldType] = Field(None, description="目标字段类型")
    conversion_rule: Optional[ConversionRule] = Field(None, description="转换规则")
    conversion_params: Optional[dict] = Field(None, description="转换参数")
    custom_expression: Optional[str] = Field(None, description="自定义转换表达式")
    missing_action: Optional[MissingFieldAction] = Field(None, description="缺失字段处理方式")
    default_value: Optional[str] = Field(None, description="默认值")
    is_active: Optional[bool] = Field(None, description="是否启用")
    description: Optional[str] = Field(None, description="说明")


class FieldMappingResponse(BaseModel):
    """字段映射响应"""
    id: int
    entity_type: str
    direction: str
    source_field: str
    target_field: str
    source_field_type: str
    target_field_type: str
    conversion_rule: Optional[str]
    conversion_params: Optional[dict]
    custom_expression: Optional[str]
    missing_action: str
    default_value: Optional[str]
    is_required: bool
    is_primary_key: bool
    is_active: bool
    sort_order: int
    description: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]


@router.get("/field-mapping", summary="查询字段映射列表")
async def list_field_mappings(
    entity_type: Optional[EntityType] = Query(None, description="实体类型"),
    mapping_direction: Optional[str] = Query(None, description="映射方向"),
    is_enabled: Optional[bool] = Query(None, description="是否启用"),
    db: Session = Depends(get_db),
):
    """
    查询字段映射配置列表
    """
    try:
        query = db.query(FieldMappingConfig)

        if entity_type:
            query = query.filter(FieldMappingConfig.entity_type == entity_type)
        if mapping_direction:
            query = query.filter(FieldMappingConfig.direction == mapping_direction)
        if is_enabled is not None:
            query = query.filter(FieldMappingConfig.is_active == is_enabled)

        mappings = query.order_by(
            FieldMappingConfig.entity_type,
            FieldMappingConfig.sort_order,
        ).all()

        return {
            "total": len(mappings),
            "items": [m.to_dict() for m in mappings],
        }
    except Exception as e:
        logger.error(f"查询字段映射失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/field-mapping/{mapping_id}", summary="获取字段映射详情")
async def get_field_mapping(
    mapping_id: int,
    db: Session = Depends(get_db),
):
    """
    获取指定字段映射的详情
    """
    try:
        mapping = db.query(FieldMappingConfig).filter(
            FieldMappingConfig.id == mapping_id
        ).first()

        if not mapping:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"字段映射不存在: {mapping_id}",
            )

        return mapping.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取字段映射失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/field-mapping", summary="创建字段映射", status_code=status.HTTP_201_CREATED)
async def create_field_mapping(
    request: FieldMappingCreate,
    db: Session = Depends(get_db),
):
    """
    创建新的字段映射配置
    """
    try:
        existing = db.query(FieldMappingConfig).filter(
            FieldMappingConfig.entity_type == request.entity_type,
            FieldMappingConfig.direction == request.direction,
            FieldMappingConfig.source_field == request.source_field,
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"该字段映射已存在: {request.entity_type.value}.{request.source_field}",
            )

        max_priority = db.query(
            db.func.max(FieldMappingConfig.sort_order)
        ).filter(
            FieldMappingConfig.entity_type == request.entity_type,
            FieldMappingConfig.direction == request.direction,
        ).scalar() or 0

        mapping = FieldMappingConfig(
            entity_type=request.entity_type,
            direction=request.direction,
            source_field=request.source_field,
            target_field=request.target_field,
            source_field_type=request.source_field_type,
            target_field_type=request.target_field_type,
            conversion_rule=request.conversion_rule,
            conversion_params=request.conversion_params,
            custom_expression=request.custom_expression,
            missing_action=request.missing_action,
            default_value=request.default_value,
            is_active=request.is_active,
            sort_order=max_priority + 1,
            description=request.description,
        )

        db.add(mapping)
        db.commit()
        db.refresh(mapping)

        logger.info(f"创建字段映射成功: id={mapping.id}, {mapping.entity_type}.{mapping.source_field}")

        return mapping.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"创建字段映射失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.put("/field-mapping/{mapping_id}", summary="更新字段映射")
async def update_field_mapping(
    mapping_id: int,
    request: FieldMappingUpdate,
    db: Session = Depends(get_db),
):
    """
    更新字段映射配置
    """
    try:
        mapping = db.query(FieldMappingConfig).filter(
            FieldMappingConfig.id == mapping_id
        ).first()

        if not mapping:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"字段映射不存在: {mapping_id}",
            )

        update_data = request.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if hasattr(mapping, key) and value is not None:
                setattr(mapping, key, value)

        db.commit()
        db.refresh(mapping)

        logger.info(f"更新字段映射成功: id={mapping_id}")

        return mapping.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"更新字段映射失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.delete("/field-mapping/{mapping_id}", summary="删除字段映射")
async def delete_field_mapping(
    mapping_id: int,
    db: Session = Depends(get_db),
):
    """
    删除字段映射配置（软删除）
    """
    try:
        mapping = db.query(FieldMappingConfig).filter(
            FieldMappingConfig.id == mapping_id
        ).first()

        if not mapping:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"字段映射不存在: {mapping_id}",
            )

        mapping.is_enabled = False
        db.commit()

        logger.info(f"删除字段映射成功: id={mapping_id}")

        return {"message": "字段映射已删除", "id": mapping_id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"删除字段映射失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/field-mapping/{mapping_id}/test", summary="测试字段映射")
async def test_field_mapping(
    mapping_id: int,
    test_data: dict = Body(..., description="测试数据"),
    db: Session = Depends(get_db),
):
    """
    测试字段映射转换效果
    """
    try:
        from sync_crm.pipeline.transformer import FieldMappingTransformer

        mapping = db.query(FieldMappingConfig).filter(
            FieldMappingConfig.id == mapping_id
        ).first()

        if not mapping:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"字段映射不存在: {mapping_id}",
            )

        transformer = FieldMappingTransformer(
            entity_type=mapping.entity_type,
            mapping_direction=mapping.direction,
            db_session=db,
        )

        from sync_crm.pipeline.base import PipelineContext, RecordStatus

        context = PipelineContext(
            task_id="test",
            entity_type=mapping.entity_type,
            operation_type="test",
            sync_direction=mapping.direction,
            batch_size=1,
        )

        result = transformer.transform(test_data, context)

        return {
            "input": test_data,
            "output": result,
            "mapping_config": mapping.to_dict(),
            "errors": context.errors,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"测试字段映射失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/conversion-rules", summary="获取支持的转换规则")
async def get_conversion_rules():
    """
    获取所有支持的字段转换规则
    """
    return {
        "conversion_rules": [
            {"name": rule.value, "description": rule.name}
            for rule in ConversionRule
        ],
        "field_types": [
            {"name": ft.value, "description": ft.name}
            for ft in FieldType
        ],
        "missing_actions": [
            {"name": action.value, "description": action.name}
            for action in MissingFieldAction
        ],
    }
