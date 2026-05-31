from datetime import datetime, timedelta

from budget_tracker.database import Database
from budget_tracker.models import RecurringBill
from budget_tracker.services.transaction import TransactionService


class RecurringService:
    def __init__(self, db: Database):
        self.db = db
        self.transaction_service = TransactionService(db)

    def create_bill(self, name, account_id, category_id, amount, frequency, next_date, end_date=None, description=""):
        now = datetime.now().isoformat()
        bill_id = self.db.execute(
            "INSERT INTO recurring_bills (name, account_id, category_id, amount, frequency, next_date, end_date, description, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
            (name, account_id, category_id, amount, frequency, next_date, end_date, description, now, now),
        )
        return bill_id

    def get_bill(self, bill_id):
        row = self.db.query_one("SELECT * FROM recurring_bills WHERE id = ?", (bill_id,))
        if row is None:
            return None
        return RecurringBill(**row)

    def list_bills(self, active_only=True):
        if active_only:
            rows = self.db.query_all("SELECT * FROM recurring_bills WHERE is_active = 1 ORDER BY next_date")
        else:
            rows = self.db.query_all("SELECT * FROM recurring_bills ORDER BY next_date")
        return [RecurringBill(**row) for row in rows]

    def update_bill(self, bill_id, **kwargs):
        bill = self.get_bill(bill_id)
        if bill is None:
            return False
        kwargs["updated_at"] = datetime.now().isoformat()
        sets = ", ".join(f"{k} = ?" for k in kwargs)
        values = list(kwargs.values()) + [bill_id]
        self.db.execute(f"UPDATE recurring_bills SET {sets} WHERE id = ?", values)
        return True

    def delete_bill(self, bill_id):
        bill = self.get_bill(bill_id)
        if bill is None:
            return False
        now = datetime.now().isoformat()
        self.db.execute("UPDATE recurring_bills SET is_active = 0, updated_at = ? WHERE id = ?", (now, bill_id))
        return True

    def check_due_bills(self):
        today = datetime.now().date()
        cutoff = today + timedelta(days=7)
        bills = self.list_bills(active_only=True)
        due_bills = []

        for bill in bills:
            next_date = datetime.strptime(bill.next_date, "%Y-%m-%d").date()
            days_until_due = (next_date - today).days
            if days_until_due <= 7:
                due_bills.append({
                    "bill": bill,
                    "days_until_due": days_until_due,
                })

        return due_bills

    def _get_next_date(self, current_date, frequency):
        date_obj = datetime.strptime(current_date, "%Y-%m-%d").date()
        if frequency == "daily":
            next_date = date_obj + timedelta(days=1)
        elif frequency == "weekly":
            next_date = date_obj + timedelta(weeks=1)
        elif frequency == "monthly":
            next_date = date_obj + timedelta(days=30)
        elif frequency == "yearly":
            next_date = date_obj + timedelta(days=365)
        else:
            next_date = date_obj + timedelta(days=30)
        return next_date.strftime("%Y-%m-%d")

    def _get_transaction_type(self, category_id):
        if category_id is None:
            return "expense"
        row = self.db.query_one("SELECT category_type FROM categories WHERE id = ?", (category_id,))
        if row is None:
            return "expense"
        return row["category_type"]

    def generate_transaction(self, bill_id):
        bill = self.get_bill(bill_id)
        if bill is None:
            return None

        transaction_type = self._get_transaction_type(bill.category_id)

        transaction_id = self.transaction_service.create_transaction(
            account_id=bill.account_id,
            transaction_type=transaction_type,
            amount=bill.amount,
            category_id=bill.category_id,
            description=bill.name,
            notes=bill.description,
            date=bill.next_date,
        )

        next_date = self._get_next_date(bill.next_date, bill.frequency)

        update_kwargs = {"next_date": next_date}

        if bill.end_date is not None:
            end_date_obj = datetime.strptime(bill.end_date, "%Y-%m-%d").date()
            next_date_obj = datetime.strptime(next_date, "%Y-%m-%d").date()
            if next_date_obj > end_date_obj:
                update_kwargs["is_active"] = False

        self.update_bill(bill_id, **update_kwargs)

        return transaction_id

    def process_due_bills(self):
        today = datetime.now().date()
        bills = self.list_bills(active_only=True)
        created_transactions = []

        for bill in bills:
            next_date = datetime.strptime(bill.next_date, "%Y-%m-%d").date()
            if next_date <= today:
                transaction_id = self.generate_transaction(bill.id)
                if transaction_id is not None:
                    created_transactions.append(transaction_id)

        return created_transactions
