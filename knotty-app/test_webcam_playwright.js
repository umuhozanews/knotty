const { chromium } = require('playwright');

async function main() {
  console.log('Launching browser with fake webcam args...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream'
    ]
  });
  const context = await browser.newContext({
    permissions: ['camera']
  });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER EXCEPTION:', err.message, err.stack));

  console.log('Navigating to login page...');
  await page.goto('http://localhost:3000/login');
  await page.waitForTimeout(1000);
  
  console.log('Entering credentials...');
  await page.fill('input[type="text"]', 'admin@knottyschool.rw');
  await page.fill('input[type="password"]', 'Admin@2024');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  console.log('Navigating to attendance page...');
  await page.goto('http://localhost:3000/attendance');
  await page.waitForTimeout(2000);

  console.log('Selecting a class...');
  await page.selectOption('select', { index: 1 });
  await page.waitForTimeout(1000);

  console.log('Clicking START WEBCAM SCANNER...');
  await page.click('text=START WEBCAM SCANNER');
  
  // Wait for 10 seconds to let the fake video stream play and see if any error is thrown
  await page.waitForTimeout(10000);

  console.log('Current URL:', page.url());
  await page.screenshot({ path: 'C:/Users/user/Desktop/KNOTTY/webcam_screenshot.png' });
  console.log('Screenshot saved to webcam_screenshot.png');

  await browser.close();
  console.log('Done!');
}

main().catch(console.error);
