import os
import sys

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["CELERY_BROKER_URL"] = "redis://localhost:6379/1"
os.environ["CELERY_RESULT_BACKEND"] = "redis://localhost:6379/2"
os.environ["CRM_API_BASE_URL"] = "http://localhost:8080/api"
os.environ["CRM_API_KEY"] = "test_crm_key"
os.environ["MARKETING_API_BASE_URL"] = "http://localhost:9090/api"
os.environ["MARKETING_API_KEY"] = "test_marketing_key"
os.environ["LOG_LEVEL"] = "INFO"
os.environ["LOG_FILE_PATH"] = "./logs/app.log"
os.environ["TIMEZONE"] = "Asia/Shanghai"

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from crm_sync.infrastructure.database import Base


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
