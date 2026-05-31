from datetime import datetime
from budget_tracker.models import Account
from budget_tracker.database import Database


class AccountService:
    def __init__(self, db: Database):
        self.db = db

    def create_account(self, name, account_type="cash", currency="CNY", initial_balance=0.0):
        now = datetime.now().isoformat()
        account_id = self.db.execute(
            "INSERT INTO accounts (name, account_type, currency, balance, initial_balance, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
            (name, account_type, currency, initial_balance, initial_balance, now, now),
        )
        return self.get_account(account_id)

    def get_account(self, account_id):
        row = self.db.query_one("SELECT * FROM accounts WHERE id = ?", (account_id,))
        if row is None:
            return None
        return Account(**row)

    def list_accounts(self, active_only=True):
        if active_only:
            rows = self.db.query_all("SELECT * FROM accounts WHERE is_active = 1 ORDER BY id")
        else:
            rows = self.db.query_all("SELECT * FROM accounts ORDER BY id")
        return [Account(**row) for row in rows]

    def update_account(self, account_id, **kwargs):
        account = self.get_account(account_id)
        if account is None:
            return None
        kwargs["updated_at"] = datetime.now().isoformat()
        sets = ", ".join(f"{k} = ?" for k in kwargs)
        values = list(kwargs.values()) + [account_id]
        self.db.execute(f"UPDATE accounts SET {sets} WHERE id = ?", values)
        return self.get_account(account_id)

    def delete_account(self, account_id):
        now = datetime.now().isoformat()
        self.db.execute("UPDATE accounts SET is_active = 0, updated_at = ? WHERE id = ?", (now, account_id))

    def get_account_balance(self, account_id):
        row = self.db.query_one("SELECT balance FROM accounts WHERE id = ?", (account_id,))
        if row is None:
            return None
        return row["balance"]

    def adjust_balance(self, account_id, amount):
        now = datetime.now().isoformat()
        self.db.execute("UPDATE accounts SET balance = balance + ?, updated_at = ? WHERE id = ?", (amount, now, account_id))
        return self.get_account_balance(account_id)

    def transfer(self, from_id, to_id, amount):
        now = datetime.now().isoformat()
        self.db.execute("UPDATE accounts SET balance = balance - ?, updated_at = ? WHERE id = ?", (amount, now, from_id))
        self.db.execute("UPDATE accounts SET balance = balance + ?, updated_at = ? WHERE id = ?", (amount, now, to_id))
        return (None, None)
