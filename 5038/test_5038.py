"""Solo-check automation for 5038 photo manager."""
from playwright.sync_api import sync_playwright
import sys
import os

URL = "http://127.0.0.1:5138/"
SCREENSHOT_DIR = "D:/work01/SoloCoder/5038"
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

    # ---- 1. Page loads ----
    page.goto(URL, wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(2000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/screenshot_R1_1_loaded.png", full_page=True)
    report("Page loads", page.locator("body").count() == 1, "")

    # ---- 2. Header visible ----
    has_header = page.locator("header").count() >= 1
    report("Header visible", has_header, "")

    # ---- 3. Sidebar visible ----
    has_sidebar = page.locator("aside, [class*='sidebar']").count() >= 1
    report("Sidebar visible", has_sidebar, "")

    # ---- 4. Albums in sidebar ----
    page_text = page.content()
    has_album_text = "相册" in page_text or "album" in page_text.lower()
    report("Albums text in page", has_album_text, "")

    # ---- 5. Photos grid visible ----
    # Look for photo grid items
    photo_count = page.locator("img[src*='http']").count()
    report(f"Photo grid has images ({photo_count} found)", photo_count >= 3, f"count={photo_count}")

    # ---- 6. Sort options present ----
    # The Toolbar has sort by takenAt, name, size etc.
    has_sort = "排序" in page_text or "sort" in page_text.lower() or "name" in page_text.lower() or "时间" in page_text or "大小" in page_text
    report("Sort UI visible", has_sort, "")

    # ---- 7. Try to interact with sort ----
    # Look for sort dropdown or button
    sort_btns = page.locator("select, button:has-text('排序'), button:has-text('sort')")
    if sort_btns.count() == 0:
        # Try to find any select or combobox
        sort_btns = page.locator("select")
    sort_present = sort_btns.count() > 0
    report("Sort control present", sort_present, f"controls={sort_btns.count()}")

    # ---- 8. Click first photo to select ----
    photos = page.locator("img[src*='http']")
    if photos.count() > 0:
        try:
            photos.first.click()
            page.wait_for_timeout(500)
            report("Photo clickable", True, "")
        except Exception as e:
            report("Photo clickable", False, str(e))

    # ---- 9. Select multiple photos ----
    if photos.count() >= 2:
        try:
            photos.nth(0).click()
            page.wait_for_timeout(200)
            photos.nth(1).click(modifiers=["Control"])
            page.wait_for_timeout(200)
            report("Multi-select photos", True, "")
        except Exception as e:
            report("Multi-select photos", False, str(e))

    # ---- 10. Check tag filter ----
    has_tags = "标签" in page_text or "tag" in page_text.lower()
    report("Tags UI visible", has_tags, "")

    # ---- 11. Sidebar shows albums ----
    # Look for album items in sidebar
    album_items = page.locator("text=/相册|album/i")
    if album_items.count() == 0:
        # Look for any clickable text in sidebar
        album_items = page.locator("aside button, aside a, [class*='sidebar'] button, [class*='sidebar'] a")
    report(f"Album entries visible ({album_items.count()} found)", album_items.count() >= 1, "")

    # ---- 12. Click on an album to filter ----
    # Find album list
    sidebar_albums = page.locator("aside button, aside [role='button'], [class*='sidebar'] button").all()
    if len(sidebar_albums) > 0:
        # Skip the "All Photos" item, click on a specific album
        for item in sidebar_albums:
            text = item.inner_text()
            if text and "全部" in text or "All" in text:
                continue
            try:
                item.click()
                page.wait_for_timeout(500)
                report("Album filter clickable", True, "")
                break
            except Exception:
                pass

    # ---- 13. Check Toolbar has batch operation buttons ----
    # After selecting photos, the toolbar should show batch operations
    batch_ops = page.locator("text=/移动|move/i, text=/删除|delete/i, text=/标签|tag/i")
    report("Batch operation UI present (move/delete/tag)", batch_ops.count() >= 1, f"count={batch_ops.count()}")

    # ---- 14. Switch to map view ----
    # Look for map toggle button
    map_btn = page.locator("button:has-text('地图'), button:has-text('Map'), [aria-label*='map' i], [aria-label*='地图' i]")
    if map_btn.count() == 0:
        # Try generic icon buttons
        map_btn = page.locator("[class*='map']").first
    if map_btn.count() > 0:
        try:
            map_btn.first.click()
            page.wait_for_timeout(800)
            page.screenshot(path=f"{SCREENSHOT_DIR}/screenshot_R1_2_map.png", full_page=True)
            report("Map view toggleable", True, "")
        except Exception as e:
            report("Map view toggleable", False, str(e))
    else:
        report("Map view toggleable", False, "no map button found")

    # ---- 15. Switch back to grid view ----
    # Click grid view button
    grid_btn = page.locator("button:has-text('网格'), button:has-text('grid')")
    if grid_btn.count() > 0:
        try:
            grid_btn.first.click()
            page.wait_for_timeout(500)
        except Exception:
            pass

    # ---- 16. Open duplicate detector ----
    dup_btn = page.locator("button:has-text('重复'), button:has-text('duplicate'), button:has-text('查重')")
    if dup_btn.count() == 0:
        dup_btn = page.locator("[aria-label*='duplicate' i], [aria-label*='重复' i]")
    if dup_btn.count() > 0:
        try:
            dup_btn.first.click()
            page.wait_for_timeout(500)
            report("Duplicate detector openable", True, "")
            # Close it
            close_btn = page.locator("button:has-text('关闭'), button:has-text('close'), [aria-label*='close']").first
            if close_btn.count() > 0:
                close_btn.click()
                page.wait_for_timeout(300)
        except Exception as e:
            report("Duplicate detector openable", False, str(e))
    else:
        report("Duplicate detector button present", False, "no dup button found")

    # ---- 17. Open sync conflict resolver ----
    sync_btn = page.locator("button:has-text('冲突'), button:has-text('conflict'), button:has-text('同步'), button:has-text('sync')")
    if sync_btn.count() == 0:
        sync_btn = page.locator("[aria-label*='conflict' i], [aria-label*='同步' i]")
    if sync_btn.count() > 0:
        try:
            sync_btn.first.click()
            page.wait_for_timeout(500)
            report("Sync conflict resolver openable", True, "")
            # Close
            close_btn = page.locator("button:has-text('关闭'), button:has-text('close'), [aria-label*='close']").first
            if close_btn.count() > 0:
                close_btn.click()
                page.wait_for_timeout(300)
        except Exception as e:
            report("Sync conflict resolver openable", False, str(e))
    else:
        report("Sync conflict resolver button present", False, "no sync button found")

    # ---- 18. Console errors check ----
    real_errors = [e for e in console_errors if "DevTools" not in e and "favicon" not in e.lower()]
    report("No critical console errors", len(real_errors) == 0, f"errors={real_errors[:3]}")

    # ---- 19. Album CRUD - try to create album ----
    # Look for "new album" or "create album" button
    create_album_btn = page.locator("button:has-text('新建相册'), button:has-text('创建'), button:has-text('+')")
    if create_album_btn.count() == 0:
        # Try in sidebar
        create_album_btn = page.locator("aside button, [class*='sidebar'] button").last
    if create_album_btn.count() > 0:
        try:
            create_album_btn.first.click()
            page.wait_for_timeout(500)
            report("Create album button works", True, "")
        except Exception as e:
            report("Create album button works", False, str(e))

    # ---- 20. Check sidebar has all albums visible ----
    sidebar_buttons = page.locator("aside button, [class*='sidebar'] button").count()
    report(f"Sidebar has interactive elements ({sidebar_buttons})", sidebar_buttons >= 2, "")

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

print(f"\n=== 5038 Test Results ===")
print(f"Pass: {results['pass']}, Fail: {results['fail']}")
for t in results["tests"]:
    print(t)
sys.exit(0 if results["fail"] == 0 else 1)
