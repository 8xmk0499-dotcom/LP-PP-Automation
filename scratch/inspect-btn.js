const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('dialog', async d => await d.accept('gpl@123'));
  await page.goto('https://www.godrejproperties.com/landing-page/pune/residential/godrej-park-world-2/', { waitUntil: 'load', timeout: 35000 });
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => {
    const f = document.querySelector('#frmContactus');
    if (!f) return null;
    const btn = f.querySelector('button, input[type="submit"], a.btn, input[type="button"]');
    return {
      action: f.action,
      onsubmit: f.getAttribute('onsubmit'),
      btnHtml: btn ? btn.outerHTML : 'none'
    };
  });
  console.log('Form Info:', info);
  await browser.close();
}

test();
