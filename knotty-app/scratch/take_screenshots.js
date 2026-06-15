const { chromium } = require('playwright');
const path = require('path');

async function main() {
  console.log('Launching browser to capture screenshots...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER EXCEPTION:', err.message));

  console.log('Logging in...');
  await page.goto('http://localhost:3000/login');
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder="student@school.rw"]', 'admin@knottyschool.rw');
  await page.fill('input[type="password"]', 'Admin@2024');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  // 1. Dashboard
  console.log('Capturing Dashboard screenshot...');
  await page.screenshot({ path: 'C:/Users/user/Desktop/KNOTTY/dashboard_screenshot.png', fullPage: false });
  console.log('Dashboard screenshot saved to C:/Users/user/Desktop/KNOTTY/dashboard_screenshot.png');

  // 2. Academics
  console.log('Navigating to Academics...');
  await page.goto('http://localhost:3000/academics');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/Users/user/Desktop/KNOTTY/academics_screenshot.png', fullPage: false });
  console.log('Academics screenshot saved to C:/Users/user/Desktop/KNOTTY/academics_screenshot.png');

  // 3. Library
  console.log('Navigating to Library...');
  await page.goto('http://localhost:3000/library');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/Users/user/Desktop/KNOTTY/library_screenshot.png', fullPage: false });
  console.log('Library screenshot saved to C:/Users/user/Desktop/KNOTTY/library_screenshot.png');

  // 4. Canteen
  console.log('Navigating to Canteen POS...');
  await page.goto('http://localhost:3000/canteen');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/Users/user/Desktop/KNOTTY/canteen_screenshot.png', fullPage: false });
  console.log('Canteen screenshot saved to C:/Users/user/Desktop/KNOTTY/canteen_screenshot.png');

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch(console.error);
