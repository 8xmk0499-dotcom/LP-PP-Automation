const { chromium } = require('playwright');

async function inspectFormJs() {
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

  page.on('dialog', async dialog => {
    await dialog.accept('gpl@123');
  });

  await page.goto('https://www.godrejproperties.com/landing-page/pune/residential/godrej-park-world-2/', { waitUntil: 'load', timeout: 35000 });
  await page.waitForTimeout(3000);

  const formDetails = await page.evaluate(() => {
    const f = document.querySelector('#frmContactus') || document.querySelector('form');
    if (!f) return 'No form';
    return {
      id: f.id,
      action: f.action,
      onsubmit: f.getAttribute('onsubmit'),
      submitBtn: f.querySelector('button[type="submit"], input[type="submit"], button')?.outerHTML,
      innerHTML: f.innerHTML.substring(0, 500)
    };
  });

  console.log('Form details:', formDetails);
  await browser.close();
}

inspectFormJs();
