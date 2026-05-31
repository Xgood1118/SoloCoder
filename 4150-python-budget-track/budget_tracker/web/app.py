import os
from flask import Flask, jsonify, request, render_template
from datetime import datetime, timedelta
from budget_tracker.database import get_db
from budget_tracker.services.account import AccountService
from budget_tracker.services.category import CategoryService
from budget_tracker.services.transaction import TransactionService
from budget_tracker.services.budget import BudgetService
from budget_tracker.services.visualization import VisualizationService


def create_app(debug=False):
    template_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates')
    app = Flask(__name__, template_folder=template_dir)
    app.debug = debug

    db = get_db()
    account_service = AccountService(db)
    category_service = CategoryService(db)
    transaction_service = TransactionService(db)
    budget_service = BudgetService(db)
    visualization_service = VisualizationService(db)

    @app.before_request
    def before_request():
        request.account_service = account_service
        request.category_service = category_service
        request.transaction_service = transaction_service
        request.budget_service = budget_service
        request.visualization_service = visualization_service

    @app.route('/')
    def dashboard():
        summary = transaction_service.get_transactions_summary()
        recent_transactions = transaction_service.list_transactions(limit=10)
        accounts = account_service.list_accounts()
        total_accounts = len(accounts)
        budget_alerts = budget_service.check_budget_alerts()
        category_map = {c.id: c.name for c in category_service.list_categories()}
        account_map = {a.id: a.name for a in accounts}
        for txn in recent_transactions:
            txn.category_name = category_map.get(txn.category_id, 'Uncategorized')
            txn.account_name = account_map.get(txn.account_id, 'Unknown')
        return render_template('dashboard.html',
                               summary=summary,
                               recent_transactions=recent_transactions,
                               budget_alerts=budget_alerts,
                               total_accounts=total_accounts)

    @app.route('/transactions')
    def transactions():
        account_id = request.args.get('account_id', type=int)
        category_id = request.args.get('category_id', type=int)
        transaction_type = request.args.get('transaction_type')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        txns = transaction_service.list_transactions(
            account_id=account_id,
            category_id=category_id,
            transaction_type=transaction_type,
            start_date=start_date,
            end_date=end_date,
            limit=200
        )
        category_map = {c.id: c.name for c in category_service.list_categories()}
        account_map = {a.id: a.name for a in account_service.list_accounts()}
        for txn in txns:
            txn.category_name = category_map.get(txn.category_id, 'Uncategorized')
            txn.account_name = account_map.get(txn.account_id, 'Unknown')
        accounts = account_service.list_accounts()
        categories = category_service.list_categories()
        return render_template('transactions.html',
                               transactions=txns,
                               accounts=accounts,
                               categories=categories,
                               filters=request.args)

    @app.route('/accounts')
    def accounts():
        accounts_list = account_service.list_accounts()
        return render_template('accounts.html', accounts=accounts_list)

    @app.route('/budgets')
    def budgets():
        budget_progress = budget_service.get_all_budget_progress()
        return render_template('budgets.html', budgets=budget_progress)

    @app.route('/reports')
    def reports():
        return render_template('reports.html')

    @app.route('/api/transactions', methods=['GET'])
    def api_transactions():
        account_id = request.args.get('account_id', type=int)
        category_id = request.args.get('category_id', type=int)
        transaction_type = request.args.get('transaction_type')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        limit = request.args.get('limit', default=100, type=int)
        offset = request.args.get('offset', default=0, type=int)
        txns = transaction_service.list_transactions(
            account_id=account_id,
            category_id=category_id,
            transaction_type=transaction_type,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            offset=offset
        )
        category_map = {c.id: c.name for c in category_service.list_categories()}
        account_map = {a.id: a.name for a in account_service.list_accounts()}
        result = []
        for txn in txns:
            txn_dict = {
                'id': txn.id,
                'account_id': txn.account_id,
                'account_name': account_map.get(txn.account_id, 'Unknown'),
                'category_id': txn.category_id,
                'category_name': category_map.get(txn.category_id, 'Uncategorized'),
                'transaction_type': txn.transaction_type,
                'amount': txn.amount,
                'description': txn.description,
                'notes': txn.notes,
                'tags': txn.tags,
                'date': txn.date,
                'created_at': txn.created_at,
                'updated_at': txn.updated_at
            }
            result.append(txn_dict)
        return jsonify(result)

    @app.route('/api/transactions', methods=['POST'])
    def api_add_transaction():
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        required_fields = ['account_id', 'transaction_type', 'amount']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        try:
            txn_id = transaction_service.create_transaction(
                account_id=data['account_id'],
                transaction_type=data['transaction_type'],
                amount=float(data['amount']),
                category_id=data.get('category_id'),
                description=data.get('description', ''),
                notes=data.get('notes', ''),
                tags=data.get('tags', ''),
                date=data.get('date')
            )
            return jsonify({'success': True, 'id': txn_id}), 201
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/transactions/<int:txn_id>/delete', methods=['POST'])
    def api_delete_transaction(txn_id):
        try:
            success = transaction_service.delete_transaction(txn_id)
            if success:
                return jsonify({'success': True})
            else:
                return jsonify({'error': 'Transaction not found'}), 404
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/summary')
    def api_summary():
        account_id = request.args.get('account_id', type=int)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        summary = transaction_service.get_transactions_summary(
            account_id=account_id,
            start_date=start_date,
            end_date=end_date
        )
        accounts = account_service.list_accounts()
        summary['total_accounts'] = len(accounts)
        summary['total_balance'] = sum(a.balance for a in accounts)
        return jsonify(summary)

    @app.route('/api/monthly-trend')
    def api_monthly_trend():
        transaction_type = request.args.get('transaction_type', default='expense')
        months = request.args.get('months', default=6, type=int)
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=30 * months)).strftime('%Y-%m-%d')
        trend = visualization_service.get_monthly_trend(
            start_date=start_date,
            end_date=end_date,
            transaction_type=transaction_type
        )
        return jsonify(trend)

    @app.route('/api/category-pie')
    def api_category_pie():
        transaction_type = request.args.get('transaction_type', default='expense')
        months = request.args.get('months', default=1, type=int)
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=30 * months)).strftime('%Y-%m-%d')
        pie_data = visualization_service.get_category_pie(
            start_date=start_date,
            end_date=end_date,
            transaction_type=transaction_type
        )
        return jsonify(pie_data)

    @app.route('/api/monthly-category-comparison')
    def api_monthly_category_comparison():
        months = request.args.get('months', default=3, type=int)
        category_summary = transaction_service.get_category_summary(transaction_type='expense')
        top_categories = [c for c in category_summary if c['category_id'] is not None][:3]
        result = []
        for cat in top_categories:
            monthly_data = visualization_service.get_monthly_category_comparison(
                category_id=cat['category_id'],
                months=months
            )
            result.append({
                'category_name': cat['category_name'],
                'category_id': cat['category_id'],
                'data': monthly_data
            })
        return jsonify(result)

    return app


if __name__ == '__main__':
    app = create_app(debug=True)
    app.run(host='0.0.0.0', port=5000)
