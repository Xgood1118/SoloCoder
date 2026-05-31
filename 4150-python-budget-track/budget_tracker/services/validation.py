from budget_tracker.database import Database
from budget_tracker.services.transaction import TransactionService
from budget_tracker.services.account import AccountService


class ValidationService:
    def __init__(self, db: Database):
        self.db = db
        self.transaction_service = TransactionService(db)
        self.account_service = AccountService(db)

    def validate_balances(self):
        accounts = self.account_service.list_accounts(active_only=False)
        total_initial = sum(acc.initial_balance for acc in accounts)
        total_current = sum(acc.balance for acc in accounts)

        summary = self.transaction_service.get_transactions_summary()
        total_income = summary["total_income"]
        total_expense = summary["total_expense"]

        expected_balance = total_initial + total_income - total_expense
        discrepancy = expected_balance - total_current

        is_valid = abs(discrepancy) < 0.01
        details = (
            f"Initial: {total_initial:.2f}, Income: {total_income:.2f}, "
            f"Expense: {total_expense:.2f}, Expected: {expected_balance:.2f}, "
            f"Actual: {total_current:.2f}, Discrepancy: {discrepancy:.2f}"
        )

        return {
            "is_valid": is_valid,
            "discrepancy": round(discrepancy, 2),
            "details": details,
        }

    def validate_category_sums(self, start_date=None, end_date=None):
        expense_summary = self.transaction_service.get_category_summary(
            start_date=start_date, end_date=end_date, transaction_type="expense"
        )
        income_summary = self.transaction_service.get_category_summary(
            start_date=start_date, end_date=end_date, transaction_type="income"
        )

        total_expense = sum(cat["total_amount"] for cat in expense_summary)
        total_income = sum(cat["total_amount"] for cat in income_summary)

        conditions = []
        params = []
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
            f"SELECT COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) AS total_income, "
            f"COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense "
            f"FROM transactions {where_clause}",
            params,
        )

        actual_income = float(row["total_income"])
        actual_expense = float(row["total_expense"])

        category_sums = []
        for cat in expense_summary:
            category_sums.append({
                "category_id": cat["category_id"],
                "category_name": cat["category_name"],
                "transaction_type": "expense",
                "total_amount": cat["total_amount"],
            })
        for cat in income_summary:
            category_sums.append({
                "category_id": cat["category_id"],
                "category_name": cat["category_name"],
                "transaction_type": "income",
                "total_amount": cat["total_amount"],
            })

        grand_total = total_income - total_expense

        income_valid = abs(total_income - actual_income) < 0.01
        expense_valid = abs(total_expense - actual_expense) < 0.01

        return {
            "is_valid": income_valid and expense_valid,
            "category_sums": category_sums,
            "grand_total": round(grand_total, 2),
            "total_by_type": {
                "income": round(total_income, 2),
                "expense": round(total_expense, 2),
                "actual_income": round(actual_income, 2),
                "actual_expense": round(actual_expense, 2),
            },
        }

    def find_mismatched_transactions(self):
        issues = []

        valid_account_ids = set()
        accounts = self.account_service.list_accounts(active_only=False)
        for acc in accounts:
            valid_account_ids.add(acc.id)

        valid_category_ids = set()
        categories = self.db.query_all("SELECT id FROM categories")
        for cat in categories:
            valid_category_ids.add(cat["id"])

        all_transactions = self.db.query_all(
            "SELECT id, account_id, category_id, transaction_type, amount, transfer_to_account_id FROM transactions"
        )

        for txn in all_transactions:
            txn_id = txn["id"]
            account_id = txn["account_id"]
            category_id = txn["category_id"]
            txn_type = txn["transaction_type"]
            amount = txn["amount"]
            transfer_to = txn["transfer_to_account_id"]

            if account_id not in valid_account_ids:
                issues.append({
                    "transaction_id": txn_id,
                    "issue": f"Invalid account_id: {account_id}",
                    "suggestion": "Update to a valid account or create the missing account",
                })

            if txn_type != "transfer" and category_id is not None and category_id not in valid_category_ids:
                issues.append({
                    "transaction_id": txn_id,
                    "issue": f"Invalid category_id: {category_id}",
                    "suggestion": "Update to a valid category or create the missing category",
                })

            if amount <= 0:
                issues.append({
                    "transaction_id": txn_id,
                    "issue": f"Invalid amount: {amount} (should be positive)",
                    "suggestion": "Update amount to a positive value",
                })

            if txn_type == "transfer":
                if transfer_to is None:
                    issues.append({
                        "transaction_id": txn_id,
                        "issue": "Transfer transaction missing transfer_to_account_id",
                        "suggestion": "Add the destination account or recreate the transfer",
                    })
                elif transfer_to not in valid_account_ids:
                    issues.append({
                        "transaction_id": txn_id,
                        "issue": f"Invalid transfer_to_account_id: {transfer_to}",
                        "suggestion": "Update to a valid destination account",
                    })
                else:
                    pair = self.db.query_one(
                        "SELECT id FROM transactions WHERE transaction_type = 'transfer' "
                        "AND account_id = ? AND transfer_to_account_id = ? AND id != ?",
                        (transfer_to, account_id, txn_id),
                    )
                    if pair is None:
                        issues.append({
                            "transaction_id": txn_id,
                            "issue": "Transfer transaction missing matching pair",
                            "suggestion": "Recreate the transfer to generate both sides of the transaction",
                        })

        return issues

    def run_all_validations(self):
        return {
            "balance_validation": self.validate_balances(),
            "category_validation": self.validate_category_sums(),
            "mismatched_transactions": self.find_mismatched_transactions(),
        }
