const { chromium } = require('playwright');

async function runTest() {
  console.log('Starting Action Flow Test: Canteen POS Purchase...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER EXCEPTION:', err.message));

  // 1. Login
  console.log('Logging in...');
  await page.goto('http://localhost:3000/login');
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder="student@school.rw"]', 'admin@knottyschool.rw');
  await page.fill('input[type="password"]', 'Admin@2024');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // 2. Navigate to Canteen POS
  console.log('Navigating to Canteen POS...');
  await page.goto('http://localhost:3000/canteen');
  await page.waitForTimeout(2000);

  // 3. Scan Student Card
  console.log('Scanning student card...');
  await page.fill('input[placeholder="Card number or scan barcode…"]', 'KNT-KMS-2026-00001');
  await page.click('button:has-text("Scan")');
  await page.waitForTimeout(2000);

  // Verify student info is displayed
  const bodyText = await page.innerText('body');
  if (bodyText.includes('Jean Hirwa') || bodyText.includes('Marie Uwase') || bodyText.includes('Hirwa Jean')) {
    console.log('Student loaded successfully in Canteen POS.');
  } else {
    throw new Error('Failed to load student info after card scan.');
  }

  // 4. Add items to cart
  console.log('Adding Fanta to cart...');
  await page.fill('input[placeholder="Item name (e.g. Rice)"]', 'Fanta');
  await page.fill('input[placeholder="Price"]', '600');
  await page.click('button:has(svg):near(input[placeholder="Price"])');
  await page.waitForTimeout(500);

  console.log('Adding Samosa to cart...');
  await page.fill('input[placeholder="Item name (e.g. Rice)"]', 'Samosa');
  await page.fill('input[placeholder="Price"]', '400');
  await page.click('button:has(svg):near(input[placeholder="Price"])');
  await page.waitForTimeout(1000);

  // Verify total is 1000 RWF
  const totalText = await page.innerText('body');
  if (totalText.includes('1,000') || totalText.includes('1000')) {
    console.log('Cart total verified: 1000 RWF');
  } else {
    throw new Error('Cart total does not match expected 1000 RWF');
  }

  // 5. Checkout (Charge)
  console.log('Processing payment (charging wallet)...');
  await page.click('button:has-text("Charge")');
  await page.waitForTimeout(3000);

  // Verify transaction listed in today's report
  console.log('Verifying transaction in report...');
  const reportText = await page.innerText('body');
  if (reportText.includes('-1,000') || reportText.includes('-1000')) {
    console.log('SUCCESS: Canteen purchase completed and listed in today\'s report!');
  } else {
    throw new Error('FAILED: Purchase transaction not found in today\'s report.');
  }

  await browser.close();
  console.log('Canteen POS Action Test Completed Successfully!');
}

runTest().catch(err => {
  console.error('Canteen POS Action Test Failed:', err);
  process.exit(1);
});
