const { chromium } = require('playwright');

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER EXCEPTION:', err.message, err.stack));

  console.log('Navigating to login page...');
  await page.goto('http://localhost:3000/login');
  await page.waitForTimeout(1000);
  
  console.log('Entering credentials...');
  await page.fill('input[type="text"]', 'admin@knottyschool.rw');
  await page.fill('input[type="password"]', 'Admin@2024');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  console.log('Navigating to academics page...');
  await page.goto('http://localhost:3000/academics');
  await page.waitForTimeout(3000);

  console.log('Clicking "Timetable Scheduler" tab...');
  await page.click('text="Timetable Scheduler"');
  await page.waitForTimeout(3000);

  console.log('Saving screenshot...');
  await page.screenshot({ 
    path: 'C:/Users/user/.gemini/antigravity-cli/brain/7dc7457f-190a-42ba-92e5-1761ce504c72/timetable_screenshot.png',
    fullPage: true 
  });
  console.log('Screenshot saved successfully!');

  await browser.close();
  console.log('Done!');
}

main().catch(console.error);
