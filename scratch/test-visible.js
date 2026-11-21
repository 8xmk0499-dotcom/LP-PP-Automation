const { chromium } = require('playwright');

async function testVisible() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--start-maximized']
  });
  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

  page.on('dialog', async dialog => {
    console.log('Dialog:', dialog.message());
    await dialog.accept('gpl@123');
  });

  await page.goto('https://www.godrejproperties.com/landing-page/pune/residential/godrej-park-world-2/', { waitUntil: 'load', timeout: 35000 });
  await page.waitForTimeout(4000);

  // Check which forms or CTA buttons are visible
  const report = await page.evaluate(() => {
    const isVisible = (el) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && el.offsetWidth > 0 && el.offsetHeight > 0;
    };

    const forms = Array.from(document.querySelectorAll('form')).map(f => ({
      id: f.id,
      visible: isVisible(f),
      inputs: Array.from(f.querySelectorAll('input, select, textarea')).map(i => ({
        id: i.id,
        name: i.name,
        type: i.type,
        visible: isVisible(i)
      }))
    }));

    const ctas = Array.from(document.querySelectorAll('button, a, input[type="button"]')).filter(b => {
      const txt = (b.innerText || (b).value || '').trim();
      return (txt.toLowerCase().includes('enquire') || txt.toLowerCase().includes('brochure') || txt.toLowerCase().includes('call') || txt.toLowerCase().includes('register')) && isVisible(b);
    }).map(b => ({
      text: (b.innerText || (b).value || '').trim(),
      tag: b.tagName,
      className: b.className
    }));

    return { forms, ctas };
  });

  console.log('Visible report:', JSON.stringify(report, null, 2));

  await browser.close();
}

testVisible();
