import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Tag, Image
from app.schemas import TagCreate, TagUpdate, TagResponse, BatchTagRequest, BatchTagReplaceRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.post("/", response_model=TagResponse)
def create_tag(tag_data: TagCreate, db: Session = Depends(get_db)):
    existing = db.query(Tag).filter(Tag.name == tag_data.name, Tag.parent_id == tag_data.parent_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Tag '{tag_data.name}' already exists at this level")

    level = 0
    if tag_data.parent_id:
        parent = db.query(Tag).filter(Tag.id == tag_data.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent tag not found")
        level = parent.level + 1

    tag = Tag(name=tag_data.name, parent_id=tag_data.parent_id, level=level)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return TagResponse(**tag.to_dict())


@router.get("/", response_model=list[TagResponse])
def list_tags(
    parent_id: Optional[int] = None,
    flat: bool = False,
    db: Session = Depends(get_db),
):
    if flat:
        tags = db.query(Tag).order_by(Tag.level, Tag.name).all()
        return [TagResponse(**tag.to_dict(include_children=False)) for tag in tags]

    if parent_id is not None:
        tags = db.query(Tag).filter(Tag.parent_id == parent_id).order_by(Tag.name).all()
    else:
        tags = db.query(Tag).filter(Tag.parent_id == None).order_by(Tag.name).all()

    return [TagResponse(**tag.to_dict(include_children=True)) for tag in tags]


@router.get("/tree", response_model=list[TagResponse])
def get_tag_tree(db: Session = Depends(get_db)):
    root_tags = db.query(Tag).filter(Tag.parent_id == None).order_by(Tag.name).all()
    return [TagResponse(**tag.to_dict(include_children=True)) for tag in root_tags]


@router.get("/{tag_id}", response_model=TagResponse)
def get_tag(tag_id: int, db: Session = Depends(get_db)):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return TagResponse(**tag.to_dict())


@router.put("/{tag_id}", response_model=TagResponse)
def update_tag(tag_id: int, tag_data: TagUpdate, db: Session = Depends(get_db)):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    if tag_data.name is not None:
        tag.name = tag_data.name
    if tag_data.parent_id is not None:
        if tag_data.parent_id == tag_id:
            raise HTTPException(status_code=400, detail="Tag cannot be its own parent")
        parent = db.query(Tag).filter(Tag.id == tag_data.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent tag not found")
        tag.parent_id = tag_data.parent_id
        tag.level = parent.level + 1

    db.commit()
    db.refresh(tag)
    return TagResponse(**tag.to_dict())


@router.delete("/{tag_id}")
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(tag)
    db.commit()
    return {"message": "Tag deleted", "id": tag_id}


@router.post("/batch-tag")
def batch_tag_images(request: BatchTagRequest, db: Session = Depends(get_db)):
    images = db.query(Image).filter(Image.id.in_(request.image_ids)).all()
    tags = db.query(Tag).filter(Tag.id.in_(request.tag_ids)).all()

    if not images:
        raise HTTPException(status_code=404, detail="No images found")
    if not tags:
        raise HTTPException(status_code=404, detail="No tags found")

    updated = 0
    for image in images:
        if request.mode == "add":
            for tag in tags:
                if tag not in image.tags:
                    image.tags.append(tag)
                    updated += 1
        elif request.mode == "remove":
            for tag in tags:
                if tag in image.tags:
                    image.tags.remove(tag)
                    updated += 1
        elif request.mode == "replace":
            image.tags = list(tags)
            updated += 1

    db.commit()
    return {"message": "Batch tag operation completed", "updated_count": updated}


@router.post("/batch-replace-tag")
def batch_replace_tag(request: BatchTagReplaceRequest, db: Session = Depends(get_db)):
    old_tag = db.query(Tag).filter(Tag.id == request.old_tag_id).first()
    new_tag = db.query(Tag).filter(Tag.id == request.new_tag_id).first()

    if not old_tag:
        raise HTTPException(status_code=404, detail="Old tag not found")
    if not new_tag:
        raise HTTPException(status_code=404, detail="New tag not found")

    images = db.query(Image).filter(Image.id.in_(request.image_ids), Image.tags.any(id=old_tag.id)).all()

    updated = 0
    for image in images:
        if old_tag in image.tags:
            image.tags.remove(old_tag)
            if new_tag not in image.tags:
                image.tags.append(new_tag)
            updated += 1

    db.commit()
    return {"message": "Batch replace tag completed", "updated_count": updated}
