const { chromium } = require('playwright');

async function runTest() {
  console.log('Starting Action Flow Test: Student Enrollment...');
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

  // 2. Go to Students Directory
  console.log('Navigating to Students page...');
  await page.goto('http://localhost:3000/students');
  await page.waitForTimeout(3000);

  // 3. Open modal
  console.log('Opening "Add Student" modal...');
  await page.click('text="Add Student"');
  await page.waitForTimeout(1000);

  const rand = Math.floor(Math.random() * 100000);
  const firstName = `Action${rand}`;
  const lastName = 'Test';
  const email = `action.test.${rand}@knottyschool.rw`;

  // 4. Fill Basic Info
  console.log('Filling basic information...');
  await page.fill('input[placeholder="e.g. Ange"]', firstName);
  await page.fill('input[placeholder="e.g. Uwimana"]', lastName);
  
  // Clear and fill email
  const emailInput = page.locator('input[placeholder="student@school.rw"]');
  await emailInput.fill(email);

  // Select Level and Class
  console.log('Selecting Level and Class...');
  await page.locator('div:has(> label:has-text("Level")) select').selectOption('level-s5-seed');
  await page.waitForTimeout(500);
  await page.locator('div:has(> label:has-text("Class")) select').selectOption('class-s5a-seed');

  await page.fill('input[placeholder="0"]', '5000');
  await page.fill('input[type="password"]', 'Student@2024');

  // 5. Fill Parent/Guardian Info
  console.log('Navigating to Parent/Guardian tab...');
  await page.click('text="Parent/Guardian"');
  await page.waitForTimeout(500);

  await page.fill('input[placeholder="e.g. Jean Baptiste Nkusi"]', 'Guardian Test');
  await page.fill('input[placeholder="+250 7XX XXX XXX"]', '+250788444444');

  // 6. Submit form
  console.log('Submitting the form...');
  await page.click('button[type="submit"]:has-text("Enroll Student")');
  await page.waitForTimeout(3000);

  // 7. Verify enrollment in directory
  console.log('Verifying student in list...');
  await page.fill('input[placeholder="Search students…"]', `${firstName} ${lastName}`);
  await page.waitForTimeout(2000);

  const bodyText = await page.innerText('body');
  if (bodyText.includes(`${firstName} ${lastName}`)) {
    console.log(`SUCCESS: Enrolled student ${firstName} ${lastName} found in the directory!`);
  } else {
    throw new Error(`FAILED: Enrolled student ${firstName} ${lastName} not found in directory`);
  }

  await browser.close();
  console.log('Action Flow Test Completed Successfully!');
}

runTest().catch(err => {
  console.error('Action Flow Test Failed:', err);
  process.exit(1);
});
