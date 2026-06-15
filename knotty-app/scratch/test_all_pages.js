const { chromium } = require('playwright');
const path = require('path');

async function runTest() {
  console.log('Starting Playwright test of all KNOTTY system pages...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  // Capture all console logs and page errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('BROWSER CONSOLE ERROR:', msg.text());
      consoleErrors.push(msg.text());
    } else {
      console.log('BROWSER CONSOLE:', msg.text());
    }
  });

  page.on('pageerror', err => {
    console.error('BROWSER EXCEPTION:', err.message);
    consoleErrors.push(err.message);
  });

  // 1. Login
  console.log('\n--- Logging in ---');
  await page.goto('http://localhost:3000/login');
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder="student@school.rw"]', 'admin@knottyschool.rw');
  await page.fill('input[type="password"]', 'Admin@2024');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  if (page.url() === 'http://localhost:3000/login') {
    throw new Error('Login failed: Still on login page');
  }
  console.log('Logged in successfully, current URL:', page.url());

  // Pages to test
  const pages = [
    { name: 'Dashboard', path: '/' },
    { name: 'Students Directory', path: '/students' },
    { name: 'Attendance', path: '/attendance' },
    { name: 'Academics Portal', path: '/academics' },
    { name: 'Gate Access Control', path: '/gate-access' },
    { name: 'Library Catalog', path: '/library' },
    { name: 'Syllabus Materials', path: '/materials' },
    { name: 'Report Cards', path: '/reports' },
    { name: 'Discipline Registry', path: '/discipline' },
    { name: 'Clinic & Health', path: '/health' },
    { name: 'Fee Management', path: '/fees' },
    { name: 'Canteen POS', path: '/canteen' },
    { name: 'School Settings', path: '/settings' }
  ];

  for (const p of pages) {
    console.log(`\n--- Testing page: ${p.name} (${p.path}) ---`);
    await page.goto(`http://localhost:3000${p.path}`);
    await page.waitForTimeout(2000);
    
    // Check if page loaded correctly (no generic error screen)
    const bodyText = await page.innerText('body');
    if (bodyText.includes('Internal Server Error') || bodyText.includes('Application error') || bodyText.includes('failed to fetch')) {
      throw new Error(`Page ${p.name} failed to load or has server error text.`);
    }

    console.log(`Page ${p.name} loaded successfully.`);
  }

  console.log('\n--- All pages loaded without crashing! ---');
  if (consoleErrors.length > 0) {
    console.log(`Found ${consoleErrors.length} browser errors/warnings during run.`);
  } else {
    console.log('No browser errors or exceptions detected!');
  }

  await browser.close();
  console.log('Test completed successfully!');
}

runTest().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
