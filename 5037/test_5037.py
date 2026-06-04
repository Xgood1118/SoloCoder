"""Solo-check automation for 5037 recipe/food app."""
from playwright.sync_api import sync_playwright
import sys
import os

URL = "http://127.0.0.1:5137/"
SCREENSHOT_DIR = "D:/work01/SoloCoder/5037"
results = {"pass": 0, "fail": 0, "tests": []}


def report(name, ok, detail=""):
    if ok:
        results["pass"] += 1
        results["tests"].append(f"  [PASS] {name}")
    else:
        results["fail"] += 1
        results["tests"].append(f"  [FAIL] {name} - {detail}")


def run(p):
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1400, "height": 900})
    page = ctx.new_page()
    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: console_errors.append(f"PAGEERROR: {exc}"))

    # Track network requests to detect any cloud API calls
    network_requests = []
    page.on("request", lambda req: network_requests.append(req.url))

    # ---- 1. Home page loads ----
    page.goto(URL, wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(2000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/screenshot_R1_1_home.png", full_page=True)
    report("Home page loads", page.locator("body").count() == 1, "")

    # ---- 2. Categories visible on home page ----
    # The home page should show category chips
    home_text = page.content()
    has_categories = "家常菜" in home_text or "快手菜" in home_text or "烘焙" in home_text
    report("Home page shows categories", has_categories, f"has_categories={has_categories}")

    # ---- 3. Recipes list visible ----
    has_recipes = "菜谱" in home_text
    report("Home page mentions 菜谱", has_recipes, "")

    # ---- 4. Click first recipe card to navigate to detail ----
    # Try clicking on first recipe link
    recipe_links = page.locator("a[href*='/recipe/']")
    if recipe_links.count() == 0:
        # Try clicking the first card
        recipe_links = page.locator("[class*='rounded-card']").first
        recipe_links.click()
    else:
        recipe_links.first.click()
    page.wait_for_url("**/recipe/**", timeout=10000)
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/screenshot_R1_2_recipe.png", full_page=True)
    detail_text = page.content()
    report("Recipe detail page loads", "食材" in detail_text or "ingredient" in detail_text.lower(), "")

    # ---- 5. Recipe has ingredients section ----
    has_ingredients = "食材清单" in detail_text or "食材" in detail_text
    report("Recipe has 食材清单 section", has_ingredients, "")

    # ---- 6. Recipe has cooking steps section ----
    has_steps = "烹饪步骤" in detail_text or "步骤" in detail_text
    report("Recipe has 烹饪步骤 section", has_steps, "")

    # ---- 7. Recipe has nutrition section ----
    has_nutrition = "营养" in detail_text
    report("Recipe has 营养信息 section", has_nutrition, "")

    # ---- 8. Recipe has cook time display ----
    has_time = "分钟" in detail_text or "时间" in detail_text
    report("Recipe shows cook time", has_time, "")

    # ---- 9. Click heart/favorite button ----
    # Bottom action bar has heart icon
    heart_btns = page.locator("button").filter(has_text="").all()
    # Find the heart icon button - try a different approach
    try:
        page.locator("svg.lucide-heart").first.click()
        page.wait_for_timeout(500)
        report("Favorite button clickable", True, "")
    except Exception as e:
        report("Favorite button clickable", False, str(e))

    # ---- 10. Click add to shopping list button ----
    try:
        page.get_by_text("加入购物清单").first.click()
        page.wait_for_timeout(800)
        report("Add to shopping list button clickable", True, "")
    except Exception as e:
        report("Add to shopping list button clickable", False, str(e))

    # ---- 11. Navigate to shopping list ----
    page.goto(URL + "shopping-list", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/screenshot_R1_3_shopping.png", full_page=True)
    shopping_text = page.content()
    report("Shopping list page loads", "购物清单" in shopping_text, "")

    # ---- 12. CRITICAL CHECK: "已同步" indicator - should this be present? ----
    # PROMPT requires "清单数据保存在云端可以跨设备同步"
    has_cloud_indicator = "已同步" in shopping_text and "Cloud" in shopping_text
    if has_cloud_indicator:
        # Check localStorage to see if data is actually persisted locally
        ls_data = page.evaluate("() => Object.keys(localStorage)")
        ls_has_shopping = any("shopping" in k.lower() for k in ls_data)
        # The page claims cloud sync but actually uses localStorage
        if ls_has_shopping:
            results["tests"].append(f"  [CRITICAL] '已同步' badge shown but data persisted to localStorage: {ls_data}")

        # Check that NO actual cloud API calls were made
        cloud_api_calls = [u for u in network_requests if "api" in u.lower() and "localhost" not in u and "127.0.0.1" not in u]
        if not cloud_api_calls:
            results["tests"].append(f"  [CRITICAL] '已同步' badge shown but no cloud API calls detected (all {len(network_requests)} requests are local)")

        report("'已同步' cloud sync indicator present (MISLEADING - uses localStorage)", has_cloud_indicator, "")
    else:
        report("'已同步' indicator absent", True, "")

    # ---- 13. Shopping list should have items from recipe ----
    has_items = page.locator("text=鸡蛋").count() > 0 or page.locator("text=盐").count() > 0 or page.locator("text=葱").count() > 0 or page.locator("text=蒜").count() > 0
    # It's OK if not, depending on the recipe - let's just check items > 0
    items_count = page.locator("[class*='rounded-card']").count()
    if items_count == 0:
        # Try manual add
        page.locator("input[placeholder='添加商品...']").fill("测试商品")
        page.wait_for_timeout(200)
        page.locator("input[placeholder='用量']").fill("1个")
        page.wait_for_timeout(200)
        # Click + button
        page.locator("button").filter(has=page.locator("svg.lucide-plus")).first.click()
        page.wait_for_timeout(500)
        items_count = page.locator("[class*='rounded-card']").count()
    report("Shopping list has at least 1 item (after manual add if needed)", items_count >= 1, f"items_count={items_count}")

    # ---- 14. Group by category button visible ----
    has_group_category = "按食材类别" in shopping_text
    report("Group by category button visible", has_group_category, "")

    # ---- 15. Group by supermarket button visible ----
    has_group_super = "按商超分区" in shopping_text
    report("Group by supermarket button visible", has_group_super, "")

    # ---- 16. Click group by supermarket, verify groups change ----
    if has_group_super:
        page.get_by_text("按商超分区").click()
        page.wait_for_timeout(500)
        page.screenshot(path=f"{SCREENSHOT_DIR}/screenshot_R1_4_grouped.png", full_page=True)

    # ---- 17. Toggle purchased on an item ----
    # First add an item if list is empty
    if items_count == 0:
        page.locator("input[placeholder='添加商品...']").fill("测试商品")
        page.wait_for_timeout(200)
        page.locator("input[placeholder='用量']").fill("1个")
        page.wait_for_timeout(200)
        page.locator("button").filter(has=page.locator("svg.lucide-plus")).first.click()
        page.wait_for_timeout(500)
    # Click checkbox
    try:
        check_btn = page.locator("button.rounded-full").first
        if check_btn.count() > 0:
            check_btn.click()
            page.wait_for_timeout(500)
            report("Toggle purchased clickable", True, "")
        else:
            report("Toggle purchased clickable", False, "no checkbox button found")
    except Exception as e:
        report("Toggle purchased clickable", False, str(e))

    # ---- 18. Remove item via trash button ----
    try:
        # The trash button is hidden until hover. Use force click.
        trash = page.locator("svg.lucide-trash-2").first
        if trash.count() > 0:
            trash.click(force=True)
            page.wait_for_timeout(500)
            report("Remove item clickable", True, "")
        else:
            report("Remove item clickable", False, "no trash icon")
    except Exception as e:
        report("Remove item clickable", False, str(e))

    # ---- 19. Navigate to search page ----
    page.goto(URL + "search", wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/screenshot_R1_5_search.png", full_page=True)
    search_text = page.content()
    report("Search page loads", "搜索" in search_text or "search" in search_text.lower(), "")

    # ---- 20. Search has filter elements ----
    # Should have a search input
    search_input = page.locator("input[type='text'], input[type='search'], input[placeholder*='搜索']").first
    has_search_input = search_input.count() > 0
    report("Search input visible", has_search_input, "")

    # ---- 21. Search has category filter ----
    has_filter = "分类" in search_text or "难度" in search_text or "时间" in search_text
    report("Search has filter UI (分类/难度/时间)", has_filter, "")

    # ---- 22. Type in search and verify results ----
    if has_search_input:
        search_input.fill("红烧")
        page.wait_for_timeout(800)
        # Look for a result
        result_count = page.locator("a[href*='/recipe/']").count()
        report(f"Search '红烧' returns results", result_count >= 1, f"results={result_count}")

    # ---- 23. Navigate to user profile ----
    page.goto(URL, wait_until="networkidle", timeout=15000)
    page.wait_for_timeout(1500)
    # Click first user avatar/link
    user_link = page.locator("a[href*='/user/']")
    if user_link.count() > 0:
        user_link.first.click()
        page.wait_for_url("**/user/**", timeout=10000)
        page.wait_for_timeout(1500)
        page.screenshot(path=f"{SCREENSHOT_DIR}/screenshot_R1_6_user.png", full_page=True)
        user_text = page.content()
        report("User profile page loads", "关注" in user_text or "粉丝" in user_text, "")

        # ---- 24. Follow button on user profile ----
        has_follow = "关注" in user_text
        report("User profile has 关注 button", has_follow, "")

        # ---- 25. Click follow button ----
        if has_follow:
            try:
                follow_btn = page.get_by_text("关注", exact=True).first
                if follow_btn.is_visible():
                    follow_btn.click()
                    page.wait_for_timeout(500)
                    after_text = page.content()
                    became_followed = "已关注" in after_text
                    report("Click follow toggles to 已关注", became_followed, f"became_followed={became_followed}")
            except Exception as e:
                report("Click follow works", False, str(e))
    else:
        report("User profile link found", False, "no /user/ link on home")

    # ---- 26. Console errors check ----
    real_errors = [e for e in console_errors if "DevTools" not in e and "favicon" not in e.lower() and "trae-solo-badge" not in e.lower()]
    report("No critical console errors", len(real_errors) == 0, f"errors={real_errors[:3]}")

    # ---- 27. Verify NO cloud API calls in network log ----
    # All network requests should be localhost/127.0.0.1 only
    non_local_requests = [u for u in network_requests if "127.0.0.1" not in u and "localhost" not in u and "data:" not in u and "blob:" not in u]
    if "已同步" in shopping_text:
        report("No cloud API calls made (despite '已同步' UI)", len(non_local_requests) == 0, f"non_local={non_local_requests[:3]}")

    # ---- 28. Verify data IS in localStorage (confirms fake cloud sync) ----
    ls_keys = page.evaluate("() => Object.keys(localStorage)")
    has_shopping_ls = any("shopping" in k.lower() for k in ls_keys)
    report("Shopping data persisted in localStorage (not cloud)", has_shopping_ls, f"ls_keys={ls_keys}")

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

print(f"\n=== 5037 Test Results ===")
print(f"Pass: {results['pass']}, Fail: {results['fail']}")
for t in results["tests"]:
    print(t)
sys.exit(0 if results["fail"] == 0 else 1)
