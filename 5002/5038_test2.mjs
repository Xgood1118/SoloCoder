import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  
  await page.goto('http://127.0.0.1:5203/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  // Test 1: Click 重复照片检测
  console.log('--- Test 1: 重复照片检测 ---');
  await page.locator('button[title="重复照片检测"]').first().click();
  await page.waitForTimeout(800);
  const dupVisible = await page.locator('text=重复照片检测').count();
  console.log('  DuplicateDetector visible:', dupVisible > 0);
  // Close modal
  const closeBtn = page.locator('button:has-text("关闭"), button:has-text("取消")').first();
  if (await closeBtn.count() > 0) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  } else {
    // Click outside modal
    await page.locator('div.fixed.inset-0').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);
  }
  
  // Test 2: Click 同步冲突
  console.log('--- Test 2: 同步冲突 ---');
  await page.locator('button[title="同步冲突"]').first().click();
  await page.waitForTimeout(800);
  const conflictVisible = await page.locator('text=同步冲突处理').count();
  console.log('  SyncConflictResolver visible:', conflictVisible > 0);
  const keepBtns = await page.locator('text=保留此版本').count();
  console.log('  Keep buttons:', keepBtns);
  
  // Test 3: Resolve a conflict
  if (keepBtns > 0) {
    await page.locator('text=保留此版本').first().click();
    await page.waitForTimeout(500);
    const stillVisible = await page.locator('text=同步冲突处理').count();
    console.log('  After resolve, modal still visible:', stillVisible > 0);
  }
  
  await page.screenshot({ path: 'D:/work01/SoloCoder/5038/screenshot_R2_conflict.png', timeout: 5000 });
  
  await browser.close();
})();
