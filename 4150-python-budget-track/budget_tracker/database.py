import sqlite3
import os
from contextlib import contextmanager
from budget_tracker.config import DB_PATH, DATA_DIR


def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'cash',
    currency TEXT NOT NULL DEFAULT 'CNY',
    balance REAL NOT NULL DEFAULT 0.0,
    initial_balance REAL NOT NULL DEFAULT 0.0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_type TEXT NOT NULL DEFAULT 'expense',
    icon TEXT DEFAULT '',
    is_default INTEGER NOT NULL DEFAULT 0,
    keywords TEXT DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    category_id INTEGER,
    transaction_type TEXT NOT NULL DEFAULT 'expense',
    amount REAL NOT NULL DEFAULT 0.0,
    original_amount REAL,
    original_currency TEXT,
    exchange_rate REAL,
    description TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    date TEXT NOT NULL,
    transfer_to_account_id INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (transfer_to_account_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    period TEXT NOT NULL DEFAULT 'monthly',
    amount REAL NOT NULL DEFAULT 0.0,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    warning_threshold REAL NOT NULL DEFAULT 0.8,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS budget_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    budget_id INTEGER NOT NULL,
    old_amount REAL NOT NULL DEFAULT 0.0,
    new_amount REAL NOT NULL DEFAULT 0.0,
    reason TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (budget_id) REFERENCES budgets(id)
);

CREATE TABLE IF NOT EXISTS recurring_bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    account_id INTEGER NOT NULL,
    category_id INTEGER,
    amount REAL NOT NULL DEFAULT 0.0,
    frequency TEXT NOT NULL DEFAULT 'monthly',
    next_date TEXT NOT NULL,
    end_date TEXT,
    description TEXT DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS exchange_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate REAL NOT NULL DEFAULT 1.0,
    source TEXT DEFAULT '',
    fetched_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category_id);
CREATE INDEX IF NOT EXISTS idx_recurring_next_date ON recurring_bills(next_date);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair ON exchange_rates(from_currency, to_currency);
"""


class Database:
    def __init__(self, db_path=None):
        self.db_path = db_path or DB_PATH
        _ensure_data_dir()

    @contextmanager
    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def initialize(self):
        with self.get_connection() as conn:
            conn.executescript(SCHEMA)

    def execute(self, sql, params=None):
        with self.get_connection() as conn:
            cursor = conn.execute(sql, params or ())
            return cursor.lastrowid

    def query_one(self, sql, params=None):
        with self.get_connection() as conn:
            cursor = conn.execute(sql, params or ())
            row = cursor.fetchone()
            return dict(row) if row else None

    def query_all(self, sql, params=None):
        with self.get_connection() as conn:
            cursor = conn.execute(sql, params or ())
            return [dict(row) for row in cursor.fetchall()]

    def execute_many(self, sql, params_list):
        with self.get_connection() as conn:
            conn.executemany(sql, params_list)


_db_instance = None


def get_db(db_path=None):
    global _db_instance
    if _db_instance is None:
        _db_instance = Database(db_path)
        _db_instance.initialize()
    return _db_instance


def reset_db(db_path=None):
    global _db_instance
    _db_instance = Database(db_path)
    _db_instance.initialize()
    return _db_instance
