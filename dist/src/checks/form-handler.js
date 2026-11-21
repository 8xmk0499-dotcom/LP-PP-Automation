"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverAndFillForms = discoverAndFillForms;
/**
 * Discovers lead forms and CTA buttons on the page.
 * Fills safe test data and captures interaction data.
 */
async function discoverAndFillForms(page, options = { fillForms: true, submitForms: false }) {
    const formsFound = [];
    let thankYouPageDetected = false;
    let thankYouUrl;
    // 1. Check if CTA button exists that opens a modal (e.g. "Enquire Now", "Book a Site Visit")
    try {
        const ctaSelectors = [
            'button:has-text("Enquire")',
            'a:has-text("Enquire")',
            'button:has-text("Book Site Visit")',
            'button:has-text("Download Brochure")',
            'a:has-text("Download Brochure")',
            'button:has-text("Request Callback")',
            'button:has-text("Register Interest")'
        ];
        for (const sel of ctaSelectors) {
            const cta = page.locator(sel).first();
            if (await cta.isVisible({ timeout: 1000 }).catch(() => false)) {
                // Only click if no forms are currently visible on page
                const formsCount = await page.locator('form:visible').count();
                if (formsCount === 0) {
                    await cta.click({ timeout: 2000 }).catch(() => { });
                    await page.waitForTimeout(1000);
                    break;
                }
            }
        }
    }
    catch { }
    // 2. Discover all forms on page
    try {
        const rawForms = await page.evaluate(() => {
            const forms = Array.from(document.querySelectorAll('form'));
            return forms.map((f, idx) => {
                const inputs = Array.from(f.querySelectorAll('input, select, textarea'));
                const fields = inputs.map(inp => {
                    const el = inp;
                    return {
                        name: el.name || el.id || `field_${idx}`,
                        type: el.type || el.tagName.toLowerCase(),
                        placeholder: el.placeholder || '',
                        value: el.value || ''
                    };
                });
                const submitBtn = f.querySelector('button[type="submit"], input[type="submit"], button:not([type="button"])');
                return {
                    formId: f.id || `form_${idx + 1}`,
                    formAction: f.action || window.location.href,
                    formClass: f.className || '',
                    fields,
                    ctaButtonText: submitBtn ? (submitBtn.textContent || submitBtn.value || '').trim() : 'Submit'
                };
            });
        });
        for (const rf of rawForms) {
            formsFound.push({
                ...rf,
                isFilled: false,
                submissionAttempted: false
            });
        }
    }
    catch { }
    // 3. Fill test data if enabled and visible form exists
    if (options.fillForms) {
        try {
            // Find visible inputs for Name, Email, Mobile
            const nameInput = page.locator('input[name*="name" i], input[placeholder*="name" i], input[id*="name" i]').first();
            if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
                await nameInput.fill('Test User');
            }
            const emailInput = page.locator('input[type="email"], input[name*="email" i], input[placeholder*="email" i]').first();
            if (await emailInput.isVisible({ timeout: 1000 }).catch(() => false)) {
                await emailInput.fill('test.automation@example.com');
            }
            const phoneInput = page.locator('input[type="tel"], input[name*="mobile" i], input[name*="phone" i], input[placeholder*="mobile" i]').first();
            if (await phoneInput.isVisible({ timeout: 1000 }).catch(() => false)) {
                await phoneInput.fill('9876543210');
            }
            // Mark forms as filled
            formsFound.forEach(f => f.isFilled = true);
            // 4. Optionally submit if user explicitly enabled it
            if (options.submitForms) {
                const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first();
                if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                    formsFound.forEach(f => f.submissionAttempted = true);
                    await submitBtn.click({ timeout: 2000 }).catch(() => { });
                    await page.waitForTimeout(3000);
                    // Check for thank you page or thank you modal
                    const currentUrl = page.url();
                    const pageText = await page.evaluate(() => document.body ? document.body.innerText.toLowerCase() : '');
                    if (currentUrl.includes('thank-you') ||
                        currentUrl.includes('thankyou') ||
                        pageText.includes('thank you for contacting') ||
                        pageText.includes('we will get in touch')) {
                        thankYouPageDetected = true;
                        thankYouUrl = currentUrl;
                    }
                }
            }
        }
        catch { }
    }
    return {
        formsFound,
        thankYouPageDetected,
        thankYouUrl
    };
}
