const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('dialog', async d => {
    await d.accept('gpl@123');
  });

  try {
    await page.goto('https://www.godrejproperties.com/landing-page/pune/residential/godrej-park-world-2/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const res = await page.evaluate(() => {
      // 1. Check all country dropdowns
      const countrySelects = Array.from(document.querySelectorAll('select')).filter(s =>
        s.id.toLowerCase().includes('country') ||
        s.name.toLowerCase().includes('country') ||
        Array.from(s.options).some(o => o.text.toLowerCase().includes('india'))
      ).map(s => ({
        id: s.id,
        name: s.name,
        options: Array.from(s.options).map(o => ({ text: o.text, value: o.value }))
      }));

      // 2. Check all country code or phone prefix inputs/elements
      const countryCodeElements = Array.from(document.querySelectorAll('input, select, span, div, button')).filter(el => {
        const str = ((el.id || '') + ' ' + (el.name || '') + ' ' + (el.className || '')).toLowerCase();
        return str.includes('countrycode') || str.includes('country-code') || str.includes('dial') || str.includes('iti');
      }).map(el => ({
        tag: el.tagName,
        id: el.id,
        name: el.name,
        class: el.className,
        value: el.value || el.innerText,
        placeholder: el.placeholder
      }));

      // 3. Check submit buttons / CTA buttons
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a.btn, [role="button"]')).map(b => ({
        tag: b.tagName,
        id: b.id,
        class: b.className,
        text: (b.innerText || b.value || '').trim(),
        type: b.type
      }));

      // 4. Check popup / modal elements
      const popups = Array.from(document.querySelectorAll('.modal, .popup, [role="dialog"], [class*="modal"], [class*="popup"]')).map(p => ({
        id: p.id,
        class: p.className,
        visible: window.getComputedStyle(p).display !== 'none'
      }));

      return { countrySelects, countryCodeElements, buttons, popups };
    });

    console.log('RESULTS:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
