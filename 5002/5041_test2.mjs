import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
  
  // Go to register page
  await page.goto('http://127.0.0.1:4201/register', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  console.log('On register page:', page.url());
  
  // Try to register
  const emailInput = page.locator('input[type="email"]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  const nameInput = page.locator('input[type="text"]').first();
  
  if (await emailInput.count() > 0) {
    await emailInput.fill('test@example.com');
    await passwordInput.fill('testpass123');
    if (await nameInput.count() > 0) {
      await nameInput.fill('Test User');
    }
    // Click register
    const regBtn = page.locator('button[type="submit"], button:has-text("注册")').first();
    if (await regBtn.count() > 0) {
      await regBtn.click();
      await page.waitForTimeout(3000);
      console.log('After register, URL:', page.url());
      // Get error if any
      const errorText = await page.locator('.error, [class*="error"]').allTextContents();
      console.log('Error messages:', errorText.slice(0, 3));
    }
  }
  
  await page.screenshot({ path: 'D:/work01/SoloCoder/5041/screenshot_R1_3.png', timeout: 5000 });
  
  console.log('Page errors:', errors.length);
  for (const e of errors.slice(0, 3)) {
    console.log('  ', e.substring(0, 200));
  }
  await browser.close();
})();
