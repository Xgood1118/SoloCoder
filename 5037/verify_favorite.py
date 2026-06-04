"""Verify favorite button clickability issue."""
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:5137/"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})
    page.goto(URL, wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(2000)

    # Click first recipe
    page.locator("a[href*='/recipe/']").first.click()
    page.wait_for_url("**/recipe/**", timeout=10000)
    page.wait_for_timeout(1500)

    # Check z-index of heart button's parent (fixed bottom action bar) vs bottom nav
    z_info = page.evaluate("""() => {
        const heart = document.querySelector('svg.lucide-heart');
        if (!heart) return {error: 'no heart found'};
        const actionBar = heart.closest('.fixed');
        const nav = document.querySelector('nav.fixed');

        const getZ = (el) => el ? window.getComputedStyle(el).zIndex : 'not-found';
        const getRect = (el) => el ? el.getBoundingClientRect() : null;

        return {
            heart_visible: heart.offsetParent !== null,
            actionBar_class: actionBar?.className,
            actionBar_zIndex: getZ(actionBar),
            actionBar_rect: getRect(actionBar),
            nav_class: nav?.className,
            nav_zIndex: getZ(nav),
            nav_rect: getRect(nav),
            viewport_height: window.innerHeight,
        };
    }""")

    print("Z-index analysis:")
    for k, v in z_info.items():
        print(f"  {k}: {v}")

    # Try to click the heart button
    try:
        page.locator("svg.lucide-heart").first.click(timeout=3000)
        print("Heart click: SUCCESS")
    except Exception as e:
        print(f"Heart click: FAILED - {str(e)[:200]}")

    page.screenshot(path="D:/work01/SoloCoder/5037/screenshot_favorite_zindex.png", full_page=True)
    browser.close()
