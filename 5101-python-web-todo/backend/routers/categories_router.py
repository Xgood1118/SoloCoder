from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import Category, User
from schemas import CategoryCreate, CategoryUpdate, CategoryOut
from deps import get_current_user

router = APIRouter(prefix="/api/categories", tags=["分类"])


@router.get("/", response_model=list[CategoryOut])
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Category).order_by(Category.sort_weight.desc(), Category.id.asc()).all()


@router.post("/", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    cat_in: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(Category).filter(Category.name == cat_in.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="该分类名称已存在")
    cat = Category(name=cat_in.name, color=cat_in.color, sort_weight=cat_in.sort_weight)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    cat_in: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="分类不存在")
    if cat_in.name is not None:
        existing = db.query(Category).filter(Category.name == cat_in.name, Category.id != category_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="该分类名称已存在")
        cat.name = cat_in.name
    if cat_in.color is not None:
        cat.color = cat_in.color
    if cat_in.sort_weight is not None:
        cat.sort_weight = cat_in.sort_weight
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="分类不存在")
    db.delete(cat)
    db.commit()
