from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import employee, attendance, approval, leave, report

Base.metadata.create_all(bind=engine)

app = FastAPI(title="人力资源管理系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(employee.router, prefix="/api/employee", tags=["员工档案管理"])
app.include_router(attendance.router, prefix="/api/attendance", tags=["考勤管理"])
app.include_router(approval.router, prefix="/api/approval", tags=["审批流程"])
app.include_router(leave.router, prefix="/api/leave", tags=["请假管理"])
app.include_router(report.router, prefix="/api/report", tags=["报表管理"])


@app.get("/")
def root():
    return {"message": "人力资源管理系统 API", "version": "1.0.0"}
