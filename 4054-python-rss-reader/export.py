import csv
import json
import logging
import xml.etree.ElementTree as ET
from xml.dom import minidom

import database as db

logger = logging.getLogger(__name__)


def export_opml(db_path=None, output_file="feeds.opml"):
    feeds = db.get_all_feeds(db_path)

    opml = ET.Element("opml", version="1.0")
    head = ET.SubElement(opml, "head")
    ET.SubElement(head, "title").text = "RSS Feeds Export"
    body = ET.SubElement(opml, "body")

    categories = {}
    for feed in feeds:
        cat = feed.get("category", "") or "(uncategorized)"
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(feed)

    for cat_name, cat_feeds in categories.items():
        if cat_name == "(uncategorized)":
            for feed in cat_feeds:
                ET.SubElement(
                    body,
                    "outline",
                    type="rss",
                    text=feed.get("title", ""),
                    title=feed.get("title", ""),
                    xmlUrl=feed["url"],
                    htmlUrl=feed.get("site_url", ""),
                )
        else:
            cat_outline = ET.SubElement(body, "outline", text=cat_name)
            for feed in cat_feeds:
                ET.SubElement(
                    cat_outline,
                    "outline",
                    type="rss",
                    text=feed.get("title", ""),
                    title=feed.get("title", ""),
                    xmlUrl=feed["url"],
                    htmlUrl=feed.get("site_url", ""),
                )

    rough = ET.tostring(opml, encoding="unicode")
    pretty = minidom.parseString(rough).toprettyxml(indent="  ")
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(pretty)

    return output_file


def import_opml(opml_file, db_path=None):
    try:
        tree = ET.parse(opml_file)
    except ET.ParseError as e:
        logger.error(f"Failed to parse OPML file: {e}")
        return {"status": "error", "message": f"Invalid OPML: {e}"}
    except FileNotFoundError:
        return {"status": "error", "message": f"File not found: {opml_file}"}

    root = tree.getroot()
    body = root.find("body")
    if body is None:
        return {"status": "error", "message": "No <body> in OPML file"}

    imported = 0
    skipped = 0
    errors = 0

    def process_outlines(outlines, category=""):
        nonlocal imported, skipped, errors
        for outline in outlines:
            xml_url = outline.get("xmlUrl")
            if xml_url:
                existing = db.get_feed_by_url(xml_url, db_path)
                if existing:
                    skipped += 1
                    logger.info(f"Skipping existing feed: {xml_url}")
                    continue
                title = outline.get("title", "") or outline.get("text", "")
                site_url = outline.get("htmlUrl", "")
                feed_id = db.insert_feed(
                    url=xml_url,
                    title=title,
                    site_url=site_url,
                    category=category,
                    db_path=db_path,
                )
                if feed_id:
                    imported += 1
                    logger.info(f"Imported feed: {title} (id={feed_id})")
                else:
                    errors += 1
                    logger.warning(f"Failed to import feed: {xml_url}")
            else:
                sub_category = outline.get("text", category)
                process_outlines(outline, sub_category)

    process_outlines(body.findall("outline"))

    return {
        "status": "ok",
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
    }


def export_articles_csv(articles, output_file="articles.csv"):
    fieldnames = [
        "id", "feed_id", "feed_title", "guid", "title", "link", "author",
        "summary", "pub_date", "fetched_at", "is_read", "is_favorite",
        "is_starred", "tags", "read_at",
    ]
    with open(output_file, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for article in articles:
            row = dict(article)
            row["is_read"] = 1 if row.get("is_read") else 0
            row["is_favorite"] = 1 if row.get("is_favorite") else 0
            row["is_starred"] = 1 if row.get("is_starred") else 0
            writer.writerow(row)

    return output_file


def export_articles_json(articles, output_file="articles.json"):
    data = []
    for article in articles:
        row = dict(article)
        row["is_read"] = bool(row.get("is_read"))
        row["is_favorite"] = bool(row.get("is_favorite"))
        row["is_starred"] = bool(row.get("is_starred"))
        data.append(row)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    return output_file
