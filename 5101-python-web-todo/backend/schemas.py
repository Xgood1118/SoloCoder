from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator
import re


PRIORITY_VALUES = {"low", "medium_low", "medium", "high", "urgent"}
PRIORITY_ORDER = ["low", "medium_low", "medium", "high", "urgent"]
PRIORITY_WEIGHT = {"low": 1, "medium_low": 2, "medium": 3, "high": 4, "urgent": 5}
STATUS_VALUES = {"todo", "in_progress", "pending_review", "done", "closed"}
STATUS_ORDER = ["todo", "in_progress", "pending_review", "done", "closed"]


class UserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)
    real_name: Optional[str] = Field(None, max_length=50)
    department: Optional[str] = Field(None, max_length=100)


class UserOut(BaseModel):
    id: int
    username: str
    real_name: Optional[str] = None
    department: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    color: str = Field(..., max_length=7)
    sort_weight: int = 0

    @field_validator("color")
    @classmethod
    def validate_color(cls, v):
        if not re.match(r"^#[0-9a-fA-F]{6}$", v):
            raise ValueError("颜色代码必须是有效的十六进制格式，如 #FF5733")
        return v


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    color: Optional[str] = Field(None, max_length=7)
    sort_weight: Optional[int] = None

    @field_validator("color")
    @classmethod
    def validate_color(cls, v):
        if v is not None and not re.match(r"^#[0-9a-fA-F]{6}$", v):
            raise ValueError("颜色代码必须是有效的十六进制格式，如 #FF5733")
        return v


class CategoryOut(BaseModel):
    id: int
    name: str
    color: str
    sort_weight: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field("", max_length=2000)
    priority: str = Field("medium")
    due_date: Optional[datetime] = None
    category_id: Optional[int] = None
    assignee_id: Optional[int] = None

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v):
        if v not in PRIORITY_VALUES:
            raise ValueError(f"优先级必须是 {', '.join(PRIORITY_VALUES)} 之一")
        return v


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    category_id: Optional[int] = None
    assignee_id: Optional[int] = None

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v):
        if v is not None and v not in PRIORITY_VALUES:
            raise ValueError(f"优先级必须是 {', '.join(PRIORITY_VALUES)} 之一")
        return v


class StatusChange(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v not in STATUS_VALUES:
            raise ValueError(f"状态必须是 {', '.join(STATUS_VALUES)} 之一")
        return v


class ProgressUpdate(BaseModel):
    progress: int = Field(..., ge=0, le=100)


class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1)

    @field_validator("content")
    @classmethod
    def validate_content(cls, v):
        stripped = v.strip()
        if not stripped:
            raise ValueError("请输入评论内容后再提交")
        return stripped


class CommentOut(BaseModel):
    id: int
    task_id: int
    user_id: int
    content: str
    created_at: datetime
    author_name: Optional[str] = None

    model_config = {"from_attributes": True}


class ActivityLogOut(BaseModel):
    id: int
    task_id: int
    user_id: int
    action_type: str
    action_detail: str
    created_at: datetime
    username: Optional[str] = None

    model_config = {"from_attributes": True}


class ParticipantOut(BaseModel):
    id: int
    task_id: int
    user_id: int
    joined_at: datetime
    username: Optional[str] = None
    real_name: Optional[str] = None

    model_config = {"from_attributes": True}


class TaskOut(BaseModel):
    id: int
    title: str
    description: str
    priority: str
    due_date: Optional[datetime] = None
    category_id: Optional[int] = None
    creator_id: int
    assignee_id: Optional[int] = None
    status: str
    progress: int
    has_no_assignee: bool
    created_at: datetime
    updated_at: datetime
    creator_name: Optional[str] = None
    assignee_name: Optional[str] = None
    category_name: Optional[str] = None
    category_color: Optional[str] = None
    participants: List[ParticipantOut] = []

    model_config = {"from_attributes": True}


class TaskStats(BaseModel):
    todo: int = 0
    in_progress: int = 0
    pending_review: int = 0
    done: int = 0
    closed: int = 0
    due_soon: int = 0


class PriorityBreakdown(BaseModel):
    low: int = 0
    medium_low: int = 0
    medium: int = 0
    high: int = 0
    urgent: int = 0


class CategoryStat(BaseModel):
    category_id: int
    category_name: str
    category_color: str
    total: int = 0
    completed: int = 0
    in_progress: int = 0
    todo: int = 0
    priority_breakdown: PriorityBreakdown


class MonthlyStat(BaseModel):
    month: str
    total: int = 0
    completed: int = 0
    priority_breakdown: PriorityBreakdown


class CategoryStatsResponse(BaseModel):
    by_category: List[CategoryStat]
    monthly: List[MonthlyStat]
