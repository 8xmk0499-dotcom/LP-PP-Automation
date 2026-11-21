const { chromium } = require('playwright');

async function testRouteInterception() {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled', '--start-maximized'] });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  page.on('dialog', async d => await d.accept('gpl@123'));

  let capturedApiBody = null;
  let capturedApiPayload = null;

  await page.route('**/api/**', async route => {
    const req = route.request();
    const postData = req.postData();
    if (postData) {
      capturedApiPayload = postData;
    }
    const response = await route.fetch();
    try {
      const text = await response.text();
      capturedApiBody = text;
      console.log('Intercepted via route:', req.url());
      console.log('Captured Body:', text);
    } catch (e) {
      console.log('Error reading route body:', e.message);
    }
    await route.fulfill({ response });
  });

  await page.goto('https://www.godrejproperties.com/landing-page/pune/residential/godrej-park-world-2/', { waitUntil: 'load', timeout: 35000 });
  await page.waitForTimeout(4000);

  // Close popup
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a, div, span')).filter(el => {
      const cls = (el.className || '').toString().toLowerCase();
      const txt = (el.innerText || '').trim();
      return (cls.includes('close') || txt === '×' || txt === 'x') && el.offsetParent !== null;
    });
    if (btns.length > 0) btns[0].click();
  });

  const form = page.locator('#frmContactus');
  await form.scrollIntoViewIfNeeded();

  await form.locator('#txt_firstname').fill('Test');
  await form.locator('#txt_mobile').fill('9860098300');
  await form.locator('#txt_email').fill('testlead' + Math.floor(Math.random() * 90000 + 10000) + '@gmail.com');

  const proj = form.locator('#txt_project');
  if (await proj.isVisible()) await proj.selectOption({ index: 1 });

  const cb = form.locator('#whatsapp_check');
  if (await cb.isVisible()) await cb.check({ force: true });

  await page.waitForTimeout(1000);
  console.log('Clicking Submit...');
  await form.locator('#btnSubmitContactForm').click();

  await page.waitForTimeout(6000);
  console.log('FINAL CAPTURED BODY:', capturedApiBody);
  console.log('FINAL CAPTURED PAYLOAD:', capturedApiPayload);
  await browser.close();
}

testRouteInterception();
