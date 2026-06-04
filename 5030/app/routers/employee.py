from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_db
from app import models, schemas
from app.services.employee_service import (
    generate_employee_no,
    generate_company_email,
    generate_handover_list,
    deactivate_employee_email
)

router = APIRouter()


@router.post("/", response_model=schemas.Employee, status_code=status.HTTP_201_CREATED)
def create_employee(employee: schemas.EmployeeCreate, db: Session = Depends(get_db)):
    employee_no = generate_employee_no(db)
    email = employee.email or generate_company_email(employee.name, employee_no)
    
    db_employee = models.Employee(
        employee_no=employee_no,
        name=employee.name,
        department=employee.department,
        position=employee.position,
        hire_date=employee.hire_date,
        contract_end_date=employee.contract_end_date,
        email=email,
        phone=employee.phone,
        status="active"
    )
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    return db_employee


@router.get("/", response_model=List[schemas.Employee])
def get_employees(
    skip: int = 0,
    limit: int = 100,
    department: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Employee)
    if department:
        query = query.filter(models.Employee.department == department)
    if status:
        query = query.filter(models.Employee.status == status)
    return query.offset(skip).limit(limit).all()


@router.get("/{employee_id}", response_model=schemas.Employee)
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    db_employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not db_employee:
        raise HTTPException(status_code=404, detail="员工不存在")
    return db_employee


@router.get("/no/{employee_no}", response_model=schemas.Employee)
def get_employee_by_no(employee_no: str, db: Session = Depends(get_db)):
    db_employee = db.query(models.Employee).filter(models.Employee.employee_no == employee_no).first()
    if not db_employee:
        raise HTTPException(status_code=404, detail="员工不存在")
    return db_employee


@router.put("/{employee_id}", response_model=schemas.Employee)
def update_employee(employee_id: int, employee: schemas.EmployeeUpdate, db: Session = Depends(get_db)):
    db_employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not db_employee:
        raise HTTPException(status_code=404, detail="员工不存在")
    
    update_data = employee.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_employee, key, value)
    
    db.commit()
    db.refresh(db_employee)
    return db_employee


@router.post("/resignation", response_model=schemas.ResignationRequest)
def submit_resignation(resignation: schemas.ResignationRequestCreate, db: Session = Depends(get_db)):
    db_employee = db.query(models.Employee).filter(models.Employee.id == resignation.employee_id).first()
    if not db_employee:
        raise HTTPException(status_code=404, detail="员工不存在")
    if db_employee.status != "active":
        raise HTTPException(status_code=400, detail="员工状态异常，无法提交离职申请")
    
    db_resignation = models.ResignationRequest(
        employee_id=resignation.employee_id,
        reason=resignation.reason,
        last_work_date=resignation.last_work_date,
        status="pending"
    )
    db.add(db_resignation)
    db.commit()
    db.refresh(db_resignation)
    return db_resignation


@router.post("/resignation/{resignation_id}/approve")
def approve_resignation(resignation_id: int, db: Session = Depends(get_db)):
    db_resignation = db.query(models.ResignationRequest).filter(models.ResignationRequest.id == resignation_id).first()
    if not db_resignation:
        raise HTTPException(status_code=404, detail="离职申请不存在")
    
    db_employee = db.query(models.Employee).filter(models.Employee.id == db_resignation.employee_id).first()
    
    handover_list = generate_handover_list(db_employee)
    
    db_resignation.status = "approved"
    db_resignation.handover_list = handover_list
    
    db_employee.status = "resigned"
    
    deactivate_employee_email(db_employee.email)
    
    db.commit()
    return {"message": "离职审批通过，已生成工作交接清单并封存邮箱", "handover_list": handover_list}


@router.delete("/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    db_employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not db_employee:
        raise HTTPException(status_code=404, detail="员工不存在")
    
    db.delete(db_employee)
    db.commit()
    return {"message": "删除成功"}
