from datetime import datetime
from budget_tracker.models import Category
from budget_tracker.database import Database
from budget_tracker.config import DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, CATEGORY_KEYWORDS


class CategoryService:
    def __init__(self, db: Database):
        self.db = db

    def create_category(self, name, category_type="expense", keywords=""):
        now = datetime.now().isoformat()
        category_id = self.db.execute(
            "INSERT INTO categories (name, category_type, keywords, created_at) VALUES (?, ?, ?, ?)",
            (name, category_type, keywords, now),
        )
        return self.get_category(category_id)

    def get_category(self, category_id):
        row = self.db.query_one("SELECT * FROM categories WHERE id = ?", (category_id,))
        if row is None:
            return None
        return Category(**row)

    def list_categories(self, category_type=None):
        if category_type is not None:
            rows = self.db.query_all("SELECT * FROM categories WHERE category_type = ? ORDER BY id", (category_type,))
        else:
            rows = self.db.query_all("SELECT * FROM categories ORDER BY id")
        return [Category(**row) for row in rows]

    def update_category(self, category_id, **kwargs):
        category = self.get_category(category_id)
        if category is None:
            return None
        sets = ", ".join(f"{k} = ?" for k in kwargs)
        values = list(kwargs.values()) + [category_id]
        self.db.execute(f"UPDATE categories SET {sets} WHERE id = ?", values)
        return self.get_category(category_id)

    def delete_category(self, category_id):
        self.db.execute("DELETE FROM categories WHERE id = ?", (category_id,))

    def init_default_categories(self):
        now = datetime.now().isoformat()
        for name in DEFAULT_EXPENSE_CATEGORIES:
            existing = self.db.query_one("SELECT id FROM categories WHERE name = ? AND category_type = 'expense'", (name,))
            if existing is None:
                keywords = ",".join(CATEGORY_KEYWORDS.get(name, []))
                self.db.execute(
                    "INSERT INTO categories (name, category_type, is_default, keywords, created_at) VALUES (?, 'expense', 1, ?, ?)",
                    (name, keywords, now),
                )
        for name in DEFAULT_INCOME_CATEGORIES:
            existing = self.db.query_one("SELECT id FROM categories WHERE name = ? AND category_type = 'income'", (name,))
            if existing is None:
                self.db.execute(
                    "INSERT INTO categories (name, category_type, is_default, keywords, created_at) VALUES (?, 'income', 1, '', ?)",
                    (name, now),
                )

    def auto_classify(self, description):
        for category_name, keywords in CATEGORY_KEYWORDS.items():
            for keyword in keywords:
                if keyword in description:
                    row = self.db.query_one("SELECT id FROM categories WHERE name = ?", (category_name,))
                    if row:
                        return row["id"]
        return None
