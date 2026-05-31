import argparse
import sys
import io
from datetime import datetime, date, timedelta
from budget_tracker import initialize_system
from budget_tracker.database import get_db
from budget_tracker.services.account import AccountService
from budget_tracker.services.category import CategoryService
from budget_tracker.services.transaction import TransactionService
from budget_tracker.services.budget import BudgetService
from budget_tracker.services.import_export import ImportExportService
from budget_tracker.services.backup import BackupService
from budget_tracker.services.validation import ValidationService
from budget_tracker.services.recurring import RecurringService

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


def _safe_str(val):
    try:
        return str(val)
    except UnicodeEncodeError:
        return str(val).encode("ascii", errors="replace").decode("ascii")


def _print_table(headers, rows):
    if not rows:
        print("No data.")
        return
    col_widths = [len(_safe_str(h)) for h in headers]
    for row in rows:
        for i, val in enumerate(row):
            col_widths[i] = max(col_widths[i], len(_safe_str(val)))
    format_str = "  ".join(f"{{:<{w}}}" for w in col_widths)
    print(format_str.format(*headers))
    print("  ".join("-" * w for w in col_widths))
    for row in rows:
        safe_row = [_safe_str(v) for v in row]
        print(format_str.format(*safe_row))


def cmd_account(args, services):
    db, acc_svc, cat_svc, txn_svc, budget_svc, ie_svc, backup_svc, val_svc, recur_svc = services
    if args.action == "list":
        accounts = acc_svc.list_accounts()
        rows = [[a.id, a.name, a.account_type, a.currency, f"{a.balance:,.2f}", "Active" if a.is_active else "Inactive"] for a in accounts]
        _print_table(["ID", "Name", "Type", "Currency", "Balance", "Status"], rows)
    elif args.action == "add":
        acc = acc_svc.create_account(args.name, args.type, args.currency, args.balance)
        print(f"Account created: #{acc.id} {acc.name}")
    elif args.action == "delete":
        acc_svc.delete_account(args.id)
        print(f"Account #{args.id} deleted.")


def cmd_category(args, services):
    db, acc_svc, cat_svc, txn_svc, budget_svc, ie_svc, backup_svc, val_svc, recur_svc = services
    if args.action == "list":
        cats = cat_svc.list_categories(args.type)
        rows = [[c.id, c.name, c.category_type] for c in cats]
        _print_table(["ID", "Name", "Type"], rows)
    elif args.action == "add":
        cat = cat_svc.create_category(args.name, args.type, ",".join(args.keywords or []))
        print(f"Category created: #{cat.id} {cat.name}")


def cmd_add(args, services):
    db, acc_svc, cat_svc, txn_svc, budget_svc, ie_svc, backup_svc, val_svc, recur_svc = services
    txn_type = args.transaction_type
    amount = args.amount
    category_name = args.category
    category_id = None
    if category_name:
        cat_row = db.query_one("SELECT id FROM categories WHERE name = ? AND category_type = ?", (category_name, txn_type))
        if not cat_row and txn_type == "expense":
            cat_row = db.query_one("SELECT id FROM categories WHERE name = ?", (category_name,))
        if cat_row:
            category_id = cat_row["id"]
    description = args.description or ""
    date_str = args.date or date.today().strftime("%Y-%m-%d")
    notes = args.notes or ""
    tags = args.tags or ""
    account_id = args.account or 1
    txn_id = txn_svc.create_transaction(
        account_id=account_id,
        transaction_type=txn_type,
        amount=amount,
        category_id=category_id,
        description=description,
        notes=notes,
        tags=tags,
        date=date_str,
    )
    print(f"Transaction added: #{txn_id} {txn_type} {amount} {category_name}")


def cmd_transfer(args, services):
    db, acc_svc, cat_svc, txn_svc, budget_svc, ie_svc, backup_svc, val_svc, recur_svc = services
    from_id = args.from_account
    to_id = args.to_account
    amount = args.amount
    from_txn, to_txn = txn_svc.create_transfer(from_id, to_id, amount, description=args.description or "")
    print(f"Transfer complete: #{from_txn} -> #{to_txn}, amount {amount}")


def cmd_query(args, services):
    db, acc_svc, cat_svc, txn_svc, budget_svc, ie_svc, backup_svc, val_svc, recur_svc = services
    today = date.today()
    start_date = None
    end_date = None
    if args.period == "today":
        start_date = end_date = today.strftime("%Y-%m-%d")
    elif args.period == "week":
        start_date = (today - timedelta(days=today.weekday())).strftime("%Y-%m-%d")
        end_date = today.strftime("%Y-%m-%d")
    elif args.period == "month":
        start_date = today.replace(day=1).strftime("%Y-%m-%d")
        end_date = today.strftime("%Y-%m-%d")
    elif args.period == "year":
        start_date = today.replace(month=1, day=1).strftime("%Y-%m-%d")
        end_date = today.strftime("%Y-%m-%d")
    elif args.period == "custom":
        start_date = args.start_date
        end_date = args.end_date

    txns = txn_svc.list_transactions(
        account_id=args.account,
        category_id=args.category,
        transaction_type=args.type,
        start_date=start_date,
        end_date=end_date,
        limit=args.limit or 100,
    )
    rows = []
    for t in txns:
        cat_name = ""
        if t.category_id:
            cat = cat_svc.get_category(t.category_id)
            if cat:
                cat_name = cat.name
        acc_name = ""
        acc_row = db.query_one("SELECT name FROM accounts WHERE id = ?", (t.account_id,))
        if acc_row:
            acc_name = acc_row["name"]
        amount_str = f"+{t.amount:,.2f}" if t.transaction_type == "income" else f"-{t.amount:,.2f}"
        rows.append([t.id, t.date, t.transaction_type, amount_str, cat_name, acc_name, t.description])
    _print_table(["ID", "Date", "Type", "Amount", "Category", "Account", "Description"], rows)

    summary = txn_svc.get_transactions_summary(start_date=start_date, end_date=end_date)
    print(f"\nSummary: Income {summary['total_income']:,.2f}, Expense {summary['total_expense']:,.2f}, Net {summary['net']:,.2f}")


def cmd_budget(args, services):
    db, acc_svc, cat_svc, txn_svc, budget_svc, ie_svc, backup_svc, val_svc, recur_svc = services
    if args.action == "list":
        progress = budget_svc.get_all_budget_progress()
        rows = []
        for p in progress:
            status_icon = "[OK]" if p["status"] == "normal" else "[!!]" if p["status"] == "warning" else "[XX]"
            rows.append([
                p["budget_id"], p["category_name"], f"{p['budget_amount']:,.2f}",
                f"{p['spent']:,.2f}", f"{p['remaining']:,.2f}", f"{p['percentage']*100:.1f}%", status_icon
            ])
        _print_table(["ID", "Category", "Budget", "Spent", "Remaining", "% Used", "Status"], rows)
    elif args.action == "set":
        cat_row = db.query_one("SELECT id FROM categories WHERE name = ?", (args.category,))
        if not cat_row:
            print(f"Category '{args.category}' not found.")
            return
        today = date.today()
        if args.period == "monthly":
            start = today.replace(day=1)
            end = (start.replace(month=start.month % 12 + 1, day=1) - timedelta(days=1)) if start.month != 12 else date(start.year + 1, 1, 1) - timedelta(days=1)
        else:
            start = today.replace(month=1, day=1)
            end = today.replace(month=12, day=31)
        budget_id = budget_svc.create_budget(
            category_id=cat_row["id"],
            period=args.period,
            amount=args.amount,
            start_date=start.strftime("%Y-%m-%d"),
            end_date=end.strftime("%Y-%m-%d"),
        )
        print(f"Budget set: #{budget_id} {args.category} {args.amount} {args.period}")
    elif args.action == "alerts":
        alerts = budget_svc.check_budget_alerts()
        if not alerts:
            print("No budget alerts.")
        else:
            for a in alerts:
                alert_type = "EXCEEDED" if a["alert_type"] == "exceeded" else "WARNING"
                print(f"[{alert_type}] {a['category_name']}: spent {a['spent']:,.2f} / {a['budget_amount']:,.2f} ({a['percentage']*100:.1f}%)")


def cmd_report(args, services):
    db, acc_svc, cat_svc, txn_svc, budget_svc, ie_svc, backup_svc, val_svc, recur_svc = services
    if args.type == "summary":
        today = date.today()
        start = today.replace(day=1).strftime("%Y-%m-%d")
        end = today.strftime("%Y-%m-%d")
        summary = txn_svc.get_transactions_summary(start_date=start, end_date=end)
        print(f"\n=== Monthly Summary ({start} to {end}) ===")
        print(f"Total Income:  {summary['total_income']:>12,.2f}")
        print(f"Total Expense: {summary['total_expense']:>12,.2f}")
        print(f"Net:           {summary['net']:>12,.2f}")
        print(f"Transactions:  {summary['count']:>12}")
    elif args.type == "category":
        today = date.today()
        start = today.replace(day=1).strftime("%Y-%m-%d")
        end = today.strftime("%Y-%m-%d")
        cat_summary = txn_svc.get_category_summary(start_date=start, end_date=end, transaction_type="expense")
        print(f"\n=== Expense by Category ({start} to {end}) ===")
        rows = [[c["category_name"] or "Uncategorized", f"{c['total_amount']:,.2f}", f"{c['percentage']:.1f}%"] for c in cat_summary]
        _print_table(["Category", "Amount", "%"], rows)
    elif args.type == "trend":
        from budget_tracker.services.visualization import VisualizationService
        viz_svc = VisualizationService(db)
        trend = viz_svc.get_monthly_trend(transaction_type="expense")
        print("\n=== Monthly Expense Trend ===")
        for t in trend:
            bar_len = int(t["amount"] / max(1, max(tr["amount"] for tr in trend)) * 30)
            print(f"{t['month']}: {'#' * bar_len} {t['amount']:,.2f}")


def cmd_export(args, services):
    db, acc_svc, cat_svc, txn_svc, budget_svc, ie_svc, backup_svc, val_svc, recur_svc = services
    path = ie_svc.export_csv(account_id=args.account, start_date=args.start_date, end_date=args.end_date, file_path=args.output)
    print(f"Exported to {path}")


def cmd_import(args, services):
    db, acc_svc, cat_svc, txn_svc, budget_svc, ie_svc, backup_svc, val_svc, recur_svc = services
    result = ie_svc.import_csv(args.file, account_id=args.account, delimiter=args.delimiter, encoding=args.encoding)
    print(f"Import complete: {result['imported']} imported, {result['skipped']} skipped, {len(result['errors'])} errors")


def cmd_backup(args, services):
    db, acc_svc, cat_svc, txn_svc, budget_svc, ie_svc, backup_svc, val_svc, recur_svc = services
    if args.action == "create":
        path = backup_svc.create_backup()
        print(f"Backup created: {path}")
    elif args.action == "list":
        backups = backup_svc.list_backups()
        rows = [[b["filename"], b["created"], f"{b['size']:,} bytes"] for b in backups]
        _print_table(["Filename", "Created", "Size"], rows)


def cmd_validate(args, services):
    db, acc_svc, cat_svc, txn_svc, budget_svc, ie_svc, backup_svc, val_svc, recur_svc = services
    results = val_svc.run_all_validations()
    print("\n=== Data Validation Results ===")
    balance = results["balance_validation"]
    print(f"\nBalance Validation: {'PASS' if balance['is_valid'] else 'FAIL'}")
    if not balance["is_valid"]:
        print(f"  Discrepancy: {balance['discrepancy']:.2f}")
        print(f"  Details: {balance['details']}")
    cat_val = results["category_validation"]
    print(f"\nCategory Sum Validation: {'PASS' if cat_val['is_valid'] else 'FAIL'}")
    issues = results["mismatched_transactions"]
    print(f"\nTransaction Issues: {len(issues)} found")
    for issue in issues[:10]:
        print(f"  #{issue['transaction_id']}: {issue['issue']}")


def cmd_recurring(args, services):
    db, acc_svc, cat_svc, txn_svc, budget_svc, ie_svc, backup_svc, val_svc, recur_svc = services
    if args.action == "list":
        bills = recur_svc.list_bills()
        rows = [[b.id, b.name, f"{b.amount:,.2f}", b.frequency, b.next_date] for b in bills]
        _print_table(["ID", "Name", "Amount", "Frequency", "Next Date"], rows)
    elif args.action == "add":
        cat_id = None
        if args.category:
            cat_row = db.query_one("SELECT id FROM categories WHERE name = ?", (args.category,))
            if cat_row:
                cat_id = cat_row["id"]
        bill_id = recur_svc.create_bill(
            name=args.name,
            account_id=args.account,
            category_id=cat_id,
            amount=args.amount,
            frequency=args.frequency,
            next_date=args.next_date,
            end_date=args.end_date,
            description=args.description or "",
        )
        print(f"Recurring bill created: #{bill_id} {args.name}")
    elif args.action == "process":
        ids = recur_svc.process_due_bills()
        print(f"Processed {len(ids)} due bills: {ids}")
    elif args.action == "check":
        due = recur_svc.check_due_bills()
        print(f"\n=== Upcoming Bills ===")
        for d in due:
            bill = d["bill"]
            print(f"  {bill.name} ({bill.amount:,.2f}) due in {d['days_until_due']} day(s) on {bill.next_date}")


def cmd_web(args, services):
    print("Starting web interface on http://127.0.0.1:5000 ...")
    from budget_tracker.web.app import create_app
    app = create_app(debug=args.debug)
    app.run(host=args.host, port=args.port, debug=args.debug)


def main():
    parser = argparse.ArgumentParser(prog="budget", description="Python Budget Tracker")
    subparsers = parser.add_subparsers(dest="command", required=True)

    p_account = subparsers.add_parser("account", help="Manage accounts")
    p_account.add_argument("action", choices=["list", "add", "delete"])
    p_account.add_argument("--name", help="Account name")
    p_account.add_argument("--type", default="cash", help="Account type")
    p_account.add_argument("--currency", default="CNY", help="Currency")
    p_account.add_argument("--balance", type=float, default=0.0, help="Initial balance")
    p_account.add_argument("--id", type=int, help="Account ID for delete")

    p_category = subparsers.add_parser("category", help="Manage categories")
    p_category.add_argument("action", choices=["list", "add"])
    p_category.add_argument("--name", help="Category name")
    p_category.add_argument("--type", choices=["income", "expense"], default="expense", help="Category type")
    p_category.add_argument("--keywords", nargs="*", help="Auto-classify keywords")

    p_add = subparsers.add_parser("add", help="Add a transaction")
    p_add.add_argument("transaction_type", choices=["income", "expense"], help="Transaction type")
    p_add.add_argument("amount", type=float, help="Amount")
    p_add.add_argument("category", help="Category name")
    p_add.add_argument("--description", help="Description")
    p_add.add_argument("--notes", help="Notes")
    p_add.add_argument("--tags", help="Tags (comma-separated)")
    p_add.add_argument("--date", help="Date (YYYY-MM-DD)")
    p_add.add_argument("--account", type=int, help="Account ID")

    p_transfer = subparsers.add_parser("transfer", help="Transfer between accounts")
    p_transfer.add_argument("from_account", type=int, help="Source account ID")
    p_transfer.add_argument("to_account", type=int, help="Destination account ID")
    p_transfer.add_argument("amount", type=float, help="Amount")
    p_transfer.add_argument("--description", help="Description")

    p_query = subparsers.add_parser("query", help="Query transactions")
    p_query.add_argument("period", choices=["today", "week", "month", "year", "custom"], default="month", nargs="?")
    p_query.add_argument("--start-date", help="Start date (YYYY-MM-DD) for custom")
    p_query.add_argument("--end-date", help="End date (YYYY-MM-DD) for custom")
    p_query.add_argument("--account", type=int, help="Account ID filter")
    p_query.add_argument("--category", type=int, help="Category ID filter")
    p_query.add_argument("--type", choices=["income", "expense", "transfer"], help="Transaction type filter")
    p_query.add_argument("--limit", type=int, help="Max records")

    p_budget = subparsers.add_parser("budget", help="Budget management")
    p_budget.add_argument("action", choices=["list", "set", "alerts"])
    p_budget.add_argument("--category", help="Category name")
    p_budget.add_argument("--amount", type=float, help="Budget amount")
    p_budget.add_argument("--period", choices=["monthly", "yearly"], default="monthly")

    p_report = subparsers.add_parser("report", help="Generate reports")
    p_report.add_argument("type", choices=["summary", "category", "trend"])

    p_export = subparsers.add_parser("export", help="Export transactions")
    p_export.add_argument("--output", default="export.csv", help="Output file path")
    p_export.add_argument("--account", type=int, help="Account ID filter")
    p_export.add_argument("--start-date", help="Start date")
    p_export.add_argument("--end-date", help="End date")

    p_import = subparsers.add_parser("import", help="Import transactions from CSV")
    p_import.add_argument("file", help="CSV file path")
    p_import.add_argument("--account", type=int, default=1, help="Account ID")
    p_import.add_argument("--delimiter", default=",", help="CSV delimiter")
    p_import.add_argument("--encoding", default="utf-8", help="File encoding")

    p_backup = subparsers.add_parser("backup", help="Backup management")
    p_backup.add_argument("action", choices=["create", "list"])

    p_validate = subparsers.add_parser("validate", help="Validate data integrity")

    p_recurring = subparsers.add_parser("recurring", help="Recurring bills management")
    p_recurring.add_argument("action", choices=["list", "add", "process", "check"])
    p_recurring.add_argument("--name", help="Bill name")
    p_recurring.add_argument("--account", type=int, default=1, help="Account ID")
    p_recurring.add_argument("--category", help="Category name")
    p_recurring.add_argument("--amount", type=float, help="Amount")
    p_recurring.add_argument("--frequency", choices=["daily", "weekly", "monthly", "yearly"], default="monthly")
    p_recurring.add_argument("--next-date", help="Next due date (YYYY-MM-DD)")
    p_recurring.add_argument("--end-date", help="End date")
    p_recurring.add_argument("--description", help="Description")

    p_web = subparsers.add_parser("web", help="Start web interface")
    p_web.add_argument("--host", default="127.0.0.1", help="Host to bind")
    p_web.add_argument("--port", type=int, default=5000, help="Port to bind")
    p_web.add_argument("--debug", action="store_true", help="Debug mode")

    args = parser.parse_args()

    db = initialize_system()

    acc_svc = AccountService(db)
    cat_svc = CategoryService(db)
    txn_svc = TransactionService(db)
    budget_svc = BudgetService(db)
    ie_svc = ImportExportService(db)
    backup_svc = BackupService(db)
    val_svc = ValidationService(db)
    recur_svc = RecurringService(db)

    services = (db, acc_svc, cat_svc, txn_svc, budget_svc, ie_svc, backup_svc, val_svc, recur_svc)

    handlers = {
        "account": cmd_account,
        "category": cmd_category,
        "add": cmd_add,
        "transfer": cmd_transfer,
        "query": cmd_query,
        "budget": cmd_budget,
        "report": cmd_report,
        "export": cmd_export,
        "import": cmd_import,
        "backup": cmd_backup,
        "validate": cmd_validate,
        "recurring": cmd_recurring,
        "web": cmd_web,
    }

    handler = handlers.get(args.command)
    if handler:
        handler(args, services)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
