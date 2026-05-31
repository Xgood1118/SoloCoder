#!/usr/bin/env python
from sqlalchemy import text

from crm_sync.infrastructure.database import Base, engine


def init_database():
    print("Creating database tables...")
    
    Base.metadata.create_all(bind=engine)
    
    print("Database tables created successfully!")


def show_tables():
    from sqlalchemy import inspect
    
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print("\nExisting tables:")
    for table in tables:
        print(f"  - {table}")


if __name__ == "__main__":
    init_database()
    show_tables()
