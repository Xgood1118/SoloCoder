from datetime import datetime, time

STANDARD_WORK_START = time(9, 0)
STANDARD_WORK_END = time(18, 0)
LUNCH_BREAK_START = time(12, 0)
LUNCH_BREAK_END = time(13, 30)
LATE_GRACE_MINUTES = 10
EARLY_LEAVE_GRACE_MINUTES = 10


def calculate_attendance_stats(record):
    if not record.check_in or not record.check_out:
        if not record.check_in and not record.check_out:
            record.is_absent = True
            record.work_hours = 0
            record.late_minutes = 0
            record.early_leave_minutes = 0
        return
    
    check_in_time = record.check_in.time()
    check_out_time = record.check_out.time()
    
    late_minutes = 0
    if check_in_time > STANDARD_WORK_START:
        late_delta = datetime.combine(record.date, check_in_time) - datetime.combine(record.date, STANDARD_WORK_START)
        late_minutes = int(late_delta.total_seconds() / 60)
        if late_minutes <= LATE_GRACE_MINUTES:
            late_minutes = 0
    
    early_leave_minutes = 0
    if check_out_time < STANDARD_WORK_END:
        early_delta = datetime.combine(record.date, STANDARD_WORK_END) - datetime.combine(record.date, check_out_time)
        early_leave_minutes = int(early_delta.total_seconds() / 60)
        if early_leave_minutes <= EARLY_LEAVE_GRACE_MINUTES:
            early_leave_minutes = 0
    
    effective_check_in = max(datetime.combine(record.date, check_in_time), 
                              datetime.combine(record.date, STANDARD_WORK_START))
    effective_check_out = min(datetime.combine(record.date, check_out_time), 
                               datetime.combine(record.date, STANDARD_WORK_END))
    
    lunch_start = datetime.combine(record.date, LUNCH_BREAK_START)
    lunch_end = datetime.combine(record.date, LUNCH_BREAK_END)
    
    if effective_check_out <= lunch_start or effective_check_in >= lunch_end:
        total_work_duration = effective_check_out - effective_check_in
    else:
        before_lunch = max(0, (lunch_start - effective_check_in).total_seconds())
        after_lunch = max(0, (effective_check_out - lunch_end).total_seconds())
        total_work_duration = (before_lunch + after_lunch) / 3600
    
    record.late_minutes = late_minutes
    record.early_leave_minutes = early_leave_minutes
    record.work_hours = round(total_work_duration, 2)
    record.is_absent = False


FULL_ATTENDANCE_BONUS_RULES = {
    "version": "1.0",
    "note": "全勤奖规则待HR确认，以下为临时实现",
    "bonus_amount": 500.0,
    "conditions": [
        "当月迟到次数为0",
        "当月早退次数为0",
        "当月旷工次数为0",
        "实际出勤天数>=应出勤天数",
        "无请假记录（包括事假、病假等）"
    ],
    "pending_confirmation": [
        "迟到几分钟内不算迟到？当前默认10分钟宽限",
        "早退几分钟内不算早退？当前默认10分钟宽限",
        "有请假但有补卡是否算全勤？",
        "出差/外勤是否算正常出勤？",
        "全勤奖金额是否固定？是否按级别区分？"
    ]
}


def check_full_attendance_eligibility(employee_id: int, year: int, month: int, db) -> dict:
    from app.models import AttendanceRecord, LeaveRequest
    from datetime import date, timedelta
    
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)
    
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.employee_id == employee_id,
        AttendanceRecord.date >= start_date,
        AttendanceRecord.date <= end_date
    ).all()
    
    leaves = db.query(LeaveRequest).filter(
        LeaveRequest.employee_id == employee_id,
        LeaveRequest.start_date <= end_date,
        LeaveRequest.end_date >= start_date,
        LeaveRequest.status == "approved"
    ).all()
    
    result = {
        "is_eligible": True,
        "violations": [],
        "bonus_amount": FULL_ATTENDANCE_BONUS_RULES["bonus_amount"],
        "note": FULL_ATTENDANCE_BONUS_RULES["note"]
    }
    
    late_days = len([r for r in records if r.late_minutes > 0])
    early_days = len([r for r in records if r.early_leave_minutes > 0])
    absent_days = len([r for r in records if r.is_absent])
    
    if late_days > 0:
        result["is_eligible"] = False
        result["violations"].append(f"迟到{late_days}次")
    
    if early_days > 0:
        result["is_eligible"] = False
        result["violations"].append(f"早退{early_days}次")
    
    if absent_days > 0:
        result["is_eligible"] = False
        result["violations"].append(f"旷工{absent_days}天")
    
    if len(leaves) > 0:
        result["is_eligible"] = False
        result["violations"].append(f"有{len(leaves)}条请假记录")
    
    return result
