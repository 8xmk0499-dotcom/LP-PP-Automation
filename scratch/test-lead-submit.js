const { chromium } = require('playwright');

async function testSubmitLead() {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled', '--start-maximized'] });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  page.on('dialog', async d => await d.accept('gpl@123'));

  page.on('request', req => {
    if (req.method() === 'POST') {
      const pd = req.postData() || '';
      if (pd.includes('9860098300') || pd.includes('Test') || req.url().includes('lead') || req.url().includes('enquiry')) {
        console.log('\n[SUBMIT REQUEST] URL:', req.url());
        console.log('[SUBMIT REQUEST] Payload:', pd);
      }
    }
  });

  page.on('response', async res => {
    const req = res.request();
    if (req.method() === 'POST') {
      try {
        const text = await res.text();
        if (text && (text.includes('ENQ') || text.includes('a1u') || text.includes('Id') || text.includes('success') || text.includes('Name') || res.url().includes('lead') || res.url().includes('enquiry'))) {
          console.log('\n[SUBMIT RESPONSE] URL:', res.url(), 'Status:', res.status());
          console.log('[SUBMIT RESPONSE] Body:', text);
        }
      } catch {}
    }
  });

  await page.goto('https://www.godrejproperties.com/landing-page/pune/residential/godrej-park-world-2/', { waitUntil: 'load', timeout: 35000 });
  await page.waitForTimeout(4000);

  // Close any popups
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a, div.close, span.close')).filter(el => {
      const cls = (el.className || '').toString().toLowerCase();
      const txt = (el.innerText || '').trim();
      return (cls.includes('close') || txt === '×' || txt === 'x') && el.offsetParent !== null;
    });
    if (btns.length > 0) btns[0].click();
  });

  // Fill frmContactus
  const form = page.locator('#frmContactus');
  await form.scrollIntoViewIfNeeded();

  await form.locator('#txt_firstname').fill('Test');
  await page.waitForTimeout(300);

  await form.locator('#txt_mobile').fill('9860098300');
  await page.waitForTimeout(300);

  await form.locator('#txt_email').fill('testlead' + Math.floor(Math.random() * 90000 + 10000) + '@gmail.com');
  await page.waitForTimeout(300);

  const proj = form.locator('#txt_project');
  if (await proj.isVisible()) {
    await proj.selectOption({ index: 1 });
  }
  await page.waitForTimeout(300);

  const cb = form.locator('#whatsapp_check');
  if (await cb.isVisible()) {
    await cb.check({ force: true });
  }
  await page.waitForTimeout(1000);

  console.log('Submitting form via #btnSubmitContactForm...');
  await form.locator('#btnSubmitContactForm').click();

  await page.waitForTimeout(8000);
  console.log('After submit URL:', page.url());

  await browser.close();
}

testSubmitLead();
