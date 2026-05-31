from datetime import datetime
from budget_tracker.models import Budget, BudgetAdjustment
from budget_tracker.database import Database


class BudgetService:
    def __init__(self, db: Database):
        self.db = db

    def create_budget(self, category_id, period, amount, start_date, end_date, warning_threshold=0.8):
        now = datetime.now().isoformat()
        budget_id = self.db.execute(
            "INSERT INTO budgets (category_id, period, amount, start_date, end_date, warning_threshold, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
            (category_id, period, amount, start_date, end_date, warning_threshold, now, now),
        )
        return budget_id

    def get_budget(self, budget_id):
        row = self.db.query_one("SELECT * FROM budgets WHERE id = ?", (budget_id,))
        if row is None:
            return None
        return Budget(**row)

    def list_budgets(self, active_only=True, period=None):
        conditions = []
        params = []
        if active_only:
            conditions.append("is_active = 1")
        if period is not None:
            conditions.append("period = ?")
            params.append(period)
        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)
        rows = self.db.query_all(f"SELECT * FROM budgets {where_clause} ORDER BY id", params)
        return [Budget(**row) for row in rows]

    def update_budget(self, budget_id, **kwargs):
        budget = self.get_budget(budget_id)
        if budget is None:
            return False
        if "amount" in kwargs and kwargs["amount"] != budget.amount:
            now = datetime.now().isoformat()
            self.db.execute(
                "INSERT INTO budget_adjustments (budget_id, old_amount, new_amount, reason, created_at) VALUES (?, ?, ?, ?, ?)",
                (budget_id, budget.amount, kwargs["amount"], kwargs.get("reason", ""), now),
            )
        now = datetime.now().isoformat()
        kwargs["updated_at"] = now
        if "reason" in kwargs:
            del kwargs["reason"]
        sets = ", ".join(f"{k} = ?" for k in kwargs)
        values = list(kwargs.values()) + [budget_id]
        self.db.execute(f"UPDATE budgets SET {sets} WHERE id = ?", values)
        return True

    def delete_budget(self, budget_id):
        budget = self.get_budget(budget_id)
        if budget is None:
            return False
        self.db.execute("DELETE FROM budget_adjustments WHERE budget_id = ?", (budget_id,))
        self.db.execute("DELETE FROM budgets WHERE id = ?", (budget_id,))
        return True

    def get_budget_progress(self, budget_id):
        budget = self.get_budget(budget_id)
        if budget is None:
            return None
        row = self.db.query_one(
            "SELECT COALESCE(SUM(amount), 0) AS spent FROM transactions WHERE category_id = ? AND transaction_type = 'expense' AND date >= ? AND date <= ?",
            (budget.category_id, budget.start_date, budget.end_date),
        )
        spent = float(row["spent"])
        remaining = budget.amount - spent
        percentage = spent / budget.amount if budget.amount > 0 else 0.0
        if percentage >= 1.0:
            status = "exceeded"
        elif percentage >= budget.warning_threshold:
            status = "warning"
        else:
            status = "normal"
        cat_row = self.db.query_one("SELECT name FROM categories WHERE id = ?", (budget.category_id,))
        category_name = cat_row["name"] if cat_row else ""
        return {
            "budget_id": budget.id,
            "category_id": budget.category_id,
            "category_name": category_name,
            "budget_amount": budget.amount,
            "spent": spent,
            "remaining": remaining,
            "percentage": percentage,
            "status": status,
        }

    def get_all_budget_progress(self, period=None):
        budgets = self.list_budgets(active_only=True, period=period)
        return [self.get_budget_progress(b.id) for b in budgets]

    def check_budget_alerts(self):
        all_progress = self.get_all_budget_progress()
        alerts = []
        for progress in all_progress:
            if progress["status"] == "exceeded":
                alerts.append({
                    "budget_id": progress["budget_id"],
                    "category_name": progress["category_name"],
                    "budget_amount": progress["budget_amount"],
                    "spent": progress["spent"],
                    "percentage": progress["percentage"],
                    "alert_type": "exceeded",
                })
            elif progress["status"] == "warning":
                alerts.append({
                    "budget_id": progress["budget_id"],
                    "category_name": progress["category_name"],
                    "budget_amount": progress["budget_amount"],
                    "spent": progress["spent"],
                    "percentage": progress["percentage"],
                    "alert_type": "warning",
                })
        return alerts

    def get_budget_comparison(self, category_id, period1_start, period1_end, period2_start, period2_end):
        row1 = self.db.query_one(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE category_id = ? AND transaction_type = 'expense' AND date >= ? AND date <= ?",
            (category_id, period1_start, period1_end),
        )
        row2 = self.db.query_one(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE category_id = ? AND transaction_type = 'expense' AND date >= ? AND date <= ?",
            (category_id, period2_start, period2_end),
        )
        period1_spent = float(row1["total"])
        period2_spent = float(row2["total"])
        difference = period2_spent - period1_spent
        change_percentage = (difference / period1_spent * 100) if period1_spent > 0 else 0.0
        cat_row = self.db.query_one("SELECT name FROM categories WHERE id = ?", (category_id,))
        category_name = cat_row["name"] if cat_row else ""
        return {
            "category_name": category_name,
            "period1_spent": period1_spent,
            "period2_spent": period2_spent,
            "difference": difference,
            "change_percentage": change_percentage,
        }

    def get_budget_adjustments(self, budget_id):
        rows = self.db.query_all("SELECT * FROM budget_adjustments WHERE budget_id = ? ORDER BY created_at", (budget_id,))
        return [BudgetAdjustment(**row) for row in rows]
