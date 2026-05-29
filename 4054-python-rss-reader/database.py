import os
import sqlite3
from datetime import datetime

DB_PATH = os.environ.get("RSS_DB", os.path.join(os.path.dirname(os.path.abspath(__file__)), "rss.db"))

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    site_url TEXT NOT NULL DEFAULT '',
    etag TEXT NOT NULL DEFAULT '',
    last_modified TEXT NOT NULL DEFAULT '',
    update_interval INTEGER NOT NULL DEFAULT 30,
    category TEXT NOT NULL DEFAULT '',
    last_fetched_at TEXT,
    error_count INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id INTEGER NOT NULL,
    guid TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    pub_date TEXT,
    fetched_at TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    is_starred INTEGER NOT NULL DEFAULT 0,
    tags TEXT NOT NULL DEFAULT '',
    read_at TEXT,
    FOREIGN KEY (feed_id) REFERENCES feeds(id)
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_articles_feed_id ON articles(feed_id);
CREATE INDEX IF NOT EXISTS idx_articles_guid ON articles(guid);
CREATE INDEX IF NOT EXISTS idx_articles_is_read ON articles(is_read);
CREATE INDEX IF NOT EXISTS idx_articles_pub_date ON articles(pub_date);
CREATE INDEX IF NOT EXISTS idx_feeds_category ON feeds(category);
"""


def get_connection(db_path=None):
    path = db_path or DB_PATH
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(db_path=None):
    conn = get_connection(db_path)
    try:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
    finally:
        conn.close()


def execute_query(sql, params=None, db_path=None):
    conn = get_connection(db_path)
    try:
        cursor = conn.execute(sql, params or [])
        conn.commit()
        return cursor
    finally:
        conn.close()


def execute_query_returning(sql, params=None, db_path=None):
    conn = get_connection(db_path)
    try:
        cursor = conn.execute(sql, params or [])
        rows = cursor.fetchall()
        return rows
    finally:
        conn.close()


def insert_feed(url, title="", description="", site_url="", category="", update_interval=30, db_path=None):
    url = str(url) if url is not None else ""
    title = str(title) if title is not None else ""
    description = str(description) if description is not None else ""
    site_url = str(site_url) if site_url is not None else ""
    category = str(category) if category is not None else ""
    try:
        update_interval = int(update_interval) if update_interval is not None else 30
    except (ValueError, TypeError):
        update_interval = 30

    conn = get_connection(db_path)
    try:
        cursor = conn.execute(
            """INSERT INTO feeds (url, title, description, site_url, category, update_interval)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (url, title, description, site_url, category, update_interval),
        )
        conn.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()


def get_feed(feed_id, db_path=None):
    rows = execute_query_returning("SELECT * FROM feeds WHERE id = ?", (feed_id,), db_path)
    return dict(rows[0]) if rows else None


def get_feed_by_url(url, db_path=None):
    rows = execute_query_returning("SELECT * FROM feeds WHERE url = ?", (url,), db_path)
    return dict(rows[0]) if rows else None


def get_all_feeds(db_path=None):
    rows = execute_query_returning("SELECT * FROM feeds ORDER BY id", db_path=db_path)
    return [dict(r) for r in rows]


def get_active_feeds(db_path=None):
    rows = execute_query_returning(
        "SELECT * FROM feeds WHERE is_active = 1 ORDER BY id", db_path=db_path
    )
    return [dict(r) for r in rows]


def update_feed(feed_id, **kwargs):
    if not kwargs:
        return
    sets = []
    vals = []
    for k, v in kwargs.items():
        if k in ("title", "description", "site_url", "etag", "last_modified",
                 "update_interval", "category", "last_fetched_at", "error_count", "is_active"):
            sets.append(f"{k} = ?")
            vals.append(v)
    if not sets:
        return
    vals.append(feed_id)
    execute_query(f"UPDATE feeds SET {', '.join(sets)} WHERE id = ?", vals)


def remove_feed(feed_id, db_path=None):
    conn = get_connection(db_path)
    try:
        feed = conn.execute("SELECT * FROM feeds WHERE id = ?", (feed_id,)).fetchone()
        if not feed:
            return False
        conn.execute("DELETE FROM articles WHERE feed_id = ?", (feed_id,))
        conn.execute("DELETE FROM feeds WHERE id = ?", (feed_id,))
        conn.commit()
        return True
    finally:
        conn.close()


def insert_article(feed_id, guid, title="", link="", author="", content="",
                   summary="", pub_date=None, fetched_at=None, db_path=None):
    try:
        feed_id = int(feed_id)
    except (ValueError, TypeError):
        return None
    guid = str(guid) if guid is not None else ""
    title = str(title) if title is not None else ""
    link = str(link) if link is not None else ""
    author = str(author) if author is not None else ""
    content = str(content) if content is not None else ""
    summary = str(summary) if summary is not None else ""
    pub_date = str(pub_date) if pub_date is not None else None
    if fetched_at is None:
        fetched_at = datetime.utcnow().isoformat()
    else:
        fetched_at = str(fetched_at) if fetched_at is not None else None

    conn = get_connection(db_path)
    try:
        try:
            cursor = conn.execute(
                """INSERT INTO articles
                   (feed_id, guid, title, link, author, content, summary, pub_date, fetched_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (feed_id, guid, title, link, author, content, summary, pub_date, fetched_at),
            )
            conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            return None
    finally:
        conn.close()


def get_article(article_id, db_path=None):
    rows = execute_query_returning("SELECT * FROM articles WHERE id = ?", (article_id,), db_path)
    return dict(rows[0]) if rows else None


def get_articles_by_feed(feed_id, limit=20, offset=0, db_path=None):
    rows = execute_query_returning(
        "SELECT * FROM articles WHERE feed_id = ? ORDER BY pub_date DESC LIMIT ? OFFSET ?",
        (feed_id, limit, offset),
        db_path,
    )
    return [dict(r) for r in rows]


def query_articles(feed_id=None, unread=False, favorite=False, tag=None,
                   since=None, limit=20, offset=0, db_path=None):
    conditions = []
    params = []
    if feed_id is not None:
        conditions.append("a.feed_id = ?")
        params.append(feed_id)
    if unread:
        conditions.append("a.is_read = 0")
    if favorite:
        conditions.append("a.is_favorite = 1")
    if tag:
        conditions.append("(a.tags LIKE ? OR a.tags LIKE ? OR a.tags LIKE ? OR a.tags = ?)")
        params.append(f"{tag},%")
        params.append(f"%,{tag},%")
        params.append(f"%,{tag}")
        params.append(tag)
    if since:
        conditions.append("a.pub_date >= ?")
        params.append(since)

    where = " AND ".join(conditions) if conditions else "1=1"
    sql = f"""SELECT a.*, f.title as feed_title FROM articles a
              LEFT JOIN feeds f ON a.feed_id = f.id
              WHERE {where}
              ORDER BY a.pub_date DESC LIMIT ? OFFSET ?"""
    params.extend([limit, offset])
    rows = execute_query_returning(sql, params, db_path)
    return [dict(r) for r in rows]


def mark_article_read(article_id, db_path=None):
    conn = get_connection(db_path)
    try:
        article = conn.execute("SELECT is_read, read_at FROM articles WHERE id = ?", (article_id,)).fetchone()
        if not article:
            return False
        if article["is_read"] and article["read_at"]:
            return True
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE articles SET is_read = 1, read_at = ? WHERE id = ? AND (is_read = 0 OR read_at IS NULL)",
            (now, article_id),
        )
        conn.commit()
        return True
    finally:
        conn.close()


def toggle_favorite(article_id, db_path=None):
    conn = get_connection(db_path)
    try:
        conn.execute(
            "UPDATE articles SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE id = ?",
            (article_id,),
        )
        conn.commit()
        row = conn.execute("SELECT is_favorite FROM articles WHERE id = ?", (article_id,)).fetchone()
        return bool(row["is_favorite"]) if row else None
    finally:
        conn.close()


def set_article_tags(article_id, tags, db_path=None):
    execute_query("UPDATE articles SET tags = ? WHERE id = ?", (tags, article_id), db_path=db_path)


def search_articles(keyword, db_path=None):
    like = f"%{keyword}%"
    rows = execute_query_returning(
        """SELECT a.*, f.title as feed_title FROM articles a
           LEFT JOIN feeds f ON a.feed_id = f.id
           WHERE a.title LIKE ? OR a.summary LIKE ?
           ORDER BY a.pub_date DESC""",
        (like, like),
        db_path,
    )
    return [dict(r) for r in rows]


def get_stats(db_path=None):
    conn = get_connection(db_path)
    try:
        total_feeds = conn.execute("SELECT COUNT(*) as c FROM feeds").fetchone()["c"]
        total_articles = conn.execute("SELECT COUNT(*) as c FROM articles").fetchone()["c"]
        read_count = conn.execute("SELECT COUNT(*) as c FROM articles WHERE is_read = 1").fetchone()["c"]
        today = datetime.utcnow().strftime("%Y-%m-%d")
        today_new = conn.execute(
            "SELECT COUNT(*) as c FROM articles WHERE DATE(pub_date) = ?", (today,)
        ).fetchone()["c"]
        active_feeds = conn.execute("SELECT COUNT(*) as c FROM feeds WHERE is_active = 1").fetchone()["c"]
        category_stats = conn.execute(
            """SELECT COALESCE(f.category, '(uncategorized)') as category, COUNT(a.id) as count
               FROM feeds f LEFT JOIN articles a ON f.id = a.feed_id
               GROUP BY f.category ORDER BY count DESC"""
        ).fetchall()
        read_ratio = (read_count / total_articles * 100) if total_articles > 0 else 0
        return {
            "total_feeds": total_feeds,
            "active_feeds": active_feeds,
            "total_articles": total_articles,
            "today_new": today_new,
            "read_count": read_count,
            "read_ratio": round(read_ratio, 1),
            "category_stats": [dict(r) for r in category_stats],
        }
    finally:
        conn.close()


def article_guid_exists(guid, db_path=None):
    rows = execute_query_returning(
        "SELECT id FROM articles WHERE guid = ?", (guid,), db_path
    )
    return len(rows) > 0


def find_similar_article(feed_id, title, pub_date, link="", db_path=None):
    conn = get_connection(db_path)
    try:
        if not pub_date:
            return None
        rows = conn.execute(
            "SELECT id, title, link, pub_date FROM articles WHERE feed_id = ?",
            (feed_id,),
        ).fetchall()
        import difflib
        for row in rows:
            if row["link"] and link and row["link"] == link:
                if row["pub_date"] and pub_date:
                    try:
                        existing_dt = datetime.fromisoformat(row["pub_date"])
                        new_dt = datetime.fromisoformat(pub_date)
                        diff = abs((existing_dt - new_dt).total_seconds())
                        if diff <= 1800:
                            return dict(row)
                    except (ValueError, TypeError):
                        pass
            if row["pub_date"] and pub_date:
                try:
                    existing_dt = datetime.fromisoformat(row["pub_date"])
                    new_dt = datetime.fromisoformat(pub_date)
                    diff = abs((existing_dt - new_dt).total_seconds())
                    if diff <= 60:
                        ratio = difflib.SequenceMatcher(None, row["title"], title).ratio()
                        if ratio > 0.8:
                            return dict(row)
                except (ValueError, TypeError):
                    pass
        return None
    finally:
        conn.close()


def get_all_categories(db_path=None):
    rows = execute_query_returning(
        "SELECT * FROM categories ORDER BY sort_order, name", db_path=db_path
    )
    return [dict(r) for r in rows]


def insert_category(name, color="", sort_order=0, db_path=None):
    try:
        cursor = execute_query(
            "INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)",
            (name, color, sort_order),
            db_path=db_path,
        )
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        return None


def remove_category(category_id, db_path=None):
    conn = get_connection(db_path)
    try:
        cat = conn.execute("SELECT * FROM categories WHERE id = ?", (category_id,)).fetchone()
        if not cat:
            return False
        conn.execute("UPDATE feeds SET category = '' WHERE category = ?", (cat["name"],))
        conn.execute("DELETE FROM categories WHERE id = ?", (category_id,))
        conn.execute(
            "UPDATE categories SET sort_order = sort_order - 1 WHERE sort_order > ?",
            (cat["sort_order"],),
        )
        conn.commit()
        return True
    finally:
        conn.close()


def get_article_count_for_feed(feed_id, db_path=None):
    rows = execute_query_returning(
        "SELECT COUNT(*) as c FROM articles WHERE feed_id = ?", (feed_id,), db_path
    )
    return rows[0]["c"] if rows else 0


def get_all_articles(db_path=None):
    rows = execute_query_returning(
        "SELECT a.*, f.title as feed_title FROM articles a LEFT JOIN feeds f ON a.feed_id = f.id ORDER BY a.pub_date DESC",
        db_path=db_path,
    )
    return [dict(r) for r in rows]
