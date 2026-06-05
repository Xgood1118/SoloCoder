import csv
import io
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from models import Task, User, Category
from schemas import (
    TaskStats, CategoryStatsResponse, CategoryStat,
    MonthlyStat, PriorityBreakdown
)
from deps import get_current_user

router = APIRouter(prefix="/api/stats", tags=["统计与导出"])


@router.get("/my", response_model=TaskStats)
def my_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tasks = db.query(Task).filter(Task.assignee_id == current_user.id).all()
    stats = TaskStats()
    for t in tasks:
        if t.status == "todo":
            stats.todo += 1
        elif t.status == "in_progress":
            stats.in_progress += 1
        elif t.status == "pending_review":
            stats.pending_review += 1
        elif t.status == "done":
            stats.done += 1
        elif t.status == "closed":
            stats.closed += 1

    now = datetime.utcnow()
    due_soon_limit = now + timedelta(days=7)
    stats.due_soon = len([
        t for t in tasks
        if t.due_date and t.due_date <= due_soon_limit and t.status not in ("done", "closed")
    ])
    return stats


@router.get("/summary", response_model=CategoryStatsResponse)
def stats_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return stats_by_category(db, current_user)


@router.get("/by-category", response_model=CategoryStatsResponse)
def stats_by_category(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    all_tasks = db.query(Task).all()
    categories = db.query(Category).all()

    cat_map = {c.id: c for c in categories}
    cat_stats = defaultdict(lambda: CategoryStat(
        category_id=0,
        category_name="未分类",
        category_color="#909399",
        priority_breakdown=PriorityBreakdown(),
    ))

    for cat in categories:
        cat_stats[cat.id] = CategoryStat(
            category_id=cat.id,
            category_name=cat.name,
            category_color=cat.color or "#409EFF",
            priority_breakdown=PriorityBreakdown(),
        )

    for task in all_tasks:
        cid = task.category_id if task.category_id in cat_stats else 0
        stat = cat_stats[cid]
        stat.total += 1

        if task.status == "done":
            stat.completed += 1
        elif task.status == "in_progress":
            stat.in_progress += 1
        elif task.status == "todo":
            stat.todo += 1

        if task.priority == "low":
            stat.priority_breakdown.low += 1
        elif task.priority == "medium_low":
            stat.priority_breakdown.medium_low += 1
        elif task.priority == "medium":
            stat.priority_breakdown.medium += 1
        elif task.priority == "high":
            stat.priority_breakdown.high += 1
        elif task.priority == "urgent":
            stat.priority_breakdown.urgent += 1

    by_category_list = sorted(cat_stats.values(), key=lambda x: x.total, reverse=True)

    monthly_map = defaultdict(lambda: MonthlyStat(
        month="",
        priority_breakdown=PriorityBreakdown(),
    ))

    for task in all_tasks:
        if task.created_at:
            month_key = task.created_at.strftime("%Y-%m")
            mstat = monthly_map[month_key]
            mstat.month = month_key
            mstat.total += 1
            if task.status == "done":
                mstat.completed += 1

            if task.priority == "low":
                mstat.priority_breakdown.low += 1
            elif task.priority == "medium_low":
                mstat.priority_breakdown.medium_low += 1
            elif task.priority == "medium":
                mstat.priority_breakdown.medium += 1
            elif task.priority == "high":
                mstat.priority_breakdown.high += 1
            elif task.priority == "urgent":
                mstat.priority_breakdown.urgent += 1

    monthly_list = sorted(monthly_map.values(), key=lambda x: x.month, reverse=True)[:12]

    return CategoryStatsResponse(
        by_category=by_category_list,
        monthly=monthly_list,
    )


@router.get("/export")
def export_tasks(
    date_from: str = Query(None),
    date_to: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Task).filter(Task.assignee_id == current_user.id)

    if date_from:
        from_dt = datetime.strptime(date_from, "%Y-%m-%d") if "T" not in date_from else datetime.fromisoformat(date_from.replace("Z", "+00:00"))
        query = query.filter(Task.created_at >= from_dt)
    if date_to:
        to_dt = datetime.strptime(date_to + " 23:59:59", "%Y-%m-%d %H:%M:%S") if "T" not in date_to else datetime.fromisoformat(date_to.replace("Z", "+00:00"))
        query = query.filter(Task.created_at <= to_dt)

    tasks = query.order_by(Task.created_at.desc()).all()

    all_rows = []
    for t in tasks:
        assignee = db.query(User).filter(User.id == t.assignee_id).first() if t.assignee_id else None
        desc = (t.description or "")[:100]
        all_rows.append({
            "标题": t.title,
            "描述": desc,
            "状态": t.status,
            "优先级": t.priority,
            "负责人": assignee.username if assignee else "",
            "截止时间": t.due_date.strftime("%Y-%m-%d %H:%M:%S") if t.due_date else "",
            "创建时间": t.created_at.strftime("%Y-%m-%d %H:%M:%S") if t.created_at else "",
        })

    if len(all_rows) <= 500:
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=["标题", "描述", "状态", "优先级", "负责人", "截止时间", "创建时间"])
        writer.writeheader()
        writer.writerows(all_rows)
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=tasks_export.csv"},
        )
    else:
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for i in range(0, len(all_rows), 500):
                chunk = all_rows[i:i + 500]
                csv_output = io.StringIO()
                writer = csv.DictWriter(csv_output, fieldnames=["标题", "描述", "状态", "优先级", "负责人", "截止时间", "创建时间"])
                writer.writeheader()
                writer.writerows(chunk)
                part_num = i // 500 + 1
                zf.writestr(f"tasks_export_part{part_num}.csv", csv_output.getvalue())

        zip_buffer.seek(0)
        return StreamingResponse(
            iter([zip_buffer.getvalue()]),
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=tasks_export.zip"},
        )
