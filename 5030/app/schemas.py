from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


class EmployeeBase(BaseModel):
    name: str
    department: str
    position: str
    hire_date: date
    contract_end_date: Optional[date] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    hire_date: Optional[date] = None
    contract_end_date: Optional[date] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    status: Optional[str] = None


class Employee(EmployeeBase):
    id: int
    employee_no: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AttendanceRecordBase(BaseModel):
    employee_id: int
    date: date
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None


class AttendanceRecordCreate(AttendanceRecordBase):
    pass


class AttendanceRecordUpdate(BaseModel):
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    remarks: Optional[str] = None


class AttendanceRecord(AttendanceRecordBase):
    id: int
    work_hours: float
    late_minutes: int
    early_leave_minutes: int
    is_absent: bool
    remarks: Optional[str] = None

    class Config:
        from_attributes = True


class LeaveRequestBase(BaseModel):
    employee_id: int
    leave_type: str
    start_date: date
    end_date: date
    reason: str


class LeaveRequestCreate(LeaveRequestBase):
    pass


class LeaveRequestUpdate(BaseModel):
    status: Optional[str] = None


class LeaveRequest(LeaveRequestBase):
    id: int
    days: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ApprovalNodeBase(BaseModel):
    node_name: str
    node_order: int
    approver_ids: str
    cc_ids: Optional[str] = None
    condition_type: Optional[str] = None
    condition_value: Optional[str] = None


class ApprovalNodeCreate(ApprovalNodeBase):
    pass


class ApprovalNode(ApprovalNodeBase):
    id: int
    flow_id: int

    class Config:
        from_attributes = True


class ApprovalFlowBase(BaseModel):
    name: str
    description: Optional[str] = None
    form_schema: Optional[str] = None


class ApprovalFlowCreate(ApprovalFlowBase):
    nodes: List[ApprovalNodeCreate]


class ApprovalFlow(ApprovalFlowBase):
    id: int
    is_active: bool
    created_at: datetime
    nodes: List[ApprovalNode] = []

    class Config:
        from_attributes = True


class ApprovalRequestBase(BaseModel):
    flow_id: int
    employee_id: int
    form_data: str


class ApprovalRequestCreate(ApprovalRequestBase):
    pass


class ApprovalRequestUpdate(BaseModel):
    action: str
    comment: Optional[str] = None
    approver_id: int


class ApprovalRecord(BaseModel):
    id: int
    request_id: int
    node_id: int
    approver_id: int
    action: str
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ApprovalRequest(ApprovalRequestBase):
    id: int
    current_node_id: Optional[int] = None
    status: str
    created_at: datetime
    records: List[ApprovalRecord] = []

    class Config:
        from_attributes = True


class ResignationRequestBase(BaseModel):
    employee_id: int
    reason: str
    last_work_date: date


class ResignationRequestCreate(ResignationRequestBase):
    pass


class ResignationRequest(ResignationRequestBase):
    id: int
    handover_list: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class MonthlyAttendanceSummaryBase(BaseModel):
    employee_id: int
    year: int
    month: int


class MonthlyAttendanceSummary(MonthlyAttendanceSummaryBase):
    id: int
    total_work_days: int
    actual_work_days: int
    total_late_days: int
    total_early_leave_days: int
    total_absent_days: int
    total_work_hours: float
    is_full_attendance: bool
    full_attendance_bonus: float
    created_at: datetime

    class Config:
        from_attributes = True
