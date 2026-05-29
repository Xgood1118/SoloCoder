#!/usr/bin/env python
import argparse
import logging
import sys

import database as db
import fetcher
import export
import sync

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

PAGE_SIZE = 20


def _truncate(text, max_len=40):
    if not text:
        return ""
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."


def _format_datetime(dt_str):
    if not dt_str:
        return "N/A"
    try:
        from datetime import datetime
        dt = datetime.fromisoformat(dt_str)
        return dt.strftime("%Y-%m-%d %H:%M")
    except (ValueError, TypeError):
        return dt_str[:16] if len(dt_str) >= 16 else dt_str


def cmd_feeds_list(args):
    feeds = db.get_all_feeds()
    if not feeds:
        print("No feeds found. Use 'feeds add <url>' to add one.")
        return

    header = f"{'ID':<5} {'Title':<30} {'Category':<15} {'URL':<40} {'Last Fetched':<18} {'Articles':<10} {'Active':<7}"
    separator = "-" * len(header)
    print(header)
    print(separator)

    total = len(feeds)
    for i, feed in enumerate(feeds):
        article_count = db.get_article_count_for_feed(feed["id"])
        active = "Yes" if feed.get("is_active") else "No"
        row = (
            f"{feed['id']:<5} "
            f"{_truncate(feed.get('title', ''), 30):<30} "
            f"{_truncate(feed.get('category', ''), 15):<15} "
            f"{_truncate(feed['url'], 40):<40} "
            f"{_format_datetime(feed.get('last_fetched_at')):<18} "
            f"{article_count:<10} "
            f"{active:<7}"
        )
        print(row)

        if (i + 1) % PAGE_SIZE == 0 and (i + 1) < total:
            print(separator)
            try:
                input(f"--- Page {(i + 1) // PAGE_SIZE} of {(total + PAGE_SIZE - 1) // PAGE_SIZE} (Press Enter to continue, Ctrl+C to quit) ---")
            except KeyboardInterrupt:
                print("\nStopped.")
                return
            print(header)
            print(separator)

    print(separator)
    print(f"Total: {total} feed(s)")


def cmd_feeds_add(args):
    url = args.url
    category = getattr(args, "category", "") or ""
    result = fetcher.add_feed(url, category=category)
    if result["status"] == "ok":
        print(f"Feed added successfully!")
        print(f"  ID: {result['feed_id']}")
        print(f"  Title: {result['title']}")
        print(f"  New articles: {result['new_articles']}")
    else:
        print(f"Error: {result['message']}")


def cmd_feeds_remove(args):
    feed_id = args.feed_id
    feed = db.get_feed(feed_id)
    if not feed:
        print(f"Feed {feed_id} not found.")
        return

    article_count = db.get_article_count_for_feed(feed_id)
    print(f"Feed: {feed.get('title', feed['url'])}")
    print(f"  URL: {feed['url']}")
    print(f"  Articles: {article_count}")
    print(f"  Category: {feed.get('category', '(none)')}")

    if not args.force:
        try:
            confirm = input("Are you sure you want to delete this feed and all its articles? (y/N): ")
        except KeyboardInterrupt:
            print("\nCancelled.")
            return
        if confirm.lower() != "y":
            print("Cancelled.")
            return

    if db.remove_feed(feed_id):
        print(f"Feed {feed_id} and {article_count} article(s) deleted.")
    else:
        print(f"Failed to delete feed {feed_id}.")


def cmd_feeds_update(args):
    feed_id = getattr(args, "feed_id", None)
    if feed_id:
        result = fetcher.fetch_feed(feed_id)
        if result["status"] == "ok":
            print(f"Feed {feed_id} updated: {result['new_articles']} new, {result['duplicates']} duplicates")
        elif result["status"] == "not_modified":
            print(f"Feed {feed_id}: not modified since last fetch")
        else:
            print(f"Error updating feed {feed_id}: {result['message']}")
    else:
        results = fetcher.fetch_all_active()
        for r in results:
            status = r.get("status")
            fid = r.get("feed_id")
            title = r.get("title", "")
            if status == "ok":
                print(f"  [{fid}] {title}: {r['new_articles']} new, {r['duplicates']} duplicates")
            elif status == "not_modified":
                print(f"  [{fid}] {title}: not modified")
            else:
                print(f"  [{fid}] {title}: error - {r.get('message', 'unknown')}")


def cmd_feeds_import(args):
    opml_file = args.opml_file
    result = export.import_opml(opml_file)
    if result["status"] == "ok":
        print(f"OPML import complete:")
        print(f"  Imported: {result['imported']}")
        print(f"  Skipped (already exist): {result['skipped']}")
        print(f"  Errors: {result['errors']}")
    else:
        print(f"Error: {result['message']}")


def cmd_articles_list(args):
    articles = db.query_articles(
        feed_id=getattr(args, "feed_id", None),
        unread=getattr(args, "unread", False),
        favorite=getattr(args, "favorite", False),
        tag=getattr(args, "tag", None),
        since=getattr(args, "since", None),
        limit=getattr(args, "limit", PAGE_SIZE),
        offset=getattr(args, "offset", 0),
    )

    if not articles:
        print("No articles found.")
        return

    for i, article in enumerate(articles):
        read_status = "READ" if article.get("is_read") else "UNREAD"
        fav = " [FAV]" if article.get("is_favorite") else ""
        tags = f" [{article['tags']}]" if article.get("tags") else ""
        feed_title = article.get("feed_title", "Unknown")
        pub_date = _format_datetime(article.get("pub_date"))

        print(f"{i + 1}. [{article['id']}] {article['title']}")
        print(f"   Source: {feed_title} | {pub_date} | {read_status}{fav}{tags}")
        if article.get("link"):
            print(f"   Link: {article['link']}")
        print()

    print(f"Showing {len(articles)} article(s)")


def cmd_articles_read(args):
    article_id = args.article_id
    article = db.get_article(article_id)
    if not article:
        print(f"Article {article_id} not found.")
        return

    db.mark_article_read(article_id)
    article = db.get_article(article_id)

    print(f"Title: {article['title']}")
    print(f"Author: {article.get('author', 'N/A')}")
    print(f"Published: {_format_datetime(article.get('pub_date'))}")
    print(f"Link: {article.get('link', 'N/A')}")
    print()
    if article.get("summary"):
        print("Summary:")
        print(article["summary"])
    else:
        print("(No summary available)")
    print()
    print(f"Status: {'Read' if article.get('is_read') else 'Unread'}")


def cmd_articles_favorite(args):
    article_id = args.article_id
    article = db.get_article(article_id)
    if not article:
        print(f"Article {article_id} not found.")
        return

    new_state = db.toggle_favorite(article_id)
    state_str = "favorited" if new_state else "unfavorited"
    print(f"Article '{article['title']}' {state_str}.")


def cmd_articles_tag(args):
    article_id = args.article_id
    tags = args.tags
    article = db.get_article(article_id)
    if not article:
        print(f"Article {article_id} not found.")
        return

    db.set_article_tags(article_id, tags)
    print(f"Article '{article['title']}' tagged: {tags}")


def cmd_articles_export(args):
    fmt = getattr(args, "format", "csv") or "csv"
    output = getattr(args, "output", None)

    articles = db.get_all_articles()
    if not articles:
        print("No articles to export.")
        return

    if not output:
        output = f"articles.{fmt}"

    if fmt == "csv":
        path = export.export_articles_csv(articles, output)
    elif fmt == "json":
        path = export.export_articles_json(articles, output)
    else:
        print(f"Unsupported format: {fmt}. Use csv or json.")
        return

    print(f"Exported {len(articles)} article(s) to {path}")


def cmd_search(args):
    keyword = args.keyword
    articles = db.search_articles(keyword)

    if not articles:
        print(f"No articles found matching '{keyword}'.")
        return

    for i, article in enumerate(articles):
        read_status = "READ" if article.get("is_read") else "UNREAD"
        feed_title = article.get("feed_title", "Unknown")
        pub_date = _format_datetime(article.get("pub_date"))
        print(f"{i + 1}. [{article['id']}] {article['title']}")
        print(f"   Source: {feed_title} | {pub_date} | {read_status}")
        if article.get("summary"):
            print(f"   {_truncate(article['summary'], 80)}")
        print()

    print(f"Found {len(articles)} article(s) matching '{keyword}'")


def cmd_stats(args):
    stats = db.get_stats()
    print("=== RSS Reader Statistics ===")
    print(f"  Total feeds:        {stats['total_feeds']}")
    print(f"  Active feeds:       {stats['active_feeds']}")
    print(f"  Total articles:     {stats['total_articles']}")
    print(f"  Today's new:        {stats['today_new']}")
    print(f"  Read count:         {stats['read_count']}")
    print(f"  Read ratio:         {stats['read_ratio']}%")
    print()
    if stats["category_stats"]:
        print("  Articles by category:")
        for cat in stats["category_stats"]:
            print(f"    {cat['category']}: {cat['count']}")


def build_parser():
    parser_main = argparse.ArgumentParser(
        prog="rss_reader",
        description="Python RSS Reader - Manage RSS/Atom feeds from the command line",
    )
    subparsers = parser_main.add_subparsers(dest="command", help="Available commands")

    feeds_parser = subparsers.add_parser("feeds", help="Manage RSS feeds")
    feeds_sub = feeds_parser.add_subparsers(dest="feeds_command", help="Feed operations")

    feeds_list_parser = feeds_sub.add_parser("list", help="List all feeds")
    feeds_list_parser.set_defaults(func=cmd_feeds_list)

    feeds_add_parser = feeds_sub.add_parser("add", help="Add a new feed")
    feeds_add_parser.add_argument("url", help="URL of the RSS/Atom feed")
    feeds_add_parser.add_argument("--category", "-c", default="", help="Category for the feed")
    feeds_add_parser.set_defaults(func=cmd_feeds_add)

    feeds_remove_parser = feeds_sub.add_parser("remove", help="Remove a feed and its articles")
    feeds_remove_parser.add_argument("feed_id", type=int, help="ID of the feed to remove")
    feeds_remove_parser.add_argument("--force", "-f", action="store_true", help="Skip confirmation")
    feeds_remove_parser.set_defaults(func=cmd_feeds_remove)

    feeds_update_parser = feeds_sub.add_parser("update", help="Fetch updates for feed(s)")
    feeds_update_parser.add_argument("feed_id", nargs="?", type=int, default=None, help="Feed ID (omit for all active feeds)")
    feeds_update_parser.set_defaults(func=cmd_feeds_update)

    feeds_import_parser = feeds_sub.add_parser("import", help="Import feeds from OPML file")
    feeds_import_parser.add_argument("opml_file", help="Path to OPML file")
    feeds_import_parser.set_defaults(func=cmd_feeds_import)

    articles_parser = subparsers.add_parser("articles", help="Browse and manage articles")
    articles_sub = articles_parser.add_subparsers(dest="articles_command", help="Article operations")

    articles_list_parser = articles_sub.add_parser("list", help="List articles")
    articles_list_parser.add_argument("--feed-id", "-f", type=int, default=None, help="Filter by feed ID")
    articles_list_parser.add_argument("--unread", "-u", action="store_true", help="Show only unread articles")
    articles_list_parser.add_argument("--favorite", "-F", action="store_true", help="Show only favorited articles")
    articles_list_parser.add_argument("--tag", "-t", default=None, help="Filter by tag")
    articles_list_parser.add_argument("--since", "-s", default=None, help="Show articles since date (YYYY-MM-DD)")
    articles_list_parser.add_argument("--limit", "-l", type=int, default=PAGE_SIZE, help="Articles per page (default 20)")
    articles_list_parser.add_argument("--offset", "-o", type=int, default=0, help="Offset for pagination")
    articles_list_parser.set_defaults(func=cmd_articles_list)

    articles_read_parser = articles_sub.add_parser("read", help="Mark article as read and show summary")
    articles_read_parser.add_argument("article_id", type=int, help="Article ID")
    articles_read_parser.set_defaults(func=cmd_articles_read)

    articles_fav_parser = articles_sub.add_parser("favorite", help="Toggle favorite status")
    articles_fav_parser.add_argument("article_id", type=int, help="Article ID")
    articles_fav_parser.set_defaults(func=cmd_articles_favorite)

    articles_tag_parser = articles_sub.add_parser("tag", help="Set tags for an article")
    articles_tag_parser.add_argument("article_id", type=int, help="Article ID")
    articles_tag_parser.add_argument("tags", help="Comma-separated tags")
    articles_tag_parser.set_defaults(func=cmd_articles_tag)

    articles_export_parser = articles_sub.add_parser("export", help="Export articles to file")
    articles_export_parser.add_argument("--format", "-f", choices=["csv", "json"], default="csv", help="Export format (default: csv)")
    articles_export_parser.add_argument("--output", "-o", default=None, help="Output file path")
    articles_export_parser.set_defaults(func=cmd_articles_export)

    search_parser = subparsers.add_parser("search", help="Search articles by keyword")
    search_parser.add_argument("keyword", help="Search keyword")
    search_parser.set_defaults(func=cmd_search)

    stats_parser = subparsers.add_parser("stats", help="Show statistics")
    stats_parser.set_defaults(func=cmd_stats)

    return parser_main


def main():
    db.init_db()

    parser_main = build_parser()
    args = parser_main.parse_args()

    if not args.command:
        parser_main.print_help()
        sys.exit(0)

    if hasattr(args, "func"):
        try:
            args.func(args)
        except Exception as e:
            logger.error(f"Error: {e}")
            print(f"Error: {e}")
            sys.exit(1)
    else:
        if args.command == "feeds":
            parser_main.parse_args(["feeds", "--help"])
        elif args.command == "articles":
            parser_main.parse_args(["articles", "--help"])
        else:
            parser_main.print_help()


if __name__ == "__main__":
    main()
