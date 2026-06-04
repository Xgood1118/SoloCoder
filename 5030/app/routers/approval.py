from typing import List, Optional
import json
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app import models, schemas
from app.services.approval_service import evaluate_transfer_condition, get_next_approval_node

router = APIRouter()


@router.post("/flows", response_model=schemas.ApprovalFlow, status_code=201)
def create_approval_flow(flow: schemas.ApprovalFlowCreate, db: Session = Depends(get_db)):
    db_flow = models.ApprovalFlow(
        name=flow.name,
        description=flow.description,
        form_schema=flow.form_schema,
        is_active=True
    )
    db.add(db_flow)
    db.flush()
    
    for node in flow.nodes:
        db_node = models.ApprovalNode(
            flow_id=db_flow.id,
            node_name=node.node_name,
            node_order=node.node_order,
            approver_ids=node.approver_ids,
            cc_ids=node.cc_ids,
            condition_type=node.condition_type,
            condition_value=node.condition_value
        )
        db.add(db_node)
    
    db.commit()
    db.refresh(db_flow)
    return db_flow


@router.get("/flows", response_model=List[schemas.ApprovalFlow])
def get_approval_flows(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.ApprovalFlow)
    if is_active is not None:
        query = query.filter(models.ApprovalFlow.is_active == is_active)
    return query.offset(skip).limit(limit).all()


@router.get("/flows/{flow_id}", response_model=schemas.ApprovalFlow)
def get_approval_flow(flow_id: int, db: Session = Depends(get_db)):
    db_flow = db.query(models.ApprovalFlow).filter(models.ApprovalFlow.id == flow_id).first()
    if not db_flow:
        raise HTTPException(status_code=404, detail="审批流程不存在")
    return db_flow


@router.put("/flows/{flow_id}/toggle")
def toggle_approval_flow(flow_id: int, db: Session = Depends(get_db)):
    db_flow = db.query(models.ApprovalFlow).filter(models.ApprovalFlow.id == flow_id).first()
    if not db_flow:
        raise HTTPException(status_code=404, detail="审批流程不存在")
    
    db_flow.is_active = not db_flow.is_active
    db.commit()
    return {"message": "状态已切换", "is_active": db_flow.is_active}


@router.post("/requests", response_model=schemas.ApprovalRequest, status_code=201)
def create_approval_request(request: schemas.ApprovalRequestCreate, db: Session = Depends(get_db)):
    db_flow = db.query(models.ApprovalFlow).filter(models.ApprovalFlow.id == request.flow_id).first()
    if not db_flow or not db_flow.is_active:
        raise HTTPException(status_code=400, detail="审批流程不可用")
    
    db_employee = db.query(models.Employee).filter(models.Employee.id == request.employee_id).first()
    if not db_employee:
        raise HTTPException(status_code=404, detail="员工不存在")
    
    first_node = db.query(models.ApprovalNode).filter(
        models.ApprovalNode.flow_id == request.flow_id
    ).order_by(models.ApprovalNode.node_order).first()
    
    try:
        form_data_dict = json.loads(request.form_data)
    except json.JSONDecodeError:
        form_data_dict = {}
    
    next_node = get_next_approval_node(db_flow.id, first_node, form_data_dict, db_employee, db)
    
    db_request = models.ApprovalRequest(
        flow_id=request.flow_id,
        employee_id=request.employee_id,
        form_data=request.form_data,
        current_node_id=next_node.id if next_node else None,
        status="pending" if next_node else "approved"
    )
    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    return db_request


@router.get("/requests", response_model=List[schemas.ApprovalRequest])
def get_approval_requests(
    employee_id: Optional[int] = None,
    flow_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.ApprovalRequest)
    if employee_id:
        query = query.filter(models.ApprovalRequest.employee_id == employee_id)
    if flow_id:
        query = query.filter(models.ApprovalRequest.flow_id == flow_id)
    if status:
        query = query.filter(models.ApprovalRequest.status == status)
    return query.order_by(models.ApprovalRequest.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/requests/{request_id}", response_model=schemas.ApprovalRequest)
def get_approval_request(request_id: int, db: Session = Depends(get_db)):
    db_request = db.query(models.ApprovalRequest).filter(models.ApprovalRequest.id == request_id).first()
    if not db_request:
        raise HTTPException(status_code=404, detail="审批请求不存在")
    return db_request


@router.post("/requests/{request_id}/action")
def process_approval_action(
    request_id: int,
    action_update: schemas.ApprovalRequestUpdate,
    db: Session = Depends(get_db)
):
    db_request = db.query(models.ApprovalRequest).filter(models.ApprovalRequest.id == request_id).first()
    if not db_request:
        raise HTTPException(status_code=404, detail="审批请求不存在")
    
    if db_request.status != "pending":
        raise HTTPException(status_code=400, detail="该请求已处理完毕")
    
    db_record = models.ApprovalRecord(
        request_id=request_id,
        node_id=db_request.current_node_id,
        approver_id=action_update.approver_id,
        action=action_update.action,
        comment=action_update.comment
    )
    db.add(db_record)
    
    if action_update.action == "reject":
        db_request.status = "rejected"
        db.commit()
        return {"message": "审批已拒绝", "status": "rejected"}
    
    if action_update.action == "approve":
        current_node = db.query(models.ApprovalNode).filter(
            models.ApprovalNode.id == db_request.current_node_id
        ).first()
        
        try:
            form_data_dict = json.loads(db_request.form_data)
        except json.JSONDecodeError:
            form_data_dict = {}
        
        db_employee = db.query(models.Employee).filter(models.Employee.id == db_request.employee_id).first()
        
        next_node = get_next_approval_node(
            db_request.flow_id, 
            current_node, 
            form_data_dict, 
            db_employee, 
            db
        )
        
        if next_node:
            db_request.current_node_id = next_node.id
            message = "审批已通过，进入下一节点"
        else:
            db_request.status = "approved"
            db_request.current_node_id = None
            message = "审批已全部通过"
        
        db.commit()
        return {"message": message, "status": db_request.status}
    
    raise HTTPException(status_code=400, detail="无效的操作类型")


@router.get("/pending/{approver_id}")
def get_pending_approvals(approver_id: int, db: Session = Depends(get_db)):
    pending_requests = db.query(models.ApprovalRequest).filter(
        models.ApprovalRequest.status == "pending"
    ).all()
    
    result = []
    for req in pending_requests:
        current_node = db.query(models.ApprovalNode).filter(
            models.ApprovalNode.id == req.current_node_id
        ).first()
        if current_node:
            approver_ids = current_node.approver_ids.split(",")
            if str(approver_id) in approver_ids:
                result.append({
                    "request_id": req.id,
                    "flow_name": req.flow.name,
                    "employee_name": req.employee.name,
                    "node_name": current_node.node_name,
                    "created_at": req.created_at
                })
    
    return result
