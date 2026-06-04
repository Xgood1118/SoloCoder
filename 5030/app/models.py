from sqlalchemy import Column, Integer, String, Date, DateTime, Float, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_no = Column(String, unique=True, index=True)
    name = Column(String, index=True)
    department = Column(String)
    position = Column(String)
    hire_date = Column(Date)
    contract_end_date = Column(Date)
    email = Column(String, unique=True, index=True)
    phone = Column(String)
    status = Column(String, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    attendance_records = relationship("AttendanceRecord", back_populates="employee")
    leave_requests = relationship("LeaveRequest", back_populates="employee")
    approvals = relationship("ApprovalRequest", back_populates="employee")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    date = Column(Date)
    check_in = Column(DateTime)
    check_out = Column(DateTime)
    work_hours = Column(Float, default=0)
    late_minutes = Column(Integer, default=0)
    early_leave_minutes = Column(Integer, default=0)
    is_absent = Column(Boolean, default=False)
    remarks = Column(String)

    employee = relationship("Employee", back_populates="attendance_records")


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    leave_type = Column(String)
    start_date = Column(Date)
    end_date = Column(Date)
    days = Column(Float)
    reason = Column(Text)
    status = Column(String, default="pending")
    approval_request_id = Column(Integer, ForeignKey("approval_requests.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", back_populates="leave_requests")
    approval_request = relationship("ApprovalRequest", back_populates="leave_request")


class ApprovalFlow(Base):
    __tablename__ = "approval_flows"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    description = Column(Text)
    form_schema = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    nodes = relationship("ApprovalNode", back_populates="flow")
    requests = relationship("ApprovalRequest", back_populates="flow")


class ApprovalNode(Base):
    __tablename__ = "approval_nodes"

    id = Column(Integer, primary_key=True, index=True)
    flow_id = Column(Integer, ForeignKey("approval_flows.id"))
    node_name = Column(String)
    node_order = Column(Integer)
    approver_ids = Column(Text)
    cc_ids = Column(Text)
    condition_type = Column(String)
    condition_value = Column(String)

    flow = relationship("ApprovalFlow", back_populates="nodes")


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id = Column(Integer, primary_key=True, index=True)
    flow_id = Column(Integer, ForeignKey("approval_flows.id"))
    employee_id = Column(Integer, ForeignKey("employees.id"))
    form_data = Column(Text)
    current_node_id = Column(Integer, ForeignKey("approval_nodes.id"))
    status = Column(String, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    flow = relationship("ApprovalFlow", back_populates="requests")
    employee = relationship("Employee", back_populates="approvals")
    leave_request = relationship("LeaveRequest", back_populates="approval_request", uselist=False)
    records = relationship("ApprovalRecord", back_populates="request")


class ApprovalRecord(Base):
    __tablename__ = "approval_records"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("approval_requests.id"))
    node_id = Column(Integer, ForeignKey("approval_nodes.id"))
    approver_id = Column(Integer)
    action = Column(String)
    comment = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    request = relationship("ApprovalRequest", back_populates="records")


class ResignationRequest(Base):
    __tablename__ = "resignation_requests"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    reason = Column(Text)
    last_work_date = Column(Date)
    handover_list = Column(Text)
    status = Column(String, default="pending")
    approval_request_id = Column(Integer, ForeignKey("approval_requests.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MonthlyAttendanceSummary(Base):
    __tablename__ = "monthly_attendance_summaries"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    year = Column(Integer)
    month = Column(Integer)
    total_work_days = Column(Integer, default=0)
    actual_work_days = Column(Integer, default=0)
    total_late_days = Column(Integer, default=0)
    total_early_leave_days = Column(Integer, default=0)
    total_absent_days = Column(Integer, default=0)
    total_work_hours = Column(Float, default=0)
    is_full_attendance = Column(Boolean, default=False)
    full_attendance_bonus = Column(Float, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
