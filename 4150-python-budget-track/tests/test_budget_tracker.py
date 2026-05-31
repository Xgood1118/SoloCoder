import unittest
import os
import tempfile
from datetime import date, timedelta
from budget_tracker.database import reset_db
from budget_tracker.services.account import AccountService
from budget_tracker.services.category import CategoryService
from budget_tracker.services.transaction import TransactionService
from budget_tracker.services.budget import BudgetService
from budget_tracker.services.visualization import VisualizationService
from budget_tracker.services.currency import CurrencyService
from budget_tracker.services.validation import ValidationService
from budget_tracker.services.recurring import RecurringService
from budget_tracker import initialize_system


class TestBase(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.mktemp(suffix=".db")
        self.db = reset_db(self.temp_db)
        initialize_system(self.db)
        self.acc_svc = AccountService(self.db)
        self.cat_svc = CategoryService(self.db)
        self.txn_svc = TransactionService(self.db)
        self.budget_svc = BudgetService(self.db)
        self.viz_svc = VisualizationService(self.db)
        self.currency_svc = CurrencyService(self.db)
        self.val_svc = ValidationService(self.db)
        self.recur_svc = RecurringService(self.db)

    def tearDown(self):
        if os.path.exists(self.temp_db):
            os.unlink(self.temp_db)


class TestAccountService(TestBase):
    def test_create_account(self):
        acc = self.acc_svc.create_account("Test Cash", "cash", "CNY", 1000.0)
        self.assertIsNotNone(acc.id)
        self.assertEqual(acc.name, "Test Cash")
        self.assertEqual(acc.balance, 1000.0)
        self.assertEqual(acc.initial_balance, 1000.0)

    def test_list_accounts(self):
        accounts = self.acc_svc.list_accounts()
        self.assertGreater(len(accounts), 0)

    def test_update_account(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 0)
        updated = self.acc_svc.update_account(acc.id, name="Updated", currency="USD")
        self.assertEqual(updated.name, "Updated")
        self.assertEqual(updated.currency, "USD")

    def test_delete_account(self):
        acc = self.acc_svc.create_account("ToDelete", "cash", "CNY", 0)
        self.acc_svc.delete_account(acc.id)
        accounts = self.acc_svc.list_accounts(active_only=True)
        self.assertNotIn(acc.id, [a.id for a in accounts])

    def test_transfer(self):
        acc1 = self.acc_svc.create_account("From", "cash", "CNY", 1000.0)
        acc2 = self.acc_svc.create_account("To", "cash", "CNY", 500.0)
        from_txn, to_txn = self.txn_svc.create_transfer(acc1.id, acc2.id, 300.0)
        self.assertIsNotNone(from_txn)
        self.assertIsNotNone(to_txn)
        bal1 = self.acc_svc.get_account_balance(acc1.id)
        bal2 = self.acc_svc.get_account_balance(acc2.id)
        self.assertEqual(bal1, 700.0)
        self.assertEqual(bal2, 800.0)


class TestCategoryService(TestBase):
    def test_create_category(self):
        cat = self.cat_svc.create_category("Test Cat", "expense", "test,demo")
        self.assertIsNotNone(cat.id)
        self.assertEqual(cat.name, "Test Cat")

    def test_init_default_categories(self):
        cats = self.cat_svc.list_categories("expense")
        self.assertGreater(len(cats), 0)

    def test_auto_classify(self):
        cat_id = self.cat_svc.auto_classify("星巴克咖啡")
        self.assertIsNotNone(cat_id)


class TestTransactionService(TestBase):
    def test_create_income(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 0)
        cat_row = self.db.query_one("SELECT id FROM categories WHERE name = '工资'")
        txn_id = self.txn_svc.create_transaction(
            account_id=acc.id,
            transaction_type="income",
            amount=5000.0,
            category_id=cat_row["id"],
            description="Test salary",
            date="2026-01-15",
        )
        self.assertIsNotNone(txn_id)
        bal = self.acc_svc.get_account_balance(acc.id)
        self.assertEqual(bal, 5000.0)

    def test_create_expense(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 1000.0)
        cat_row = self.db.query_one("SELECT id FROM categories WHERE name = '餐饮'")
        txn_id = self.txn_svc.create_transaction(
            account_id=acc.id,
            transaction_type="expense",
            amount=100.0,
            category_id=cat_row["id"],
            description="Lunch",
            date="2026-01-15",
        )
        self.assertIsNotNone(txn_id)
        bal = self.acc_svc.get_account_balance(acc.id)
        self.assertEqual(bal, 900.0)

    def test_list_transactions(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 0)
        cat_row = self.db.query_one("SELECT id FROM categories WHERE name = '餐饮'")
        for i in range(5):
            self.txn_svc.create_transaction(
                account_id=acc.id,
                transaction_type="expense",
                amount=10.0 * (i + 1),
                category_id=cat_row["id"],
                description=f"Test {i}",
            )
        txns = self.txn_svc.list_transactions(account_id=acc.id)
        self.assertEqual(len(txns), 5)

    def test_update_transaction(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 1000.0)
        cat_row = self.db.query_one("SELECT id FROM categories WHERE name = '餐饮'")
        txn_id = self.txn_svc.create_transaction(
            account_id=acc.id,
            transaction_type="expense",
            amount=100.0,
            category_id=cat_row["id"],
        )
        result = self.txn_svc.update_transaction(txn_id, amount=200.0)
        self.assertTrue(result)
        txn = self.txn_svc.get_transaction(txn_id)
        self.assertEqual(txn.amount, 200.0)
        bal = self.acc_svc.get_account_balance(acc.id)
        self.assertEqual(bal, 800.0)

    def test_delete_transaction(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 1000.0)
        cat_row = self.db.query_one("SELECT id FROM categories WHERE name = '餐饮'")
        txn_id = self.txn_svc.create_transaction(
            account_id=acc.id,
            transaction_type="expense",
            amount=100.0,
            category_id=cat_row["id"],
        )
        result = self.txn_svc.delete_transaction(txn_id)
        self.assertTrue(result)
        bal = self.acc_svc.get_account_balance(acc.id)
        self.assertEqual(bal, 1000.0)

    def test_transactions_summary(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 0)
        income_cat = self.db.query_one("SELECT id FROM categories WHERE name = '工资'")
        expense_cat = self.db.query_one("SELECT id FROM categories WHERE name = '餐饮'")
        self.txn_svc.create_transaction(
            account_id=acc.id, transaction_type="income",
            amount=5000.0, category_id=income_cat["id"], date="2026-01-15")
        self.txn_svc.create_transaction(
            account_id=acc.id, transaction_type="expense",
            amount=1000.0, category_id=expense_cat["id"], date="2026-01-15")
        summary = self.txn_svc.get_transactions_summary(start_date="2026-01-01", end_date="2026-01-31")
        self.assertEqual(summary["total_income"], 5000.0)
        self.assertEqual(summary["total_expense"], 1000.0)
        self.assertEqual(summary["net"], 4000.0)

    def test_category_summary(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 0)
        cat1 = self.db.query_one("SELECT id FROM categories WHERE name = '餐饮'")
        cat2 = self.db.query_one("SELECT id FROM categories WHERE name = '交通'")
        self.txn_svc.create_transaction(
            account_id=acc.id, transaction_type="expense",
            amount=300.0, category_id=cat1["id"], date="2026-01-15")
        self.txn_svc.create_transaction(
            account_id=acc.id, transaction_type="expense",
            amount=200.0, category_id=cat2["id"], date="2026-01-15")
        result = self.txn_svc.get_category_summary(start_date="2026-01-01", end_date="2026-01-31")
        self.assertEqual(len(result), 2)


class TestBudgetService(TestBase):
    def test_create_budget(self):
        cat = self.db.query_one("SELECT id FROM categories WHERE name = '餐饮'")
        budget_id = self.budget_svc.create_budget(
            category_id=cat["id"],
            period="monthly",
            amount=2500.0,
            start_date="2026-01-01",
            end_date="2026-01-31",
        )
        self.assertIsNotNone(budget_id)

    def test_budget_progress(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 0)
        cat = self.db.query_one("SELECT id FROM categories WHERE name = '餐饮'")
        budget_id = self.budget_svc.create_budget(
            category_id=cat["id"],
            period="monthly",
            amount=2500.0,
            start_date="2026-01-01",
            end_date="2026-01-31",
        )
        self.txn_svc.create_transaction(
            account_id=acc.id, transaction_type="expense",
            amount=1000.0, category_id=cat["id"], date="2026-01-15")
        progress = self.budget_svc.get_budget_progress(budget_id)
        self.assertEqual(progress["spent"], 1000.0)
        self.assertEqual(progress["budget_amount"], 2500.0)
        self.assertEqual(progress["percentage"], 0.4)
        self.assertEqual(progress["status"], "normal")

    def test_budget_alert_warning(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 0)
        cat = self.db.query_one("SELECT id FROM categories WHERE name = '餐饮'")
        budget_id = self.budget_svc.create_budget(
            category_id=cat["id"],
            period="monthly",
            amount=1000.0,
            start_date="2026-01-01",
            end_date="2026-01-31",
        )
        self.txn_svc.create_transaction(
            account_id=acc.id, transaction_type="expense",
            amount=850.0, category_id=cat["id"], date="2026-01-15")
        alerts = self.budget_svc.check_budget_alerts()
        self.assertEqual(alerts[0]["alert_type"], "warning")

    def test_budget_alert_exceeded(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 0)
        cat = self.db.query_one("SELECT id FROM categories WHERE name = '餐饮'")
        budget_id = self.budget_svc.create_budget(
            category_id=cat["id"],
            period="monthly",
            amount=1000.0,
            start_date="2026-01-01",
            end_date="2026-01-31",
        )
        self.txn_svc.create_transaction(
            account_id=acc.id, transaction_type="expense",
            amount=1200.0, category_id=cat["id"], date="2026-01-15")
        alerts = self.budget_svc.check_budget_alerts()
        self.assertEqual(alerts[0]["alert_type"], "exceeded")

    def test_budget_adjustment(self):
        cat = self.db.query_one("SELECT id FROM categories WHERE name = '餐饮'")
        budget_id = self.budget_svc.create_budget(
            category_id=cat["id"],
            period="monthly",
            amount=2000.0,
            start_date="2026-01-01",
            end_date="2026-01-31",
        )
        self.budget_svc.update_budget(budget_id, amount=3000.0, reason="Increased budget")
        adjustments = self.budget_svc.get_budget_adjustments(budget_id)
        self.assertEqual(len(adjustments), 1)
        self.assertEqual(adjustments[0].old_amount, 2000.0)
        self.assertEqual(adjustments[0].new_amount, 3000.0)

    def test_budget_comparison(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 0)
        cat = self.db.query_one("SELECT id FROM categories WHERE name = '餐饮'")
        self.txn_svc.create_transaction(
            account_id=acc.id, transaction_type="expense",
            amount=500.0, category_id=cat["id"], date="2026-01-15")
        self.txn_svc.create_transaction(
            account_id=acc.id, transaction_type="expense",
            amount=800.0, category_id=cat["id"], date="2026-02-15")
        result = self.budget_svc.get_budget_comparison(
            category_id=cat["id"],
            period1_start="2026-01-01", period1_end="2026-01-31",
            period2_start="2026-02-01", period2_end="2026-02-28",
        )
        self.assertEqual(result["period1_spent"], 500.0)
        self.assertEqual(result["period2_spent"], 800.0)
        self.assertEqual(result["difference"], 300.0)

    def test_delete_budget(self):
        cat = self.db.query_one("SELECT id FROM categories WHERE name = '餐饮'")
        budget_id = self.budget_svc.create_budget(
            category_id=cat["id"],
            period="monthly",
            amount=2500.0,
            start_date="2026-01-01",
            end_date="2026-01-31",
        )
        result = self.budget_svc.delete_budget(budget_id)
        self.assertTrue(result)


class TestVisualizationService(TestBase):
    def test_monthly_trend(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 0)
        cat = self.db.query_one("SELECT id FROM categories WHERE name = '餐饮'")
        for month in range(1, 4):
            self.txn_svc.create_transaction(
                account_id=acc.id, transaction_type="expense",
                amount=100.0 * month, category_id=cat["id"],
                date=f"2026-{month:02d}-15")
        trend = self.viz_svc.get_monthly_trend(transaction_type="expense")
        self.assertGreater(len(trend), 0)

    def test_category_pie(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 0)
        cat1 = self.db.query_one("SELECT id FROM categories WHERE name = '餐饮'")
        cat2 = self.db.query_one("SELECT id FROM categories WHERE name = '交通'")
        self.txn_svc.create_transaction(
            account_id=acc.id, transaction_type="expense",
            amount=300.0, category_id=cat1["id"], date="2026-01-15")
        self.txn_svc.create_transaction(
            account_id=acc.id, transaction_type="expense",
            amount=200.0, category_id=cat2["id"], date="2026-01-15")
        pie = self.viz_svc.get_category_pie(transaction_type="expense")
        self.assertEqual(len(pie), 2)
        total = sum(p["amount"] for p in pie)
        self.assertEqual(total, 500.0)

    def test_monthly_category_comparison(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 0)
        cat = self.db.query_one("SELECT id FROM categories WHERE name = '餐饮'")
        for month in range(1, 4):
            self.txn_svc.create_transaction(
                account_id=acc.id, transaction_type="expense",
                amount=100.0 * month, category_id=cat["id"],
                date=f"2026-{month:02d}-15")
        comparison = self.viz_svc.get_monthly_category_comparison(category_id=cat["id"], months=3)
        self.assertEqual(len(comparison), 3)


class TestCurrencyService(TestBase):
    def test_get_exchange_rate(self):
        rate = self.currency_svc.get_exchange_rate("USD", "CNY", use_cache=False)
        self.assertIsInstance(rate, float)
        self.assertGreater(rate, 0)

    def test_convert_currency(self):
        amount = self.currency_svc.convert_currency(100, "USD", "CNY")
        self.assertGreater(amount, 0)

    def test_same_currency(self):
        rate = self.currency_svc.get_exchange_rate("CNY", "CNY")
        self.assertEqual(rate, 1.0)

    def test_list_supported_currencies(self):
        currencies = self.currency_svc.list_supported_currencies()
        self.assertIn("CNY", currencies)
        self.assertIn("USD", currencies)


class TestValidationService(TestBase):
    def test_validate_balances_valid(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 1000.0)
        income_cat = self.db.query_one("SELECT id FROM categories WHERE name = '工资'")
        expense_cat = self.db.query_one("SELECT id FROM categories WHERE name = '餐饮'")
        self.txn_svc.create_transaction(
            account_id=acc.id, transaction_type="income",
            amount=5000.0, category_id=income_cat["id"],
            date="2026-01-15")
        self.txn_svc.create_transaction(
            account_id=acc.id, transaction_type="expense",
            amount=1000.0, category_id=expense_cat["id"],
            date="2026-01-15")
        result = self.val_svc.validate_balances()
        self.assertTrue(result["is_valid"])
        self.assertAlmostEqual(result["discrepancy"], 0, places=2)

    def test_validate_category_sums(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 0)
        cat = self.db.query_one("SELECT id FROM categories WHERE name = '餐饮'")
        self.txn_svc.create_transaction(
            account_id=acc.id, transaction_type="expense",
            amount=500.0, category_id=cat["id"],
            date="2026-01-15")
        result = self.val_svc.validate_category_sums(
            start_date="2026-01-01", end_date="2026-01-31")
        self.assertTrue(result["is_valid"])

    def test_run_all_validations(self):
        result = self.val_svc.run_all_validations()
        self.assertIn("balance_validation", result)
        self.assertIn("category_validation", result)
        self.assertIn("mismatched_transactions", result)


class TestRecurringService(TestBase):
    def test_create_bill(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 10000.0)
        cat = self.db.query_one("SELECT id FROM categories WHERE name = '住房'")
        bill_id = self.recur_svc.create_bill(
            name="Monthly Rent",
            account_id=acc.id,
            category_id=cat["id"],
            amount=3000.0,
            frequency="monthly",
            next_date=(date.today() + timedelta(days=5)).strftime("%Y-%m-%d"),
        )
        self.assertIsNotNone(bill_id)

    def test_check_due_bills(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 10000.0)
        cat = self.db.query_one("SELECT id FROM categories WHERE name = '住房'")
        self.recur_svc.create_bill(
            name="Test Bill",
            account_id=acc.id,
            category_id=cat["id"],
            amount=100.0,
            frequency="monthly",
            next_date=(date.today() + timedelta(days=3)).strftime("%Y-%m-%d"),
        )
        due = self.recur_svc.check_due_bills()
        self.assertGreater(len(due), 0)

    def test_generate_transaction(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 10000.0)
        cat = self.db.query_one("SELECT id FROM categories WHERE name = '住房'")
        bill_id = self.recur_svc.create_bill(
            name="Test",
            account_id=acc.id,
            category_id=cat["id"],
            amount=500.0,
            frequency="monthly",
            next_date=date.today().strftime("%Y-%m-%d"),
        )
        txn_id = self.recur_svc.generate_transaction(bill_id)
        self.assertIsNotNone(txn_id)
        bal = self.acc_svc.get_account_balance(acc.id)
        self.assertEqual(bal, 9500.0)

    def test_process_due_bills(self):
        acc = self.acc_svc.create_account("Test", "cash", "CNY", 10000.0)
        cat = self.db.query_one("SELECT id FROM categories WHERE name = '住房'")
        self.recur_svc.create_bill(
            name="Due Bill",
            account_id=acc.id,
            category_id=cat["id"],
            amount=200.0,
            frequency="monthly",
            next_date=date.today().strftime("%Y-%m-%d"),
        )
        ids = self.recur_svc.process_due_bills()
        self.assertEqual(len(ids), 1)


if __name__ == "__main__":
    unittest.main()
