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
    console.log('Dialog prompt:', dialog.message());
    await dialog.accept('gpl@123');
  });

  page.on('response', async res => {
    const url = res.url();
    if (res.request().method() === 'POST' || url.includes('lead') || url.includes('enquiry') || url.includes('submit') || url.includes('salesforce') || url.includes('c360a')) {
      try {
        const text = await res.text();
        if (text && text.length > 5 && !url.includes('.js') && !url.includes('.css')) {
          console.log('\n[RESPONSE] URL:', url);
          console.log('[RESPONSE] Status:', res.status());
          console.log('[RESPONSE] Body:', text.substring(0, 400));
        }
      } catch {}
    }
  });

  await page.goto('https://www.godrejproperties.com/landing-page/pune/residential/godrej-park-world-2/', { waitUntil: 'load', timeout: 35000 });
  await page.waitForTimeout(4000);

  // Check popups first!
  const closed = await page.evaluate(() => {
    const closeBtns = Array.from(document.querySelectorAll('button, a, div, span')).filter(el => {
      const cls = (el.className || '').toString().toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      const txt = (el.innerText || '').trim().toLowerCase();
      return (cls.includes('close') || aria.includes('close') || txt === '×' || txt === 'close') && el.offsetParent !== null;
    });
    if (closeBtns.length > 0) {
      (closeBtns[0]).click();
      return true;
    }
    return false;
  });
  console.log('Popup closed?', closed);

  // Find frmContactus
  const form = page.locator('#frmContactus, form').first();
  await form.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  // Inspect form submission handler
  const formHtml = await form.evaluate(el => ({
    id: el.id,
    action: el.action,
    onsubmit: el.getAttribute('onsubmit'),
    btn: el.querySelector('button[type="submit"], input[type="submit"]')?.outerHTML
  }));
  console.log('Form HTML:', formHtml);

  // Fill fields
  const nameLoc = form.locator('input[name="txt_firstname"], input[placeholder*="Name" i]').first();
  await nameLoc.fill('Test Tester');

  const mobileLoc = form.locator('input[name="txt_mobile"], input[type="tel"]').first();
  await mobileLoc.fill('9860098300');

  const emailLoc = form.locator('input[name="txt_email"], input[type="email"]').first();
  await emailLoc.fill('testlead' + Math.floor(Math.random() * 90000 + 10000) + '@gmail.com');

  const projSelect = form.locator('select[name="txt_project"]').first();
  if (await projSelect.isVisible()) {
    await projSelect.selectOption({ index: 1 });
  }

  const countrySelect = form.locator('select[name="txt_country"]').first();
  if (await countrySelect.isVisible()) {
    await countrySelect.selectOption({ index: 1 });
  }

  const whatsappCb = form.locator('input[name="whatsapp_check"]').first();
  if (await whatsappCb.isVisible()) {
    await whatsappCb.check({ force: true });
  }

  await page.waitForTimeout(1000);

  console.log('Clicking Submit button...');
  const submitBtn = form.locator('button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("SUBMIT")').first();
  await submitBtn.click();

  await page.waitForTimeout(8000);
  console.log('Current URL after submit:', page.url());

  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('Page text snippet:', pageText.replace(/\n+/g, ' '));

  await browser.close();
}

testSubmit();
