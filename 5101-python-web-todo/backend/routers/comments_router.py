from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import Task, Comment, User, ActivityLog
from schemas import CommentCreate, CommentOut, ActivityLogOut
from deps import get_current_user

router = APIRouter(prefix="/api/tasks", tags=["评论"])


@router.get("/{task_id}/comments", response_model=list[CommentOut])
def list_comments(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    comments = db.query(Comment).filter(Comment.task_id == task_id).order_by(Comment.created_at.desc()).all()
    result = []
    for c in comments:
        author = db.query(User).filter(User.id == c.user_id).first()
        result.append(CommentOut(
            id=c.id, task_id=c.task_id, user_id=c.user_id,
            content=c.content, created_at=c.created_at,
            author_name=author.username if author else None,
        ))
    return result


@router.post("/{task_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def create_comment(
    task_id: int,
    comment_in: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    comment = Comment(task_id=task_id, user_id=current_user.id, content=comment_in.content)
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return CommentOut(
        id=comment.id, task_id=comment.task_id, user_id=comment.user_id,
        content=comment.content, created_at=comment.created_at,
        author_name=current_user.username,
    )


@router.delete("/{task_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    task_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.task_id == task_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")

    task = db.query(Task).filter(Task.id == task_id).first()
    if comment.user_id != current_user.id and (not task or task.creator_id != current_user.id):
        raise HTTPException(status_code=403, detail="只有评论人或任务创建人可以删除评论")

    db.delete(comment)
    db.commit()


@router.get("/{task_id}/logs", response_model=list[ActivityLogOut])
def list_activity_logs(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    logs = db.query(ActivityLog).filter(ActivityLog.task_id == task_id).order_by(ActivityLog.created_at.asc()).all()
    result = []
    for log in logs:
        u = db.query(User).filter(User.id == log.user_id).first()
        result.append(ActivityLogOut(
            id=log.id, task_id=log.task_id, user_id=log.user_id,
            action_type=log.action_type, action_detail=log.action_detail,
            created_at=log.created_at, username=u.username if u else None,
        ))
    return result
