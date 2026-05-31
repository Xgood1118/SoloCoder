from budget_tracker.database import get_db, reset_db
from budget_tracker.services.account import AccountService
from budget_tracker.services.category import CategoryService
from budget_tracker.services.transaction import TransactionService
from budget_tracker.services.budget import BudgetService
from budget_tracker.services.import_export import ImportExportService
from budget_tracker.services.currency import CurrencyService
from budget_tracker.services.visualization import VisualizationService
from budget_tracker.services.validation import ValidationService
from budget_tracker.services.backup import BackupService
from budget_tracker.services.recurring import RecurringService
from budget_tracker.config import DEFAULT_ACCOUNTS


def initialize_system(db=None):
    db = db or get_db()
    category_service = CategoryService(db)
    category_service.init_default_categories()
    account_service = AccountService(db)
    accounts = account_service.list_accounts(active_only=False)
    if len(accounts) == 0:
        for acc in DEFAULT_ACCOUNTS:
            account_service.create_account(
                name=acc["name"],
                account_type=acc["account_type"],
                currency=acc["currency"],
                initial_balance=0.0,
            )
    return db
