from datetime import datetime
from budget_tracker.models import Transaction
from budget_tracker.database import Database


class TransactionService:
    def __init__(self, db: Database):
        self.db = db

    def create_transaction(self, account_id, transaction_type, amount, category_id=None, description="", notes="", tags="", date=None, original_amount=None, original_currency=None, exchange_rate=None):
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        now = datetime.now().isoformat()
        txn_id = self.db.execute(
            "INSERT INTO transactions (account_id, category_id, transaction_type, amount, original_amount, original_currency, exchange_rate, description, notes, tags, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (account_id, category_id, transaction_type, amount, original_amount, original_currency, exchange_rate, description, notes, tags, date, now, now),
        )
        if transaction_type == "income":
            self.db.execute("UPDATE accounts SET balance = balance + ?, updated_at = ? WHERE id = ?", (amount, now, account_id))
        elif transaction_type == "expense":
            self.db.execute("UPDATE accounts SET balance = balance - ?, updated_at = ? WHERE id = ?", (amount, now, account_id))
        return txn_id

    def create_transfer(self, from_account_id, to_account_id, amount, description="", notes="", tags="", date=None):
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        now = datetime.now().isoformat()
        from_txn_id = self.db.execute(
            "INSERT INTO transactions (account_id, transaction_type, amount, description, notes, tags, date, transfer_to_account_id, created_at, updated_at) VALUES (?, 'transfer', ?, ?, ?, ?, ?, ?, ?, ?)",
            (from_account_id, amount, description, notes, tags, date, to_account_id, now, now),
        )
        to_txn_id = self.db.execute(
            "INSERT INTO transactions (account_id, transaction_type, amount, description, notes, tags, date, transfer_to_account_id, created_at, updated_at) VALUES (?, 'transfer', ?, ?, ?, ?, ?, ?, ?, ?)",
            (to_account_id, amount, description, notes, tags, date, from_account_id, now, now),
        )
        self.db.execute("UPDATE accounts SET balance = balance - ?, updated_at = ? WHERE id = ?", (amount, now, from_account_id))
        self.db.execute("UPDATE accounts SET balance = balance + ?, updated_at = ? WHERE id = ?", (amount, now, to_account_id))
        return (from_txn_id, to_txn_id)

    def get_transaction(self, transaction_id):
        row = self.db.query_one("SELECT * FROM transactions WHERE id = ?", (transaction_id,))
        if row is None:
            return None
        return Transaction(**row)

    def list_transactions(self, account_id=None, category_id=None, transaction_type=None, start_date=None, end_date=None, tags=None, limit=100, offset=0):
        conditions = []
        params = []
        if account_id is not None:
            conditions.append("account_id = ?")
            params.append(account_id)
        if category_id is not None:
            conditions.append("category_id = ?")
            params.append(category_id)
        if transaction_type is not None:
            conditions.append("transaction_type = ?")
            params.append(transaction_type)
        if start_date is not None:
            conditions.append("date >= ?")
            params.append(start_date)
        if end_date is not None:
            conditions.append("date <= ?")
            params.append(end_date)
        if tags is not None:
            conditions.append("tags LIKE ?")
            params.append(f"%{tags}%")
        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)
        limit_clause = ""
        if limit is not None:
            limit_clause = "LIMIT ? OFFSET ?"
            params.extend([limit, offset])
        sql = f"SELECT * FROM transactions {where_clause} ORDER BY date DESC, id DESC {limit_clause}"
        rows = self.db.query_all(sql, params)
        return [Transaction(**row) for row in rows]

    def update_transaction(self, transaction_id, **kwargs):
        txn = self.get_transaction(transaction_id)
        if txn is None:
            return False
        old_account_id = txn.account_id
        old_amount = txn.amount
        old_type = txn.transaction_type
        now = datetime.now().isoformat()
        kwargs["updated_at"] = now
        sets = ", ".join(f"{k} = ?" for k in kwargs)
        values = list(kwargs.values()) + [transaction_id]
        self.db.execute(f"UPDATE transactions SET {sets} WHERE id = ?", values)
        new_account_id = kwargs.get("account_id", old_account_id)
        new_amount = kwargs.get("amount", old_amount)
        new_type = kwargs.get("transaction_type", old_type)
        need_recalc = ("account_id" in kwargs or "amount" in kwargs or "transaction_type" in kwargs)
        if need_recalc:
            if old_type == "income":
                self.db.execute("UPDATE accounts SET balance = balance - ?, updated_at = ? WHERE id = ?", (old_amount, now, old_account_id))
            elif old_type == "expense":
                self.db.execute("UPDATE accounts SET balance = balance + ?, updated_at = ? WHERE id = ?", (old_amount, now, old_account_id))
            if new_type == "income":
                self.db.execute("UPDATE accounts SET balance = balance + ?, updated_at = ? WHERE id = ?", (new_amount, now, new_account_id))
            elif new_type == "expense":
                self.db.execute("UPDATE accounts SET balance = balance - ?, updated_at = ? WHERE id = ?", (new_amount, now, new_account_id))
        return True

    def delete_transaction(self, transaction_id):
        txn = self.get_transaction(transaction_id)
        if txn is None:
            return False
        now = datetime.now().isoformat()
        if txn.transaction_type == "income":
            self.db.execute("UPDATE accounts SET balance = balance - ?, updated_at = ? WHERE id = ?", (txn.amount, now, txn.account_id))
        elif txn.transaction_type == "expense":
            self.db.execute("UPDATE accounts SET balance = balance + ?, updated_at = ? WHERE id = ?", (txn.amount, now, txn.account_id))
        self.db.execute("DELETE FROM transactions WHERE id = ?", (transaction_id,))
        return True

    def get_transactions_summary(self, account_id=None, start_date=None, end_date=None):
        conditions = []
        params = []
        if account_id is not None:
            conditions.append("account_id = ?")
            params.append(account_id)
        if start_date is not None:
            conditions.append("date >= ?")
            params.append(start_date)
        if end_date is not None:
            conditions.append("date <= ?")
            params.append(end_date)
        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)
        row = self.db.query_one(
            f"SELECT COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) AS total_income, COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense, COUNT(*) AS count FROM transactions {where_clause}",
            params,
        )
        total_income = float(row["total_income"])
        total_expense = float(row["total_expense"])
        return {
            "total_income": total_income,
            "total_expense": total_expense,
            "net": total_income - total_expense,
            "count": row["count"],
        }

    def get_category_summary(self, start_date=None, end_date=None, transaction_type="expense"):
        conditions = ["t.transaction_type = ?"]
        params = [transaction_type]
        if start_date is not None:
            conditions.append("t.date >= ?")
            params.append(start_date)
        if end_date is not None:
            conditions.append("t.date <= ?")
            params.append(end_date)
        where_clause = "WHERE " + " AND ".join(conditions)
        rows = self.db.query_all(
            f"SELECT t.category_id, c.name AS category_name, COALESCE(SUM(t.amount), 0) AS total_amount FROM transactions t LEFT JOIN categories c ON t.category_id = c.id {where_clause} GROUP BY t.category_id, c.name ORDER BY total_amount DESC",
            params,
        )
        grand_total = sum(float(r["total_amount"]) for r in rows)
        result = []
        for r in rows:
            total_amount = float(r["total_amount"])
            percentage = (total_amount / grand_total * 100) if grand_total > 0 else 0.0
            result.append({
                "category_id": r["category_id"],
                "category_name": r["category_name"],
                "total_amount": total_amount,
                "percentage": round(percentage, 2),
            })
        return result
