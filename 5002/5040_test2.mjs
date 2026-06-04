import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  
  await page.goto('http://127.0.0.1:5204/contracts/new', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  // Click 预览模板
  await page.locator('button:has-text("预览模板")').first().click();
  await page.waitForTimeout(800);
  
  // Get default template (residential)
  const defaultTitle = await page.locator('h3:has-text("合同模板预览")').first().textContent();
  console.log('Default template:', defaultTitle);
  
  // Change to commercial
  const sel = page.locator('select[name="templateType"]').first();
  if (await sel.count() > 0) {
    await sel.selectOption('commercial');
    await page.waitForTimeout(500);
    const newTitle = await page.locator('h3:has-text("合同模板预览")').first().textContent();
    console.log('After select commercial:', newTitle);
    
    // Get clause titles
    const clauses1 = await page.locator('h3:has-text("合同模板预览") ~ div .font-medium').allTextContents();
    console.log('Commercial clause count:', clauses1.length);
    
    // Change to office
    await sel.selectOption('office');
    await page.waitForTimeout(500);
    const officeTitle = await page.locator('h3:has-text("合同模板预览")').first().textContent();
    console.log('After select office:', officeTitle);
    const clauses2 = await page.locator('h3:has-text("合同模板预览") ~ div .font-medium').allTextContents();
    console.log('Office clause count:', clauses2.length);
  }
  
  await page.screenshot({ path: 'D:/work01/SoloCoder/5040/screenshot_R2_templates.png', timeout: 5000 });
  await browser.close();
})();
