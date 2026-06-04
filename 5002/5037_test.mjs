import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  
  // Capture network requests to verify cloud sync
  const nonLocalRequests = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith('http://127.0.0.1:5201') && !url.startsWith('data:') && !url.startsWith('blob:')) {
      nonLocalRequests.push({ method: req.method(), url: url });
    }
  });
  
  // Test 1: Open shopping list page
  console.log('--- Test 1: Shopping list page ---');
  await page.goto('http://127.0.0.1:5201/shopping-list', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  // Check for "已同步" indicator
  const syncIndicator = await page.locator('text=已同步').count();
  console.log('  "已同步" text count:', syncIndicator);
  
  // Check Cloud icon
  const cloudIcon = await page.locator('svg.lucide-cloud, [class*="cloud"]').count();
  console.log('  Cloud icon count:', cloudIcon);
  
  // Add an item
  const inputName = page.locator('input[placeholder*="商品"], input[placeholder*="名称"], input[placeholder*="输入"]').first();
  if (await inputName.count() > 0) {
    await inputName.fill('测试商品_xyz');
    const addBtn = page.locator('button:has-text("添加")').first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await page.waitForTimeout(500);
    }
  }
  
  await page.screenshot({ path: 'D:/work01/SoloCoder/5037/screenshot_R2_1_shoppinglist.png', timeout: 5000 });
  console.log('  Saved screenshot: screenshot_R2_1_shoppinglist.png');
  
  // Test 2: Click BottomNav 购物清单 tab
  console.log('--- Test 2: BottomNav 购物清单 tab ---');
  await page.goto('http://127.0.0.1:5201/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const shoppingTab = page.locator('a[href="/shopping-list"]:has-text("购物清单")').first();
  if (await shoppingTab.count() > 0) {
    await shoppingTab.click();
    await page.waitForTimeout(1500);
    console.log('  Current URL:', page.url());
    const has404 = await page.locator('text=404').count();
    const hasNotFound = await page.locator('text=找不到').count();
    console.log('  404 visible:', has404 > 0, '| 找不到:', hasNotFound > 0);
  } else {
    console.log('  BottomNav 购物清单 tab NOT found with href=/shopping-list');
    // List all tabs
    const allLinks = await page.locator('nav a').all();
    for (const link of allLinks) {
      const href = await link.getAttribute('href');
      const text = await link.textContent();
      console.log('    Tab:', href, '|', text);
    }
  }
  
  // Test 3: Recipe detail page bottom action bar
  console.log('--- Test 3: Recipe detail page action bar ---');
  await page.goto('http://127.0.0.1:5201/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  // Find a recipe link
  const recipeLink = page.locator('a[href*="/recipe/"]').first();
  if (await recipeLink.count() > 0) {
    await recipeLink.click();
    await page.waitForTimeout(2000);
    console.log('  Recipe URL:', page.url());
    
    // Check the bottom action bar (Heart, ThumbsUp, MessageSquare, ShoppingCart)
    const heartBtn = page.locator('button:has(svg.lucide-heart)').first();
    const heartCount = await heartBtn.count();
    console.log('  Heart btn count:', heartCount);
    
    if (heartCount > 0) {
      const heartBox = await heartBtn.boundingBox();
      console.log('  Heart btn position:', heartBox);
      
      // Get BottomNav position
      const bottomNav = page.locator('nav').first();
      const navBox = await bottomNav.boundingBox();
      console.log('  BottomNav position:', navBox);
      
      // Check if Heart is overlapping with BottomNav
      if (heartBox && navBox) {
        const overlap = (heartBox.y + heartBox.height) > navBox.y;
        console.log('  Heart overlaps with BottomNav?', overlap);
      }
      
      // Click Heart
      try {
        await heartBtn.click({ timeout: 3000 });
        await page.waitForTimeout(500);
        console.log('  Heart click: SUCCESS');
      } catch (e) {
        console.log('  Heart click FAILED:', e.message.substring(0, 100));
      }
    }
    
    await page.screenshot({ path: 'D:/work01/SoloCoder/5037/screenshot_R2_2_recipe.png', timeout: 5000 });
    console.log('  Saved screenshot: screenshot_R2_2_recipe.png');
  } else {
    console.log('  No recipe link found on home page');
  }
  
  // Test 4: Check network requests for cloud sync
  console.log('--- Test 4: Network requests for cloud sync ---');
  console.log('  Non-local requests:', nonLocalRequests.length);
  const postPut = nonLocalRequests.filter(r => r.method === 'POST' || r.method === 'PUT');
  console.log('  POST/PUT requests:', postPut.length);
  for (const r of postPut) {
    console.log('    ', r.method, r.url);
  }
  
  await browser.close();
})();
