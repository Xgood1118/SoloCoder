import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
  
  await page.goto('http://127.0.0.1:5204/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  console.log('Page title:', await page.title());
  
  // Find Contracts link
  const contractLink = page.locator('a[href*="contract"], a:has-text("合同")').first();
  if (await contractLink.count() > 0) {
    await contractLink.click();
    await page.waitForTimeout(2000);
    console.log('Navigated to:', page.url());
  }
  
  // Find new contract button
  const newBtn = page.locator('button:has-text("新建"), button:has-text("创建"), a:has-text("新建"), a:has-text("创建")').first();
  if (await newBtn.count() > 0) {
    await newBtn.click();
    await page.waitForTimeout(1500);
    console.log('On new contract form');
    
    // Click 预览模板 button
    const previewBtn = page.locator('button:has-text("预览模板")').first();
    if (await previewBtn.count() > 0) {
      await previewBtn.click();
      await page.waitForTimeout(800);
      const previewVisible = await page.locator('text=合同模板预览').count();
      console.log('Template preview visible:', previewVisible > 0);
    }
  }
  
  await page.screenshot({ path: 'D:/work01/SoloCoder/5040/screenshot_R2_1.png', timeout: 5000 });
  console.log('Errors:', errors.length);
  if (errors.length) console.log('  ', errors.slice(0, 3));
  await browser.close();
})();
