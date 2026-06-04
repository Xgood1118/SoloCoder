from datetime import date, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app import models, schemas
from app.services.leave_service import LEAVE_TYPE_RULES, calculate_leave_days

router = APIRouter()


@router.get("/rules")
def get_leave_rules():
    return LEAVE_TYPE_RULES


@router.post("/", response_model=schemas.LeaveRequest, status_code=201)
def create_leave_request(leave: schemas.LeaveRequestCreate, db: Session = Depends(get_db)):
    db_employee = db.query(models.Employee).filter(models.Employee.id == leave.employee_id).first()
    if not db_employee:
        raise HTTPException(status_code=404, detail="员工不存在")
    
    if leave.leave_type not in LEAVE_TYPE_RULES:
        raise HTTPException(status_code=400, detail="不支持的请假类型")
    
    days = calculate_leave_days(leave.start_date, leave.end_date)
    
    db_leave = models.LeaveRequest(
        employee_id=leave.employee_id,
        leave_type=leave.leave_type,
        start_date=leave.start_date,
        end_date=leave.end_date,
        days=days,
        reason=leave.reason,
        status="pending"
    )
    db.add(db_leave)
    db.commit()
    db.refresh(db_leave)
    return db_leave


@router.get("/", response_model=List[schemas.LeaveRequest])
def get_leave_requests(
    employee_id: Optional[int] = None,
    leave_type: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.LeaveRequest)
    if employee_id:
        query = query.filter(models.LeaveRequest.employee_id == employee_id)
    if leave_type:
        query = query.filter(models.LeaveRequest.leave_type == leave_type)
    if status:
        query = query.filter(models.LeaveRequest.status == status)
    if start_date:
        query = query.filter(models.LeaveRequest.start_date >= start_date)
    if end_date:
        query = query.filter(models.LeaveRequest.end_date <= end_date)
    return query.order_by(models.LeaveRequest.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{leave_id}", response_model=schemas.LeaveRequest)
def get_leave_request(leave_id: int, db: Session = Depends(get_db)):
    db_leave = db.query(models.LeaveRequest).filter(models.LeaveRequest.id == leave_id).first()
    if not db_leave:
        raise HTTPException(status_code=404, detail="请假记录不存在")
    return db_leave


@router.put("/{leave_id}/status", response_model=schemas.LeaveRequest)
def update_leave_status(
    leave_id: int,
    status_update: schemas.LeaveRequestUpdate,
    db: Session = Depends(get_db)
):
    db_leave = db.query(models.LeaveRequest).filter(models.LeaveRequest.id == leave_id).first()
    if not db_leave:
        raise HTTPException(status_code=404, detail="请假记录不存在")
    
    if status_update.status:
        db_leave.status = status_update.status
    
    db.commit()
    db.refresh(db_leave)
    return db_leave


@router.delete("/{leave_id}")
def delete_leave_request(leave_id: int, db: Session = Depends(get_db)):
    db_leave = db.query(models.LeaveRequest).filter(models.LeaveRequest.id == leave_id).first()
    if not db_leave:
        raise HTTPException(status_code=404, detail="请假记录不存在")
    
    if db_leave.status != "pending":
        raise HTTPException(status_code=400, detail="只能删除待审批的请假申请")
    
    db.delete(db_leave)
    db.commit()
    return {"message": "删除成功"}


@router.get("/my/{employee_id}")
def get_my_leave_records(employee_id: int, db: Session = Depends(get_db)):
    leaves = db.query(models.LeaveRequest).filter(
        models.LeaveRequest.employee_id == employee_id
    ).order_by(models.LeaveRequest.created_at.desc()).all()
    
    leave_stats = {}
    for leave_type in LEAVE_TYPE_RULES:
        leave_stats[leave_type] = {
            "used_days": 0.0,
            "total_days": LEAVE_TYPE_RULES[leave_type].get("annual_quota", 0),
            "rule": LEAVE_TYPE_RULES[leave_type]
        }
    
    for leave in leaves:
        if leave.status == "approved" and leave.leave_type in leave_stats:
            leave_stats[leave.leave_type]["used_days"] += leave.days
    
    return {
        "records": leaves,
        "statistics": leave_stats
    }


@router.get("/calculate/days")
def calculate_days(start_date: date, end_date: date):
    days = calculate_leave_days(start_date, end_date)
    return {"start_date": start_date, "end_date": end_date, "days": days}
