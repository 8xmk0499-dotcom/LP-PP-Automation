const { chromium } = require('playwright');

async function testApiEnquiryResponse() {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled', '--start-maximized'] });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  page.on('dialog', async d => await d.accept('gpl@123'));

  page.on('response', async res => {
    if (res.url().includes('/api/enquiry')) {
      console.log('=== ENQUIRY API RESPONSE ===');
      console.log('Status:', res.status());
      try {
        const json = await res.json();
        console.log('JSON:', JSON.stringify(json, null, 2));
      } catch {
        const text = await res.text();
        console.log('Text:', text);
      }
    }
  });

  await page.goto('https://www.godrejproperties.com/landing-page/pune/residential/godrej-park-world-2/', { waitUntil: 'load', timeout: 35000 });
  await page.waitForTimeout(4000);

  // Close popup if any
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
  await form.locator('#btnSubmitContactForm').click();

  await page.waitForTimeout(6000);
  await browser.close();
}

testApiEnquiryResponse();
