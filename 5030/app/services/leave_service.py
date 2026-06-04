from datetime import date, timedelta

LEAVE_TYPE_RULES = {
    "personal": {
        "name": "事假",
        "description": "因个人事务请假",
        "deduction_type": "full_salary",
        "deduction_rate": 1.0,
        "annual_quota": 10,
        "requires_approval": True,
        "approval_level": 1,
        "note": "事假按日薪100%扣除"
    },
    "sick": {
        "name": "病假",
        "description": "因生病请假，需提供医院证明",
        "deduction_type": "partial_salary",
        "deduction_rate": 0.4,
        "annual_quota": 15,
        "requires_approval": True,
        "approval_level": 1,
        "requires_certificate": True,
        "note": "病假按日薪40%扣除，需提供医院证明"
    },
    "annual": {
        "name": "年假",
        "description": "带薪年休假",
        "deduction_type": "no_deduction",
        "deduction_rate": 0.0,
        "annual_quota": 10,
        "requires_approval": True,
        "approval_level": 2,
        "note": "年假不扣薪，按工龄递增"
    },
    "compensatory": {
        "name": "调休",
        "description": "加班调休",
        "deduction_type": "no_deduction",
        "deduction_rate": 0.0,
        "annual_quota": None,
        "requires_approval": True,
        "approval_level": 1,
        "note": "调休不扣薪，需有对应加班记录"
    },
    "marriage": {
        "name": "婚假",
        "description": "结婚休假",
        "deduction_type": "no_deduction",
        "deduction_rate": 0.0,
        "annual_quota": 3,
        "requires_approval": True,
        "approval_level": 2,
        "note": "婚假不扣薪，需提供结婚证"
    },
    "maternity": {
        "name": "产假",
        "description": "女性员工生育休假",
        "deduction_type": "no_deduction",
        "deduction_rate": 0.0,
        "annual_quota": 98,
        "requires_approval": True,
        "approval_level": 3,
        "note": "产假不扣薪，按国家规定执行"
    },
    "paternity": {
        "name": "陪产假",
        "description": "男性员工陪护假",
        "deduction_type": "no_deduction",
        "deduction_rate": 0.0,
        "annual_quota": 15,
        "requires_approval": True,
        "approval_level": 2,
        "note": "陪产假不扣薪"
    },
    "bereavement": {
        "name": "丧假",
        "description": "亲属去世休假",
        "deduction_type": "no_deduction",
        "deduction_rate": 0.0,
        "annual_quota": 3,
        "requires_approval": True,
        "approval_level": 1,
        "note": "丧假不扣薪"
    }
}


def calculate_leave_days(start_date: date, end_date: date) -> float:
    if end_date < start_date:
        return 0.0
    
    days = 0.0
    current_date = start_date
    
    while current_date <= end_date:
        if current_date.weekday() < 5:
            days += 1.0
        current_date += timedelta(days=1)
    
    return days


def calculate_salary_deduction(leave_type: str, days: float, daily_salary: float) -> dict:
    if leave_type not in LEAVE_TYPE_RULES:
        return {"deduction_amount": 0.0, "message": "未知的请假类型"}
    
    rule = LEAVE_TYPE_RULES[leave_type]
    deduction_amount = daily_salary * days * rule["deduction_rate"]
    
    return {
        "leave_type": rule["name"],
        "days": days,
        "daily_salary": daily_salary,
        "deduction_rate": rule["deduction_rate"],
        "deduction_amount": round(deduction_amount, 2),
        "note": rule["note"]
    }


def check_leave_quota(employee_id: int, leave_type: str, days: float, db) -> dict:
    from app.models import LeaveRequest
    from datetime import datetime
    
    rule = LEAVE_TYPE_RULES.get(leave_type)
    if not rule:
        return {"eligible": False, "message": "未知的请假类型"}
    
    annual_quota = rule.get("annual_quota")
    if annual_quota is None:
        return {"eligible": True, "used_days": 0, "remaining_days": None}
    
    current_year = datetime.now().year
    leaves = db.query(LeaveRequest).filter(
        LeaveRequest.employee_id == employee_id,
        LeaveRequest.leave_type == leave_type,
        LeaveRequest.status == "approved",
        LeaveRequest.start_date >= f"{current_year}-01-01"
    ).all()
    
    used_days = sum(leave.days for leave in leaves)
    remaining_days = annual_quota - used_days
    
    if days > remaining_days:
        return {
            "eligible": False,
            "used_days": used_days,
            "remaining_days": remaining_days,
            "annual_quota": annual_quota,
            "message": f"假期余额不足，剩余{remaining_days}天"
        }
    
    return {
        "eligible": True,
        "used_days": used_days,
        "remaining_days": remaining_days,
        "annual_quota": annual_quota,
        "message": "可申请"
    }
