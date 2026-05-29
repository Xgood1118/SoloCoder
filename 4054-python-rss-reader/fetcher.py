import logging
from datetime import datetime

import requests

import database as db
import parser

logger = logging.getLogger(__name__)

DEFAULT_USER_AGENT = "PythonRSSReader/1.0"
MAX_ERROR_COUNT = 5
REQUEST_TIMEOUT = 30


def _ensure_user_agent(user_agent=None):
    if not user_agent or not user_agent.strip():
        return DEFAULT_USER_AGENT
    return user_agent.strip()


def fetch_feed(feed_id, user_agent=None, db_path=None):
    feed = db.get_feed(feed_id, db_path)
    if not feed:
        logger.error(f"Feed {feed_id} not found")
        return {"status": "error", "message": f"Feed {feed_id} not found"}

    headers = {"User-Agent": _ensure_user_agent(user_agent)}
    if feed.get("etag"):
        headers["If-None-Match"] = feed["etag"]
    if feed.get("last_modified"):
        headers["If-Modified-Since"] = feed["last_modified"]

    try:
        response = requests.get(
            feed["url"],
            headers=headers,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )
    except requests.exceptions.Timeout:
        logger.warning(f"Timeout fetching feed {feed_id}: {feed['url']}")
        _increment_error(feed_id, db_path)
        return {"status": "error", "message": f"Timeout fetching {feed['url']}"}
    except requests.exceptions.ConnectionError as e:
        logger.warning(f"Connection error for feed {feed_id}: {e}")
        _increment_error(feed_id, db_path)
        return {"status": "error", "message": f"Connection error: {e}"}
    except requests.exceptions.RequestException as e:
        logger.warning(f"Request error for feed {feed_id}: {e}")
        _increment_error(feed_id, db_path)
        return {"status": "error", "message": f"Request error: {e}"}

    if response.status_code == 304:
        logger.info(f"Feed {feed_id} not modified (304)")
        db.update_feed(feed_id, last_fetched_at=datetime.utcnow().isoformat())
        return {"status": "not_modified", "message": "Not modified"}

    if response.status_code != 200:
        logger.warning(f"Feed {feed_id} returned status {response.status_code}")
        _increment_error(feed_id, db_path)
        return {"status": "error", "message": f"HTTP {response.status_code}"}

    try:
        xml_text = response.text
    except Exception as e:
        logger.error(f"Failed to read response body for feed {feed_id}: {e}")
        _increment_error(feed_id, db_path)
        return {"status": "error", "message": f"Failed to read response: {e}"}

    try:
        feed_info, articles = parser.parse_rss_xml(xml_text)
    except Exception as e:
        logger.error(f"Failed to parse feed {feed_id}: {e}")
        _increment_error(feed_id, db_path)
        return {"status": "error", "message": f"Parse error: {e}"}

    if feed_info is None:
        _increment_error(feed_id, db_path)
        return {"status": "error", "message": "Unrecognized feed format"}

    new_etag = response.headers.get("ETag", "")
    new_last_modified = response.headers.get("Last-Modified", "")

    update_fields = {
        "last_fetched_at": datetime.utcnow().isoformat(),
        "error_count": 0,
    }
    if feed_info.get("title") and not feed.get("title"):
        update_fields["title"] = feed_info["title"]
    elif feed_info.get("title"):
        update_fields["title"] = feed_info["title"]
    if feed_info.get("description"):
        update_fields["description"] = feed_info["description"]
    if feed_info.get("site_url"):
        update_fields["site_url"] = feed_info["site_url"]
    if new_etag:
        update_fields["etag"] = new_etag
    if new_last_modified:
        update_fields["last_modified"] = new_last_modified

    db.update_feed(feed_id, **update_fields)

    new_count = 0
    dup_count = 0
    for article in articles:
        if not article.get("guid"):
            article["guid"] = article.get("link", "") or f"{feed['url']}#{datetime.utcnow().timestamp()}"

        if not article.get("pub_date"):
            article["pub_date"] = datetime.utcnow().isoformat()

        if db.article_guid_exists(article["guid"], db_path):
            dup_count += 1
            continue

        similar = db.find_similar_article(
            feed_id,
            article.get("title", ""),
            article.get("pub_date"),
            article.get("link", ""),
            db_path,
        )
        if similar:
            dup_count += 1
            continue

        aid = db.insert_article(
            feed_id=feed_id,
            guid=article["guid"],
            title=article.get("title", ""),
            link=article.get("link", ""),
            author=article.get("author", ""),
            content=article.get("content", ""),
            summary=article.get("summary", ""),
            pub_date=article.get("pub_date"),
            fetched_at=datetime.utcnow().isoformat(),
            db_path=db_path,
        )
        if aid:
            new_count += 1
        else:
            dup_count += 1

    return {
        "status": "ok",
        "new_articles": new_count,
        "duplicates": dup_count,
        "total_parsed": len(articles),
    }


def fetch_all_active(user_agent=None, db_path=None):
    feeds = db.get_active_feeds(db_path)
    results = []
    for feed in feeds:
        result = fetch_feed(feed["id"], user_agent, db_path)
        results.append({"feed_id": feed["id"], "title": feed.get("title", ""), **result})
    return results


def add_feed(url, category="", user_agent=None, db_path=None):
    existing = db.get_feed_by_url(url, db_path)
    if existing:
        return {"status": "error", "message": f"Feed already exists with id {existing['id']}"}

    headers = {"User-Agent": _ensure_user_agent(user_agent)}
    try:
        response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT, allow_redirects=True)
    except requests.exceptions.RequestException as e:
        return {"status": "error", "message": f"Failed to fetch URL: {e}"}

    if response.status_code != 200:
        return {"status": "error", "message": f"HTTP {response.status_code}"}

    try:
        feed_info, articles = parser.parse_rss_xml(response.text)
    except Exception as e:
        return {"status": "error", "message": f"Parse error: {e}"}

    if feed_info is None:
        return {"status": "error", "message": "Unrecognized feed format"}

    feed_id = db.insert_feed(
        url=url,
        title=feed_info.get("title", ""),
        description=feed_info.get("description", ""),
        site_url=feed_info.get("site_url", ""),
        category=category,
        db_path=db_path,
    )
    if not feed_id:
        return {"status": "error", "message": "Failed to insert feed (duplicate URL?)"}

    new_etag = response.headers.get("ETag", "")
    new_last_modified = response.headers.get("Last-Modified", "")
    update_fields = {"last_fetched_at": datetime.utcnow().isoformat()}
    if new_etag:
        update_fields["etag"] = new_etag
    if new_last_modified:
        update_fields["last_modified"] = new_last_modified
    db.update_feed(feed_id, **update_fields)

    new_count = 0
    for article in articles:
        if not article.get("guid"):
            article["guid"] = article.get("link", "") or f"{url}#{datetime.utcnow().timestamp()}"
        if not article.get("pub_date"):
            article["pub_date"] = datetime.utcnow().isoformat()
        aid = db.insert_article(
            feed_id=feed_id,
            guid=article["guid"],
            title=article.get("title", ""),
            link=article.get("link", ""),
            author=article.get("author", ""),
            content=article.get("content", ""),
            summary=article.get("summary", ""),
            pub_date=article.get("pub_date"),
            fetched_at=datetime.utcnow().isoformat(),
            db_path=db_path,
        )
        if aid:
            new_count += 1

    return {
        "status": "ok",
        "feed_id": feed_id,
        "title": feed_info.get("title", ""),
        "new_articles": new_count,
    }


def _increment_error(feed_id, db_path=None):
    feed = db.get_feed(feed_id, db_path)
    if not feed:
        return
    new_count = feed.get("error_count", 0) + 1
    if new_count >= MAX_ERROR_COUNT:
        logger.warning(
            f"Feed {feed_id} has {new_count} consecutive errors, deactivating"
        )
        db.update_feed(feed_id, error_count=new_count, is_active=False)
    else:
        db.update_feed(feed_id, error_count=new_count)
