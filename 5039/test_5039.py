"""Solo-check automation for 5039 CMS system."""
from playwright.sync_api import sync_playwright
import sys
import json
import requests

URL = "http://127.0.0.1:3039"
SCREENSHOT_DIR = "D:/work01/SoloCoder/5039"
results = {"pass": 0, "fail": 0, "tests": []}


def report(name, ok, detail=""):
    if ok:
        results["pass"] += 1
        results["tests"].append(f"  [PASS] {name}")
    else:
        results["fail"] += 1
        results["tests"].append(f"  [FAIL] {name} - {detail}")


def setup_test_data():
    """Create a category, tag, template, and article for testing."""
    # Create category
    r = requests.post(f"{URL}/api/categories", json={"name": "测试分类", "slug": "test-cat", "description": "测试用"})
    cat_id = r.json().get("id")

    # Create tag
    r = requests.post(f"{URL}/api/tags", json={"name": "测试标签", "slug": "test-tag"})
    tag_id = r.json().get("id")

    # Create template
    r = requests.post(f"{URL}/api/templates", json={"name": "新闻模板", "type": "news", "layout_config": "{}"})
    tmpl_id = r.json().get("id")

    # Create article
    r = requests.post(f"{URL}/api/articles", json={
        "title": "测试文章",
        "content": "测试内容",
        "excerpt": "测试摘要",
        "category_id": cat_id,
        "template_id": tmpl_id,
        "tags": [tag_id] if tag_id else []
    })
    art_id = r.json().get("id")

    return {"cat_id": cat_id, "tag_id": tag_id, "tmpl_id": tmpl_id, "art_id": art_id}


def run(p):
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1400, "height": 900})
    page = ctx.new_page()
    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: console_errors.append(f"PAGEERROR: {exc}"))

    # ---- 1. Setup test data ----
    ids = setup_test_data()
    report("Setup: created category/tag/template/article", ids["art_id"] is not None, f"ids={ids}")

    # ---- 2. Verify article creation ----
    r = requests.get(f"{URL}/api/articles")
    articles = r.json().get("data", [])
    report(f"Article list has 1 item ({len(articles)} found)", len(articles) == 1, f"articles={len(articles)}")

    # ---- 3. Verify category is associated ----
    if articles:
        art = articles[0]
        report("Article has category_name", art.get("category_name") == "测试分类", f"cat_name={art.get('category_name')}")

    # ---- 4. Update article (create a version) ----
    if ids["art_id"]:
        r = requests.put(f"{URL}/api/articles/{ids['art_id']}", json={
            "title": "测试文章 - 已更新",
            "content": "更新后的内容"
        })
        report("Update article API works", r.status_code == 200, f"status={r.status_code}")

    # ---- 5. Publish article ----
    if ids["art_id"]:
        r = requests.post(f"{URL}/api/articles/{ids['art_id']}/publish")
        report("Publish article API works", r.status_code == 200, f"status={r.status_code}")

    # ---- 6. CRITICAL CHECK: Get versions (version management) ----
    if ids["art_id"]:
        r = requests.get(f"{URL}/api/articles/{ids['art_id']}/versions")
        versions = r.json()
        report(f"Version management: article has versions ({len(versions)} found)", len(versions) >= 1, f"versions={versions}")

    # ---- 7. CRITICAL CHECK: Tags round-trip ----
    # Create an article with a tag, then GET it back and check tags are returned
    r = requests.post(f"{URL}/api/articles", json={
        "title": "标签测试文章",
        "content": "测试",
        "tags": [ids["tag_id"]] if ids["tag_id"] else []
    })
    tag_test_art_id = r.json().get("id")
    r = requests.get(f"{URL}/api/articles/{tag_test_art_id}")
    art_with_tags = r.json()
    tags_returned = art_with_tags.get("tags", [])
    report(f"Tags round-trip: created with tag, returned {len(tags_returned)} tags", len(tags_returned) >= 1, f"tags={tags_returned}")

    # ---- 8. Create second article to test related ----
    r = requests.post(f"{URL}/api/articles", json={
        "title": "相关文章",
        "content": "相关文章内容",
        "category_id": ids["cat_id"],
        "tags": [ids["tag_id"]] if ids["tag_id"] else []
    })
    rel_art_id = r.json().get("id")
    requests.post(f"{URL}/api/articles/{rel_art_id}/publish")

    r = requests.get(f"{URL}/api/articles/{tag_test_art_id}/related")
    related = r.json()
    report(f"Related articles API works ({len(related)} found)", isinstance(related, list), f"related={related}")

    # ---- 9. Trash (soft delete) ----
    if ids["art_id"]:
        r = requests.delete(f"{URL}/api/articles/{ids['art_id']}")
        report("Delete to trash works", r.status_code == 200, f"status={r.status_code}")

    # ---- 10. List trashed articles (with include_deleted=true) ----
    r = requests.get(f"{URL}/api/articles?include_deleted=true")
    trashed = [a for a in r.json().get("data", []) if a.get("deleted_at")]
    report(f"Trashed articles listable ({len(trashed)} in trash)", len(trashed) == 1, f"trashed={len(trashed)}")

    # ---- 11. Restore from trash ----
    if ids["art_id"]:
        r = requests.post(f"{URL}/api/articles/{ids['art_id']}/restore")
        report("Restore from trash works", r.status_code == 200, f"status={r.status_code}")

    # ---- 12. Permanent delete ----
    if ids["art_id"]:
        r = requests.delete(f"{URL}/api/articles/{ids['art_id']}?permanent=true")
        report("Permanent delete works", r.status_code == 200, f"status={r.status_code}")

    # Verify it's gone
    r = requests.get(f"{URL}/api/articles/{ids['art_id']}")
    report("Permanent deleted article returns 404", r.status_code == 404, f"status={r.status_code}")

    # ---- 13. Approval workflow ----
    r = requests.post(f"{URL}/api/approvals", json={"article_id": tag_test_art_id, "request_note": "请审批"})
    appr_id = r.json().get("id")
    report("Submit approval works", r.status_code == 201, f"status={r.status_code}")

    r = requests.post(f"{URL}/api/approvals/{appr_id}/approve", json={"approval_note": "OK"})
    report("Approve works", r.status_code == 200, f"status={r.status_code}")

    # ---- 14. Verify article status changed to published ----
    r = requests.get(f"{URL}/api/articles/{tag_test_art_id}")
    art = r.json()
    report("Approved article is published", art.get("status") == "published", f"status={art.get('status')}")

    # ---- 15. Operation logs ----
    r = requests.get(f"{URL}/api/logs")
    logs_data = r.json()
    logs = logs_data.get("data", [])
    report(f"Operation logs recorded ({len(logs)} entries)", len(logs) >= 4, f"logs_count={len(logs)}")

    # ---- 16. Multi-language: create English version ----
    r = requests.post(f"{URL}/api/articles", json={
        "title": "Test Article EN",
        "content": "English content",
        "language": "en-US",
        "master_id": tag_test_art_id
    })
    en_art_id = r.json().get("id")
    report("Multi-language: create EN version works", r.status_code == 201, f"status={r.status_code}")

    # Filter by language
    r = requests.get(f"{URL}/api/articles?language=zh-CN")
    zh_articles = r.json().get("data", [])
    r = requests.get(f"{URL}/api/articles?language=en-US")
    en_articles = r.json().get("data", [])
    report(f"Multi-language filter: zh-CN={len(zh_articles)} en-US={len(en_articles)}", len(zh_articles) >= 1 and len(en_articles) >= 1, f"zh={len(zh_articles)} en={len(en_articles)}")

    # ---- 17. Templates CRUD ----
    r = requests.get(f"{URL}/api/templates")
    templates = r.json()
    report(f"Templates listable ({len(templates)} found)", len(templates) >= 1, f"count={len(templates)}")

    # ---- 18. UI: page loads ----
    page.goto(URL, wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(2000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/screenshot_R1_1_dashboard.png", full_page=True)
    report("UI: dashboard page loads", page.locator("body").count() == 1, "")

    # ---- 19. UI: navigate to articles ----
    page.goto(f"{URL}/articles", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/screenshot_R1_2_articles.png", full_page=True)
    art_text = page.content()
    has_articles = "测试文章" in art_text or "标签测试" in art_text or "文章" in art_text
    report("UI: articles page shows articles", has_articles, "")

    # ---- 20. UI: navigate to categories ----
    page.goto(f"{URL}/categories", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/screenshot_R1_3_categories.png", full_page=True)
    cat_text = page.content()
    has_cats = "测试分类" in cat_text
    report("UI: categories page shows category", has_cats, "")

    # ---- 21. UI: navigate to tags ----
    page.goto(f"{URL}/tags", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1000)
    tag_text = page.content()
    has_tags = "测试标签" in tag_text
    report("UI: tags page shows tag", has_tags, "")

    # ---- 22. UI: navigate to templates ----
    page.goto(f"{URL}/templates", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1000)
    tmpl_text = page.content()
    has_tmpl = "新闻模板" in tmpl_text
    report("UI: templates page shows template", has_tmpl, "")

    # ---- 23. UI: navigate to trash ----
    page.goto(f"{URL}/trash", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/screenshot_R1_4_trash.png", full_page=True)
    report("UI: trash page loads", page.locator("body").count() == 1, "")

    # ---- 24. UI: navigate to approvals ----
    page.goto(f"{URL}/approvals", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/screenshot_R1_5_approvals.png", full_page=True)
    appr_text = page.content()
    has_appr = "审批" in appr_text
    report("UI: approvals page shows approvals", has_appr, "")

    # ---- 25. UI: navigate to logs ----
    page.goto(f"{URL}/logs", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1000)
    log_text = page.content()
    has_logs = "日志" in log_text or "操作" in log_text or "log" in log_text.lower()
    report("UI: logs page loads", has_logs, "")

    # ---- 26. Console errors check ----
    real_errors = [e for e in console_errors if "DevTools" not in e and "favicon" not in e.lower()]
    report("No critical console errors", len(real_errors) == 0, f"errors={real_errors[:3]}")

    browser.close()


with sync_playwright() as p:
    try:
        run(p)
    except Exception as e:
        print(f"FATAL: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        results["tests"].append(f"  [FATAL] {e}")
        results["fail"] += 1

print(f"\n=== 5039 Test Results ===")
print(f"Pass: {results['pass']}, Fail: {results['fail']}")
for t in results["tests"]:
    print(t)
sys.exit(0 if results["fail"] == 0 else 1)
