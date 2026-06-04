from datetime import date, datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app import models, schemas
from app.services.attendance_service import calculate_attendance_stats

router = APIRouter()


@router.post("/check-in", response_model=schemas.AttendanceRecord)
def check_in(employee_id: int, db: Session = Depends(get_db)):
    today = date.today()
    db_employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not db_employee:
        raise HTTPException(status_code=404, detail="员工不存在")
    
    existing_record = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.employee_id == employee_id,
        models.AttendanceRecord.date == today
    ).first()
    
    now = datetime.now()
    
    if existing_record:
        if existing_record.check_in:
            raise HTTPException(status_code=400, detail="今日已打卡")
        existing_record.check_in = now
        calculate_attendance_stats(existing_record)
        db.commit()
        db.refresh(existing_record)
        return existing_record
    
    db_record = models.AttendanceRecord(
        employee_id=employee_id,
        date=today,
        check_in=now
    )
    calculate_attendance_stats(db_record)
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


@router.post("/check-out", response_model=schemas.AttendanceRecord)
def check_out(employee_id: int, db: Session = Depends(get_db)):
    today = date.today()
    db_record = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.employee_id == employee_id,
        models.AttendanceRecord.date == today
    ).first()
    
    if not db_record:
        raise HTTPException(status_code=404, detail="未找到今日打卡记录，请先打卡上班")
    
    if db_record.check_out:
        raise HTTPException(status_code=400, detail="今日已签退")
    
    db_record.check_out = datetime.now()
    calculate_attendance_stats(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


@router.get("/records", response_model=List[schemas.AttendanceRecord])
def get_attendance_records(
    employee_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.AttendanceRecord)
    if employee_id:
        query = query.filter(models.AttendanceRecord.employee_id == employee_id)
    if start_date:
        query = query.filter(models.AttendanceRecord.date >= start_date)
    if end_date:
        query = query.filter(models.AttendanceRecord.date <= end_date)
    return query.order_by(models.AttendanceRecord.date.desc()).offset(skip).limit(limit).all()


@router.get("/{record_id}", response_model=schemas.AttendanceRecord)
def get_attendance_record(record_id: int, db: Session = Depends(get_db)):
    db_record = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.id == record_id).first()
    if not db_record:
        raise HTTPException(status_code=404, detail="打卡记录不存在")
    return db_record


@router.put("/{record_id}", response_model=schemas.AttendanceRecord)
def update_attendance_record(
    record_id: int,
    record_update: schemas.AttendanceRecordUpdate,
    db: Session = Depends(get_db)
):
    db_record = db.query(models.AttendanceRecord).filter(models.AttendanceRecord.id == record_id).first()
    if not db_record:
        raise HTTPException(status_code=404, detail="打卡记录不存在")
    
    if record_update.check_in:
        db_record.check_in = record_update.check_in
    if record_update.check_out:
        db_record.check_out = record_update.check_out
    if record_update.remarks:
        db_record.remarks = record_update.remarks
    
    calculate_attendance_stats(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


@router.post("/monthly-summary")
def generate_monthly_summary(year: int, month: int, db: Session = Depends(get_db)):
    employees = db.query(models.Employee).filter(models.Employee.status == "active").all()
    
    summaries = []
    for employee in employees:
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)
        
        records = db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.employee_id == employee.id,
            models.AttendanceRecord.date >= start_date,
            models.AttendanceRecord.date <= end_date
        ).all()
        
        total_work_days = 22
        actual_work_days = len([r for r in records if not r.is_absent and r.check_in])
        total_late_days = len([r for r in records if r.late_minutes > 0])
        total_early_leave_days = len([r for r in records if r.early_leave_minutes > 0])
        total_absent_days = len([r for r in records if r.is_absent])
        total_work_hours = sum(r.work_hours for r in records)
        
        is_full_attendance = (total_late_days == 0 and total_early_leave_days == 0 
                              and total_absent_days == 0 and actual_work_days >= total_work_days)
        full_attendance_bonus = 500.0 if is_full_attendance else 0.0
        
        existing_summary = db.query(models.MonthlyAttendanceSummary).filter(
            models.MonthlyAttendanceSummary.employee_id == employee.id,
            models.MonthlyAttendanceSummary.year == year,
            models.MonthlyAttendanceSummary.month == month
        ).first()
        
        if existing_summary:
            existing_summary.total_work_days = total_work_days
            existing_summary.actual_work_days = actual_work_days
            existing_summary.total_late_days = total_late_days
            existing_summary.total_early_leave_days = total_early_leave_days
            existing_summary.total_absent_days = total_absent_days
            existing_summary.total_work_hours = total_work_hours
            existing_summary.is_full_attendance = is_full_attendance
            existing_summary.full_attendance_bonus = full_attendance_bonus
            summaries.append(existing_summary)
        else:
            db_summary = models.MonthlyAttendanceSummary(
                employee_id=employee.id,
                year=year,
                month=month,
                total_work_days=total_work_days,
                actual_work_days=actual_work_days,
                total_late_days=total_late_days,
                total_early_leave_days=total_early_leave_days,
                total_absent_days=total_absent_days,
                total_work_hours=total_work_hours,
                is_full_attendance=is_full_attendance,
                full_attendance_bonus=full_attendance_bonus
            )
            db.add(db_summary)
            summaries.append(db_summary)
    
    db.commit()
    return {"message": "月度考勤汇总已生成", "count": len(summaries)}


@router.get("/monthly-summary/list", response_model=List[schemas.MonthlyAttendanceSummary])
def get_monthly_summaries(
    year: int,
    month: int,
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.MonthlyAttendanceSummary).filter(
        models.MonthlyAttendanceSummary.year == year,
        models.MonthlyAttendanceSummary.month == month
    )
    if employee_id:
        query = query.filter(models.MonthlyAttendanceSummary.employee_id == employee_id)
    return query.all()
