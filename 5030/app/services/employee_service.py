from sqlalchemy.orm import Session
from app.models import Employee


def generate_employee_no(db: Session) -> str:
    last_employee = db.query(Employee).order_by(Employee.id.desc()).first()
    if last_employee:
        last_no = int(last_employee.employee_no[2:]) if last_employee.employee_no else 0
    else:
        last_no = 0
    new_no = f"EM{last_no + 1:06d}"
    return new_no


def generate_company_email(name: str, employee_no: str) -> str:
    pinyin_name = name.lower().replace(" ", ".")
    return f"{pinyin_name}.{employee_no}@company.com"


def generate_handover_list(employee: Employee) -> str:
    handover_items = [
        f"【工作交接清单 - {employee.name}】",
        f"工号: {employee.employee_no}",
        f"部门: {employee.department}",
        f"岗位: {employee.position}",
        "",
        "1. 办公设备交接",
        "   - 电脑、显示器、键盘鼠标",
        "   - 工牌、门禁卡",
        "   - 办公室钥匙",
        "",
        "2. 文件资料交接",
        "   - 项目文档归档",
        "   - 客户资料移交",
        "   - 账号权限清单",
        "",
        "3. 系统账号处理",
        f"   - 企业邮箱: {employee.email} (已封存)",
        "   - OA系统权限注销",
        "   - 其他业务系统账号注销",
        "",
        "4. 财务结算",
        "   - 工资结算至最后工作日",
        "   - 年假/调休清算",
        "   - 报销单据处理",
        "",
        "交接人签字: _____________",
        "接收人签字: _____________",
        "监交人签字: _____________",
    ]
    return "\n".join(handover_items)


def deactivate_employee_email(email: str) -> bool:
    print(f"[邮箱系统] 已封存邮箱账号: {email}")
    return True
