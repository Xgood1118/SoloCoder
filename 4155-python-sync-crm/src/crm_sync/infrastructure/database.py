from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from crm_sync.config import get_settings

settings = get_settings()


def _create_engine():
    db_url = settings.database.url
    is_sqlite = db_url.startswith("sqlite")

    if is_sqlite:
        return create_engine(
            db_url,
            echo=settings.database.echo,
        )
    else:
        return create_engine(
            db_url,
            pool_size=settings.database.pool_size,
            max_overflow=settings.database.max_overflow,
            echo=settings.database.echo,
            pool_pre_ping=True,
        )


engine = _create_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_db() -> None:
    from crm_sync.models import SyncMapping, SyncLog, SyncTask

    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
