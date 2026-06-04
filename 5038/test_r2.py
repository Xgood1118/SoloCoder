import asyncio
import json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context()
        page = await ctx.new_page()

        console_errors = []
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

        # Load the app
        await page.goto("http://127.0.0.1:5203/", wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_timeout(2000)
        await page.screenshot(path="D:/work01/SoloCoder/5038/screenshot_R2_1_load.png", timeout=5000)
        print("LOAD OK")

        # Find Header buttons - "重复照片检测" and "同步冲突"
        # Try to find them
        duplicate_btn = page.get_by_text("重复照片检测", exact=False).first
        conflict_btn = page.get_by_text("同步冲突", exact=False).first

        dup_visible = await duplicate_btn.is_visible()
        conf_visible = await conflict_btn.is_visible()
        print(f"duplicate_btn visible: {dup_visible}, conflict_btn visible: {conf_visible}")

        # Click duplicate button
        try:
            await duplicate_btn.click(timeout=3000)
            await page.wait_for_timeout(1000)
            # Check if a modal opened
            modal_text = await page.locator("text=重复").count()
            print(f"After click duplicate: {modal_text} elements with 重复")
            await page.screenshot(path="D:/work01/SoloCoder/5038/screenshot_R2_2_dup.png", timeout=5000)
            # Close
            close_btns = page.locator("button:has-text('关闭'), button:has-text('完成'), button:has(svg)").first
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(500)
        except Exception as e:
            print(f"duplicate click err: {e}")

        # Click conflict button
        try:
            await conflict_btn.click(timeout=3000)
            await page.wait_for_timeout(1000)
            modal_text = await page.locator("text=冲突").count()
            print(f"After click conflict: {modal_text} elements with 冲突")
            await page.screenshot(path="D:/work01/SoloCoder/5038/screenshot_R2_3_conf.png", timeout=5000)
        except Exception as e:
            print(f"conflict click err: {e}")

        # Look for "开始同步" or any sync trigger
        sync_btns = await page.locator("button:has-text('开始同步'), button:has-text('同步'), button:has-text('刷新'), button:has-text('上传')").count()
        print(f"Sync trigger buttons found: {sync_btns}")

        # Check if there are buttons in the conflict modal that could trigger new conflicts
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(500)

        # Check Header.tsx and App.tsx for "开始同步" text
        with open("D:/work01/SoloCoder/5038/src/components/Header.tsx", "r", encoding="utf-8") as f:
            header = f.read()
        with open("D:/work01/SoloCoder/5038/src/App.tsx", "r", encoding="utf-8") as f:
            app = f.read()
        with open("D:/work01/SoloCoder/5038/src/store/AppContext.tsx", "r", encoding="utf-8") as f:
            ctx_f = f.read()

        for keyword in ["开始同步", "同步", "Sync", "sync"]:
            for name, content in [("Header", header), ("App", app), ("Context", ctx_f)]:
                if keyword in content:
                    print(f"  {name}.tsx contains '{keyword}'")

        print(f"console errors: {len(console_errors)}")
        for e in console_errors[:5]:
            print(f"  - {e[:200]}")

        await browser.close()

asyncio.run(main())
