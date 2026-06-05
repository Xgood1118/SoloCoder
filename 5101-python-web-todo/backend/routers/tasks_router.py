from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from database import get_db
from models import Task, User, Category, TaskParticipant, ActivityLog
from schemas import (
    TaskCreate, TaskUpdate, TaskOut, StatusChange, ProgressUpdate,
    ParticipantOut, STATUS_ORDER, PRIORITY_WEIGHT
)
from deps import get_current_user

router = APIRouter(prefix="/api/tasks", tags=["任务"])


def _task_to_out(task: Task, db: Session) -> TaskOut:
    creator = db.query(User).filter(User.id == task.creator_id).first()
    assignee = db.query(User).filter(User.id == task.assignee_id).first() if task.assignee_id else None
    cat = db.query(Category).filter(Category.id == task.category_id).first() if task.category_id else None

    participants = []
    for p in task.participants:
        u = db.query(User).filter(User.id == p.user_id).first()
        participants.append(ParticipantOut(
            id=p.id, task_id=p.task_id, user_id=p.user_id,
            joined_at=p.joined_at, username=u.username if u else None,
            real_name=u.real_name if u else None,
        ))

    return TaskOut(
        id=task.id, title=task.title, description=task.description,
        priority=task.priority, due_date=task.due_date,
        category_id=task.category_id, creator_id=task.creator_id,
        assignee_id=task.assignee_id, status=task.status,
        progress=task.progress, has_no_assignee=task.has_no_assignee,
        created_at=task.created_at, updated_at=task.updated_at,
        creator_name=creator.username if creator else None,
        assignee_name=assignee.username if assignee else None,
        category_name=cat.name if cat else None,
        category_color=cat.color if cat else None,
        participants=participants,
    )


def _log_activity(db: Session, task_id: int, user_id: int, action_type: str, action_detail: str):
    log = ActivityLog(task_id=task_id, user_id=user_id, action_type=action_type, action_detail=action_detail)
    db.add(log)


@router.get("/", response_model=list[TaskOut])
def list_tasks(
    category_id: int = Query(None),
    assignee_id: int = Query(None),
    priority: str = Query(None),
    status: str = Query(None),
    due_date_from: str = Query(None),
    due_date_to: str = Query(None),
    keyword: str = Query(None),
    sort_by: str = Query("priority_desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Task)

    if category_id is not None:
        query = query.filter(Task.category_id == category_id)
    if assignee_id is not None:
        query = query.filter(Task.assignee_id == assignee_id)
    if priority is not None:
        query = query.filter(Task.priority == priority)
    if status is not None:
        query = query.filter(Task.status == status)
    if due_date_from is not None:
        from_dt = datetime.fromisoformat(due_date_from.replace("Z", "+00:00")) if "T" in due_date_from else datetime.strptime(due_date_from, "%Y-%m-%d")
        query = query.filter(Task.due_date >= from_dt)
    if due_date_to is not None:
        to_dt = datetime.fromisoformat(due_date_to.replace("Z", "+00:00")) if "T" in due_date_to else datetime.strptime(due_date_to + " 23:59:59", "%Y-%m-%d %H:%M:%S")
        query = query.filter(Task.due_date <= to_dt)
    if keyword is not None:
        query = query.filter(Task.title.contains(keyword))

    priority_case = case(
        (Task.priority == "low", 1),
        (Task.priority == "medium_low", 2),
        (Task.priority == "medium", 3),
        (Task.priority == "high", 4),
        (Task.priority == "urgent", 5),
        else_=0
    )

    if sort_by == "priority_desc":
        query = query.order_by(priority_case.desc(), Task.due_date.asc().nulls_last(), Task.created_at.desc())
    elif sort_by == "priority_asc":
        query = query.order_by(priority_case.asc(), Task.due_date.asc().nulls_last(), Task.created_at.desc())
    else:
        query = query.order_by(Task.due_date.asc().nulls_last(), Task.created_at.desc())

    tasks = query.all()
    return [_task_to_out(t, db) for t in tasks]


@router.get("/today", response_model=list[TaskOut])
def get_today_tasks(
    priority: str = Query(None),
    category_id: int = Query(None),
    sort_by: str = Query("priority_desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day, 0, 0, 0)
    today_end = datetime(now.year, now.month, now.day, 23, 59, 59)

    query = db.query(Task).filter(Task.due_date >= today_start, Task.due_date <= today_end)

    if priority is not None:
        query = query.filter(Task.priority == priority)
    if category_id is not None:
        query = query.filter(Task.category_id == category_id)

    priority_case = case(
        (Task.priority == "low", 1),
        (Task.priority == "medium_low", 2),
        (Task.priority == "medium", 3),
        (Task.priority == "high", 4),
        (Task.priority == "urgent", 5),
        else_=0
    )

    if sort_by == "priority_desc":
        query = query.order_by(priority_case.desc(), Task.due_date.asc())
    elif sort_by == "priority_asc":
        query = query.order_by(priority_case.asc(), Task.due_date.asc())
    else:
        query = query.order_by(Task.due_date.asc())

    tasks = query.all()
    return [_task_to_out(t, db) for t in tasks]


@router.get("/{task_id}", response_model=TaskOut)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return _task_to_out(task, db)


@router.post("/", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    task_in: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    duplicate = db.query(Task).filter(
        Task.creator_id == current_user.id,
        Task.title == task_in.title.strip(),
        Task.created_at >= one_hour_ago,
    ).first()
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"您在1小时内已创建过标题为\"{task_in.title.strip()}\"的任务，请检查是否重复提交",
        )

    recent_same = db.query(Task).filter(
        Task.creator_id == current_user.id,
        Task.title == task_in.title.strip(),
    ).order_by(Task.created_at.desc()).first()
    if recent_same and recent_same.created_at:
        diff = (datetime.utcnow() - recent_same.created_at.replace(tzinfo=None)).total_seconds()
        if diff < 3600:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"您在1小时内已创建过标题为\"{task_in.title.strip()}\"的任务，请检查是否重复提交",
            )

    if task_in.category_id is not None:
        cat = db.query(Category).filter(Category.id == task_in.category_id).first()
        if not cat:
            raise HTTPException(status_code=400, detail="所选分类不存在")

    assignee_id = task_in.assignee_id if task_in.assignee_id is not None else current_user.id
    if assignee_id != current_user.id:
        assignee = db.query(User).filter(User.id == assignee_id).first()
        if not assignee:
            raise HTTPException(status_code=400, detail="指定的负责人不存在")

    task = Task(
        title=task_in.title.strip(),
        description=task_in.description,
        priority=task_in.priority,
        due_date=task_in.due_date,
        category_id=task_in.category_id,
        creator_id=current_user.id,
        assignee_id=assignee_id,
        status="todo",
        progress=0,
    )
    db.add(task)
    db.flush()

    participant = TaskParticipant(task_id=task.id, user_id=current_user.id)
    db.add(participant)
    if assignee_id != current_user.id:
        participant2 = TaskParticipant(task_id=task.id, user_id=assignee_id)
        db.add(participant2)

    _log_activity(db, task.id, current_user.id, "created", f"创建了任务: {task.title}")
    _log_activity(db, task.id, current_user.id, "assignee_changed", f"负责人设为: 用户{assignee_id}")

    db.commit()
    db.refresh(task)
    return _task_to_out(task, db)


@router.put("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    task_in: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task.creator_id != current_user.id and task.assignee_id != current_user.id:
        raise HTTPException(status_code=403, detail="只有创建人或负责人可以修改任务")

    if task_in.title is not None:
        task.title = task_in.title
    if task_in.description is not None:
        task.description = task_in.description
    if task_in.priority is not None:
        old_priority = task.priority
        task.priority = task_in.priority
        _log_activity(db, task.id, current_user.id, "priority_changed", f"优先级从 {old_priority} 变更为 {task_in.priority}")
    if task_in.due_date is not None:
        task.due_date = task_in.due_date
    if task_in.category_id is not None:
        if task_in.category_id != 0:
            cat = db.query(Category).filter(Category.id == task_in.category_id).first()
            if not cat:
                raise HTTPException(status_code=400, detail="所选分类不存在")
        task.category_id = task_in.category_id if task_in.category_id != 0 else None
    if task_in.assignee_id is not None:
        old_assignee = task.assignee_id
        new_assignee_user = db.query(User).filter(User.id == task_in.assignee_id).first()
        if not new_assignee_user:
            raise HTTPException(status_code=400, detail="指定的负责人不存在")
        task.assignee_id = task_in.assignee_id
        task.has_no_assignee = False
        existing_p = db.query(TaskParticipant).filter(
            TaskParticipant.task_id == task.id, TaskParticipant.user_id == task_in.assignee_id
        ).first()
        if not existing_p:
            db.add(TaskParticipant(task_id=task.id, user_id=task_in.assignee_id))
        _log_activity(db, task.id, current_user.id, "assignee_changed", f"负责人从 用户{old_assignee} 变更为 用户{task_in.assignee_id}")

    task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return _task_to_out(task, db)


@router.post("/{task_id}/claim", response_model=TaskOut)
def claim_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task.assignee_id is not None and not task.has_no_assignee:
        raise HTTPException(status_code=400, detail="该任务已有负责人")

    task.assignee_id = current_user.id
    task.has_no_assignee = False
    task.updated_at = datetime.utcnow()

    existing_p = db.query(TaskParticipant).filter(
        TaskParticipant.task_id == task.id, TaskParticipant.user_id == current_user.id
    ).first()
    if not existing_p:
        db.add(TaskParticipant(task_id=task.id, user_id=current_user.id))

    _log_activity(db, task.id, current_user.id, "claimed", f"用户 {current_user.username} 认领了任务")

    db.commit()
    db.refresh(task)
    return _task_to_out(task, db)


@router.post("/{task_id}/status", response_model=TaskOut)
def change_status(
    task_id: int,
    status_in: StatusChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task.status == "closed":
        raise HTTPException(status_code=400, detail="已关闭的任务不能再变更状态")

    if task.has_no_assignee:
        raise HTTPException(status_code=400, detail="无负责人的任务不允许流转状态")

    if status_in.status == task.status:
        return _task_to_out(task, db)

    if status_in.status == "closed":
        old_status = task.status
        task.status = "closed"
        _log_activity(db, task.id, current_user.id, "status_changed", f"状态从 {old_status} 变更为 closed")
        task.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(task)
        return _task_to_out(task, db)

    current_idx = STATUS_ORDER.index(task.status) if task.status in STATUS_ORDER else -1
    new_idx = STATUS_ORDER.index(status_in.status) if status_in.status in STATUS_ORDER else -1

    if new_idx != current_idx + 1:
        raise HTTPException(status_code=400, detail="状态只能按顺序依次流转")

    if status_in.status == "done":
        if task.progress != 100:
            raise HTTPException(status_code=400, detail="进度必须达到100%才能标记为已完成")
        if current_user.id != task.creator_id and current_user.id != task.assignee_id:
            raise HTTPException(status_code=403, detail="只有创建人或负责人可以标记任务为已完成")

    if task.status == "pending_review" and status_in.status == "done":
        if current_user.id != task.creator_id:
            raise HTTPException(status_code=403, detail="只有任务创建人可以审核通过")

    old_status = task.status
    task.status = status_in.status
    task.updated_at = datetime.utcnow()
    _log_activity(db, task.id, current_user.id, "status_changed", f"状态从 {old_status} 变更为 {status_in.status}")

    db.commit()
    db.refresh(task)
    return _task_to_out(task, db)


@router.post("/{task_id}/progress", response_model=TaskOut)
def update_progress(
    task_id: int,
    progress_in: ProgressUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task.status != "in_progress":
        raise HTTPException(status_code=400, detail="只有进行中的任务可以更新进度")

    old_progress = task.progress
    task.progress = progress_in.progress
    task.updated_at = datetime.utcnow()
    _log_activity(db, task.id, current_user.id, "progress_updated", f"进度从 {old_progress}% 更新为 {progress_in.progress}%")

    db.commit()
    db.refresh(task)
    return _task_to_out(task, db)


@router.get("/{task_id}/participants", response_model=list[ParticipantOut])
def list_participants(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    result = []
    for p in task.participants:
        u = db.query(User).filter(User.id == p.user_id).first()
        result.append(ParticipantOut(
            id=p.id, task_id=p.task_id, user_id=p.user_id,
            joined_at=p.joined_at, username=u.username if u else None,
            real_name=u.real_name if u else None,
        ))
    return result


@router.post("/{task_id}/participants/{user_id}", response_model=ParticipantOut, status_code=status.HTTP_201_CREATED)
def add_participant(
    task_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="用户不存在")

    existing = db.query(TaskParticipant).filter(
        TaskParticipant.task_id == task_id, TaskParticipant.user_id == user_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该用户已是任务参与人")

    p = TaskParticipant(task_id=task_id, user_id=user_id)
    db.add(p)
    _log_activity(db, task.id, current_user.id, "participant_added", f"添加了参与人: 用户{user_id}")
    db.commit()
    db.refresh(p)

    u = db.query(User).filter(User.id == user_id).first()
    return ParticipantOut(
        id=p.id, task_id=p.task_id, user_id=p.user_id,
        joined_at=p.joined_at, username=u.username if u else None,
        real_name=u.real_name if u else None,
    )


@router.delete("/{task_id}/participants/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_participant(
    task_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    p = db.query(TaskParticipant).filter(
        TaskParticipant.task_id == task_id, TaskParticipant.user_id == user_id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="该用户不是任务参与人")

    db.delete(p)
    _log_activity(db, task.id, current_user.id, "participant_removed", f"移除了参与人: 用户{user_id}")

    if task.assignee_id == user_id:
        other_participants = db.query(TaskParticipant).filter(
            TaskParticipant.task_id == task_id, TaskParticipant.user_id != user_id
        ).all()

        if other_participants:
            task.assignee_id = task.creator_id
            task.has_no_assignee = False
            creator_is_participant = any(op.user_id == task.creator_id for op in other_participants)
            if not creator_is_participant:
                db.add(TaskParticipant(task_id=task_id, user_id=task.creator_id))
            _log_activity(db, task.id, current_user.id, "assignee_changed", f"负责人变更为创建人: 用户{task.creator_id}")
        else:
            if task.creator_id == user_id:
                task.assignee_id = None
                task.has_no_assignee = True
                _log_activity(db, task.id, current_user.id, "assignee_changed", "任务已标记为无负责人")
            else:
                task.assignee_id = task.creator_id
                task.has_no_assignee = False
                _log_activity(db, task.id, current_user.id, "assignee_changed", f"负责人变更为创建人: 用户{task.creator_id}")

    task.updated_at = datetime.utcnow()
    db.commit()


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="只有创建人可以删除任务")
    db.delete(task)
    db.commit()
