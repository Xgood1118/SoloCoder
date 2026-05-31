"""
数据库基础设施
使用SQLAlchemy 2.0进行数据库访问
"""
from typing import Generator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError

from sync_crm.config import settings
from sync_crm.models import Base
from sync_crm.infrastructure.logging import get_logger

logger = get_logger(__name__)

engine = create_engine(
    settings.database.url,
    pool_size=settings.database.pool_size,
    max_overflow=settings.database.max_overflow,
    pool_recycle=settings.database.pool_recycle,
    pool_pre_ping=True,
    echo=settings.database.echo,
    isolation_level="READ COMMITTED",
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)


def init_database() -> None:
    """初始化数据库表结构"""
    logger.info("初始化数据库表结构")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("数据库表结构创建完成")
    except SQLAlchemyError as e:
        logger.error(f"数据库表结构创建失败: {e}", exc_info=True)
        raise


def get_db() -> Generator[Session, None, None]:
    """
    获取数据库会话（FastAPI依赖注入用）

    Yields:
        SQLAlchemy会话
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    """
    上下文管理器形式获取数据库会话

    Yields:
        SQLAlchemy会话
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
