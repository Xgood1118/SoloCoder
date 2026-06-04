import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  
  // Capture errors
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('console: ' + msg.text());
  });
  
  // Test 1: Load page
  console.log('--- Test 1: Load page ---');
  await page.goto('http://127.0.0.1:5203/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  console.log('  Page title:', await page.title());
  await page.screenshot({ path: 'D:/work01/SoloCoder/5038/screenshot_R2_1.png', timeout: 5000 });
  
  // Test 2: Click 重复照片检测 button
  console.log('--- Test 2: Click 重复照片检测 ---');
  const dupBtn = page.locator('button[title="重复照片检测"]').first();
  if (await dupBtn.count() > 0) {
    await dupBtn.click();
    await page.waitForTimeout(1000);
    // Check for dialog/modal
    const modal = await page.locator('[class*="fixed"][class*="inset-0"]').count();
    console.log('  Modal appeared:', modal > 0);
    await page.screenshot({ path: 'D:/work01/SoloCoder/5038/screenshot_R2_2_duplicate.png', timeout: 5000 });
  } else {
    console.log('  Button not found');
  }
  
  // Test 3: Click 同步冲突 button
  console.log('--- Test 3: Click 同步冲突 ---');
  const conflictBtn = page.locator('button[title="同步冲突"]').first();
  if (await conflictBtn.count() > 0) {
    await conflictBtn.click();
    await page.waitForTimeout(1000);
    const conflictModal = await page.locator('text=同步冲突处理').count();
    console.log('  Conflict modal title visible:', conflictModal > 0);
    const conflictItems = await page.locator('text=保留此版本').count();
    console.log('  Conflict items with 保留此版本 button:', conflictItems);
    await page.screenshot({ path: 'D:/work01/SoloCoder/5038/screenshot_R2_3_conflict.png', timeout: 5000 });
  } else {
    console.log('  Button not found');
  }
  
  console.log('--- Errors ---');
  if (errors.length === 0) {
    console.log('  No errors');
  } else {
    for (const e of errors.slice(0, 5)) {
      console.log('  ' + e.substring(0, 100));
    }
  }
  
  await browser.close();
})();
