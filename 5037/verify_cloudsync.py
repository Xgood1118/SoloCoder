"""Focused test: verify cloud sync claim on shopping list."""
from playwright.sync_api import sync_playwright
import sys

URL = "http://127.0.0.1:5137/"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # Track ALL network requests
    network_requests = []
    page.on("request", lambda req: network_requests.append({
        "url": req.url,
        "method": req.method,
        "resource_type": req.resource_type
    }))

    # First add an item to ensure shopping list isn't empty (so the Cloud indicator shows)
    page.goto(URL, wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(2000)

    # Go to shopping list and add an item
    page.goto(URL + "shopping-list", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1500)

    # Check if shopping list is empty - if so, add an item
    items_count = page.locator("[class*='rounded-card']").count()
    print(f"Initial items count: {items_count}")

    if items_count == 0:
        page.locator("input[placeholder='添加商品...']").fill("测试商品")
        page.wait_for_timeout(200)
        page.locator("input[placeholder='用量']").fill("1个")
        page.wait_for_timeout(200)
        page.locator("button").filter(has=page.locator("svg.lucide-plus")).first.click()
        page.wait_for_timeout(500)
        items_count = page.locator("[class*='rounded-card']").count()
        print(f"After add: items count = {items_count}")

    # Now check the cloud sync indicator
    # The HTML should contain '已同步' text near a Cloud icon
    page_html = page.content()
    has_synced = "已同步" in page_html
    print(f"\n'已同步' text in page: {has_synced}")

    # Take screenshot of the shopping list header
    header = page.locator("text=购物清单").first
    if header.is_visible():
        # Get parent container
        parent = header.locator("xpath=ancestor::div[1]")
        if parent.count() > 0:
            print(f"Header container: {parent.inner_text()}")

    # Check localStorage for shopping data
    ls_data = page.evaluate("""() => {
        const result = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            result[key] = value ? value.substring(0, 200) : '';
        }
        return result;
    }""")
    print(f"\nlocalStorage keys: {list(ls_data.keys())}")
    for k, v in ls_data.items():
        print(f"  {k}: {v[:100]}...")

    # Check all network requests for cloud API calls
    cloud_calls = [r for r in network_requests if "127.0.0.1" not in r["url"] and "localhost" not in r["url"] and "data:" not in r["url"][:5] and "blob:" not in r["url"][:5]]
    print(f"\nTotal non-local network requests: {len(cloud_calls)}")
    for r in cloud_calls[:10]:
        print(f"  {r['method']} {r['url'][:100]}")

    # Check if any of those are POST/PUT calls to a server (which would be sync)
    sync_calls = [r for r in cloud_calls if r["method"] in ["POST", "PUT", "PATCH"] and "trae" not in r["url"]]
    print(f"\nPossible sync API calls (POST/PUT to non-trae): {len(sync_calls)}")

    page.screenshot(path="D:/work01/SoloCoder/5037/screenshot_cloudsync_check.png", full_page=True)
    browser.close()
