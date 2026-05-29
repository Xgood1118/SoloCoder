import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
import re
import logging

logger = logging.getLogger(__name__)

RSS_NAMESPACES = {
    "atom": "http://www.w3.org/2005/Atom",
    "dc": "http://purl.org/dc/elements/1.1/",
    "content": "http://purl.org/rss/1.0/modules/content/",
}


def _get_text(element, tag, default=""):
    if element is None:
        return default
    child = element.find(tag)
    if child is not None and child.text:
        return child.text.strip()
    return default


def _get_attr(element, tag, attr, default=""):
    if element is None:
        return default
    child = element.find(tag)
    if child is not None:
        val = child.get(attr)
        return val if val else default
    return default


def _parse_datetime(date_str):
    if not date_str:
        return None
    date_str = date_str.strip()
    formats = [
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.isoformat()
        except (ValueError, TypeError):
            continue
    try:
        dt = parsedate_to_datetime(date_str)
        return dt.isoformat()
    except (ValueError, TypeError, IndexError):
        pass
    logger.warning(f"Failed to parse date: {date_str}")
    return None


def _strip_html(html_text, max_len=300):
    if not html_text:
        return ""
    clean = re.sub(r"<[^>]+>", "", html_text)
    clean = re.sub(r"\s+", " ", clean).strip()
    if len(clean) > max_len:
        clean = clean[:max_len] + "..."
    return clean


def parse_rss_xml(xml_text):
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        logger.error(f"XML parse error: {e}")
        return None, []

    if root.tag == "rss" or root.tag.endswith("}rss"):
        return _parse_rss2(root)
    elif root.tag == "{http://www.w3.org/2005/Atom}feed" or root.tag == "feed":
        return _parse_atom(root)
    else:
        channel = root.find("channel")
        if channel is not None:
            return _parse_rss2(root)
        logger.error(f"Unknown feed format: {root.tag}")
        return None, []


def _parse_rss2(root):
    channel = root.find("channel")
    if channel is None:
        return None, []

    feed_info = {
        "title": _get_text(channel, "title"),
        "description": _get_text(channel, "description"),
        "site_url": _get_text(channel, "link"),
    }

    articles = []
    for item in channel.findall("item"):
        guid_elem = item.find("guid")
        if guid_elem is not None and guid_elem.text:
            guid = guid_elem.text.strip()
        else:
            guid = _get_text(item, "link")

        title = _get_text(item, "title")
        link = _get_text(item, "link")

        content_elem = item.find("content:encoded", RSS_NAMESPACES)
        if content_elem is not None and content_elem.text:
            content = content_elem.text
        else:
            content = _get_text(item, "description")

        desc_elem = item.find("description")
        raw_desc = desc_elem.text if desc_elem is not None and desc_elem.text else ""
        summary = _strip_html(raw_desc, 300) if raw_desc else _strip_html(content, 300)

        author = _get_text(item, "dc:creator", RSS_NAMESPACES) or _get_text(item, "author")
        pub_date = _parse_datetime(_get_text(item, "pubDate"))

        articles.append({
            "guid": guid,
            "title": title,
            "link": link,
            "author": author,
            "content": content,
            "summary": summary,
            "pub_date": pub_date,
        })

    return feed_info, articles


def _parse_atom(root):
    ns = {"atom": "http://www.w3.org/2005/Atom"}

    title_elem = root.find("atom:title", ns)
    feed_title = title_elem.text.strip() if title_elem is not None and title_elem.text else ""

    subtitle_elem = root.find("atom:subtitle", ns)
    feed_desc = subtitle_elem.text.strip() if subtitle_elem is not None and subtitle_elem.text else ""

    link_elem = root.find("atom:link[@rel='alternate']", ns)
    if link_elem is None:
        link_elem = root.find("atom:link", ns)
    site_url = link_elem.get("href", "") if link_elem is not None else ""

    feed_info = {
        "title": feed_title,
        "description": feed_desc,
        "site_url": site_url,
    }

    articles = []
    for entry in root.findall("atom:entry", ns):
        id_elem = entry.find("atom:id", ns)
        guid = id_elem.text.strip() if id_elem is not None and id_elem.text else ""

        title_elem = entry.find("atom:title", ns)
        title = title_elem.text.strip() if title_elem is not None and title_elem.text else ""

        link_elem = entry.find("atom:link[@rel='alternate']", ns)
        if link_elem is None:
            link_elem = entry.find("atom:link", ns)
        link = link_elem.get("href", "") if link_elem is not None else ""

        content_elem = entry.find("atom:content", ns)
        summary_elem = entry.find("atom:summary", ns)

        if content_elem is not None and content_elem.text:
            content = content_elem.text
        elif summary_elem is not None and summary_elem.text:
            content = summary_elem.text
        else:
            content = ""

        if summary_elem is not None and summary_elem.text:
            summary = _strip_html(summary_elem.text, 300)
        else:
            summary = _strip_html(content, 300)

        author_elem = entry.find("atom:author/atom:name", ns)
        author = author_elem.text.strip() if author_elem is not None and author_elem.text else ""

        updated_elem = entry.find("atom:updated", ns)
        published_elem = entry.find("atom:published", ns)
        date_str = ""
        if published_elem is not None and published_elem.text:
            date_str = published_elem.text.strip()
        elif updated_elem is not None and updated_elem.text:
            date_str = updated_elem.text.strip()
        pub_date = _parse_datetime(date_str)

        if not guid and link:
            guid = link

        articles.append({
            "guid": guid,
            "title": title,
            "link": link,
            "author": author,
            "content": content,
            "summary": summary,
            "pub_date": pub_date,
        })

    return feed_info, articles
