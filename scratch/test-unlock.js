const { chromium } = require('playwright');

async function test() {
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

  let promptShown = false;
  let promptMsg = '';
  page.on('dialog', async dialog => {
    console.log('Dialog opened:', dialog.type(), dialog.message());
    promptShown = true;
    promptMsg = dialog.message();
    await dialog.accept('gpl@123');
  });

  page.on('request', req => {
    if (req.method() === 'POST' || req.url().includes('lead') || req.url().includes('enquiry')) {
      console.log('Intercepted Request POST:', req.url(), req.postData()?.substring(0, 200));
    }
  });

  page.on('response', async res => {
    if (res.request().method() === 'POST' || res.url().includes('lead') || res.url().includes('enquiry')) {
      try {
        const t = await res.text();
        console.log('Intercepted Response:', res.status(), t.substring(0, 300));
      } catch {}
    }
  });

  try {
    await page.goto('https://www.godrejproperties.com/landing-page/pune/residential/godrej-park-world-2/', {
      waitUntil: 'load',
      timeout: 35000
    });
  } catch (e) {
    console.log('Nav error:', e.message);
  }

  await page.waitForTimeout(4000);
  console.log('Prompt Shown?', promptShown, '| Prompt msg:', promptMsg);
  console.log('URL after entering password:', page.url());
  const title = await page.title();
  console.log('Page Title:', title);

  const info = await page.evaluate(() => {
    const forms = Array.from(document.querySelectorAll('form'));
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'));
    const buttons = Array.from(document.querySelectorAll('button, a')).filter(b => {
      const t = (b.innerText || '').toLowerCase();
      return t.includes('enquire') || t.includes('brochure') || t.includes('submit');
    }).map(b => b.innerText.trim());

    return {
      formsCount: forms.length,
      formsData: forms.map(f => ({
        id: f.id,
        action: f.action,
        fields: Array.from(f.querySelectorAll('input, select')).map(i => ({ name: i.name, id: i.id, placeholder: i.placeholder, type: i.type }))
      })),
      inputsCount: inputs.length,
      buttons
    };
  });

  console.log('Inspection Info after unlocking:', JSON.stringify(info, null, 2));

  // Check popups on page
  const popups = await page.evaluate(() => {
    const closeBtns = Array.from(document.querySelectorAll('button, a, div, span')).filter(el => {
      const cls = (el.className || '').toString().toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      const txt = (el.innerText || '').trim().toLowerCase();
      return cls.includes('close') || aria.includes('close') || txt === '×' || txt === 'x' || txt === 'close';
    });
    return closeBtns.map(b => ({
      tag: b.tagName,
      className: b.className,
      ariaLabel: b.getAttribute('aria-label'),
      text: b.innerText
    }));
  });
  console.log('Close buttons / popups found:', popups.slice(0, 5));

  await browser.close();
}

test();
