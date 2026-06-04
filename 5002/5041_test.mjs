import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
  
  await page.goto('http://127.0.0.1:4201/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  console.log('Title:', await page.title());
  console.log('URL:', page.url());
  
  // Try to find login or register UI
  const html = await page.content();
  console.log('Has app-root:', html.includes('app-root'));
  console.log('Body text (first 200):', (await page.locator('body').textContent()).substring(0, 200));
  
  await page.screenshot({ path: 'D:/work01/SoloCoder/5041/screenshot_R1_1.png', timeout: 5000 });
  
  // Check for routes
  await page.goto('http://127.0.0.1:4201/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  console.log('After /login URL:', page.url());
  console.log('Login body:', (await page.locator('body').textContent()).substring(0, 200));
  
  await page.screenshot({ path: 'D:/work01/SoloCoder/5041/screenshot_R1_2.png', timeout: 5000 });
  
  console.log('Errors:', errors.length);
  for (const e of errors.slice(0, 5)) {
    console.log('  ', e.substring(0, 150));
  }
  await browser.close();
})();
