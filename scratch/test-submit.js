const { chromium } = require('playwright');

async function testSubmit() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--start-maximized']
  });
  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  page.on('dialog', async dialog => {
    console.log('Dialog:', dialog.type(), dialog.message());
    await dialog.accept('gpl@123');
  });

  const capturedAPIs = [];

  page.on('request', req => {
    const method = req.method();
    const url = req.url();
    const postData = req.postData();
    if (method === 'POST') {
      console.log('===> POST Request URL:', url);
      if (postData) {
        console.log('POST Data snippet:', postData.substring(0, 300));
      }
    }
  });

  page.on('response', async res => {
    const req = res.request();
    if (req.method() === 'POST') {
      try {
        const text = await res.text();
        console.log('<=== POST Response URL:', res.url(), 'Status:', res.status());
        console.log('Response text snippet:', text.substring(0, 300));
        capturedAPIs.push({ url: res.url(), status: res.status(), body: text });
      } catch {}
    }
  });

  try {
    await page.goto('https://www.godrejproperties.com/landing-page/pune/residential/godrej-park-world-2/', {
      waitUntil: 'load',
      timeout: 35000
    });
  } catch (e) {
    console.log('Nav:', e.message);
  }

  await page.waitForTimeout(4000);

  // Fill frmContactus
  const form = page.locator('#frmContactus, form').first();
  if (await form.isVisible()) {
    console.log('Filling form...');
    const nameInput = form.locator('input[name*="name" i]').first();
    await nameInput.fill('Test Tester');

    const mobileInput = form.locator('input[name*="mobile" i]').first();
    await mobileInput.fill('9860098300');

    const emailInput = form.locator('input[name*="email" i]').first();
    await emailInput.fill('testlead991@gmail.com');

    const projectSelect = form.locator('select[name*="project" i]').first();
    if (await projectSelect.isVisible()) {
      await projectSelect.selectOption({ index: 1 });
    }

    const countrySelect = form.locator('select[name*="country" i]').first();
    if (await countrySelect.isVisible()) {
      await countrySelect.selectOption({ index: 1 });
    }

    const submitBtn = form.locator('button[type="submit"], input[type="submit"], button:has-text("SUBMIT"), button:has-text("Submit")').first();
    console.log('Clicking submit button...');
    await submitBtn.click();
    await page.waitForTimeout(6000);
  }

  console.log('Finished waiting. Captured API count:', capturedAPIs.length);
  await browser.close();
}

testSubmit();
