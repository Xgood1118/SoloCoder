from datetime import datetime
from calendar import monthrange
from budget_tracker.database import get_db, Database
from budget_tracker.services.transaction import TransactionService


def _add_months(dt, months):
    month = dt.month - 1 + months
    year = dt.year + month // 12
    month = month % 12 + 1
    day = min(dt.day, monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


class VisualizationService:
    def __init__(self, db: Database = None):
        self.db = db or get_db()
        self.transaction_service = TransactionService(self.db)

    def get_monthly_trend(self, start_date=None, end_date=None, transaction_type="expense") -> list:
        conditions = ["transaction_type = ?"]
        params = [transaction_type]
        if start_date is not None:
            conditions.append("date >= ?")
            params.append(start_date)
        if end_date is not None:
            conditions.append("date <= ?")
            params.append(end_date)
        where_clause = "WHERE " + " AND ".join(conditions)
        rows = self.db.query_all(
            f"SELECT strftime('%Y-%m', date) AS month, COALESCE(SUM(amount), 0) AS amount FROM transactions {where_clause} GROUP BY strftime('%Y-%m', date) ORDER BY month ASC",
            params,
        )
        return [{"month": row["month"], "amount": float(row["amount"])} for row in rows]

    def get_category_pie(self, start_date=None, end_date=None, transaction_type="expense") -> list:
        category_summary = self.transaction_service.get_category_summary(
            start_date=start_date,
            end_date=end_date,
            transaction_type=transaction_type,
        )
        return [
            {
                "category": item["category_name"] or "Uncategorized",
                "amount": item["total_amount"],
                "percentage": item["percentage"],
            }
            for item in category_summary
        ]

    def get_monthly_category_comparison(self, category_id, months=3) -> list:
        today = datetime.now()
        end_date = today.strftime("%Y-%m-%d")
        start_month = _add_months(today.replace(day=1), -(months - 1))
        start_date = start_month.strftime("%Y-%m-%d")

        conditions = ["category_id = ?", "date >= ?", "date <= ?"]
        params = [category_id, start_date, end_date]
        rows = self.db.query_all(
            "SELECT strftime('%Y-%m', date) AS month, COALESCE(SUM(amount), 0) AS amount FROM transactions WHERE " + " AND ".join(conditions) + " GROUP BY strftime('%Y-%m', date) ORDER BY month ASC",
            params,
        )

        result = []
        current = start_month
        for _ in range(months):
            month_str = current.strftime("%Y-%m")
            amount = 0.0
            for row in rows:
                if row["month"] == month_str:
                    amount = float(row["amount"])
                    break
            result.append({"month": month_str, "amount": amount})
            current = _add_months(current, 1)

        return result
