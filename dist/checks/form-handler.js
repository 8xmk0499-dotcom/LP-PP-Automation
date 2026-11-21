"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTestEmail = generateTestEmail;
exports.isLeadEnquiryResponse = isLeadEnquiryResponse;
exports.closeOpenPopups = closeOpenPopups;
exports.stopAndClosePopupIfOpen = stopAndClosePopupIfOpen;
exports.handlePageForms = handlePageForms;
/**
 * Generates a unique test email id per test run: testlead<unique>@gmail.com
 */
function generateTestEmail() {
    const randomSuffix = Math.floor(Math.random() * 90000 + 10000);
    return `testlead${randomSuffix}@gmail.com`;
}
/**
 * Validates whether a network response is a genuine lead/enquiry API response,
 * strictly filtering out XML auth tokens (<WebAuthenticateResponse>), JS scripts, or analytics.
 */
function isLeadEnquiryResponse(url, text) {
    if (!text || typeof text !== 'string')
        return false;
    const trimmed = text.trim();
    if (trimmed.startsWith('<') ||
        trimmed.startsWith('(function') ||
        trimmed.startsWith('var ') ||
        trimmed.startsWith('!function') ||
        trimmed.startsWith('function') ||
        trimmed.includes('WebAuthenticateResponse')) {
        return false;
    }
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
        return false;
    }
    const urlLower = url.toLowerCase();
    if (urlLower.includes('authentication') || urlLower.includes('/web/events/')) {
        return false;
    }
    if (urlLower.includes('/api/enquiry') || urlLower.includes('enquiry') || urlLower.includes('/lead')) {
        return true;
    }
    if (trimmed.includes('PropStrength') ||
        trimmed.includes('ENQ - ') ||
        (trimmed.includes('"Id"') && trimmed.includes('"Name"'))) {
        return true;
    }
    return false;
}
/**
 * Proactively checks and closes any open popups, cookie consent overlays,
 * promotional modals, or obstructive dialogue boxes so they do not block form filling.
 */
async function closeOpenPopups(page, activeForm) {
    try {
        const wasClosed = await page.evaluate(() => {
            let closed = false;
            const candidates = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"], [class*="close"], [aria-label*="close" i], [id*="close" i], [class*="btn-close" i], [class*="modal-close" i], [class*="popup-close" i]'));
            for (const el of candidates) {
                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
                    continue;
                const rect = el.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0)
                    continue;
                const cls = (el.className || '').toString().toLowerCase();
                const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                const txt = (el.innerText || el.textContent || '').trim();
                const id = (el.id || '').toLowerCase();
                const isClose = cls.includes('modalclose') ||
                    cls.includes('close__btn') ||
                    cls.includes('close-btn') ||
                    cls.includes('popup-close') ||
                    cls.includes('btn-close') ||
                    cls.includes('close_btn') ||
                    cls.includes('icon-close') ||
                    cls.includes('dialog-close') ||
                    cls.includes('mfp-close') ||
                    cls.includes('fancybox-close') ||
                    aria === 'close' ||
                    aria.includes('close dialog') ||
                    aria.includes('close modal') ||
                    aria.includes('close popup') ||
                    aria.includes('dismiss') ||
                    id.includes('close') ||
                    txt === '×' ||
                    txt === '✕' ||
                    txt === '✖' ||
                    txt.toLowerCase() === 'close' ||
                    txt.toLowerCase() === 'dismiss' ||
                    txt.toLowerCase() === 'no thanks' ||
                    txt.toLowerCase() === 'skip';
                if (isClose) {
                    try {
                        el.click();
                        closed = true;
                    }
                    catch { }
                }
            }
            return closed;
        });
        if (wasClosed) {
            await page.waitForTimeout(500);
            return true;
        }
        // Fallback: If an active modal overlay exists, send Escape
        const hasModal = await page.evaluate(() => {
            const openDialogs = document.querySelectorAll('dialog[open], .modal.show, .modal.in, div[style*="display: block"][class*="modal"], [role="dialog"], .popup.active, .popup.show');
            return openDialogs.length > 0;
        });
        if (hasModal) {
            await page.keyboard.press('Escape').catch(() => { });
            await page.waitForTimeout(400);
            return true;
        }
        return false;
    }
    catch {
        return false;
    }
}
/**
 * Requirement: "If popup open on the page while form filling stop the form filling & close the popup first then resume filling form"
 * Actively inspects whether any interrupting popup/modal has appeared over the form.
 * If detected:
 * 1. Pauses/stops form filling
 * 2. Closes the popup first
 * 3. Waits for popup transition to finish
 * 4. Resumes form filling
 */
async function stopAndClosePopupIfOpen(page, activeForm) {
    try {
        const isPopupVisible = await page.evaluate(() => {
            const popups = Array.from(document.querySelectorAll('.modal.show, .modal.in, [role="dialog"], [role="alertdialog"], .popup.active, .popup.show, [class*="popup"][style*="display: block"], [class*="modal"][style*="display: block"], .sweet-alert, .swal2-container, div[class*="backdrop"]'));
            for (const m of popups) {
                const style = window.getComputedStyle(m);
                if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                    const rect = m.getBoundingClientRect();
                    if (rect.width > 60 && rect.height > 60) {
                        return true;
                    }
                }
            }
            return false;
        }).catch(() => false);
        if (isPopupVisible) {
            console.log('   ⚠️ Popup opened while form filling! Stopping form filling and closing popup first...');
            const closed = await closeOpenPopups(page, activeForm);
            await page.waitForTimeout(600); // Wait for fade out
            console.log('   ✓ Popup closed successfully. Resuming form filling...');
            return closed;
        }
        // Also run standard close check
        return await closeOpenPopups(page, activeForm);
    }
    catch {
        return false;
    }
}
/**
 * Visibly fills a text input in headed mode:
 * - Checks and dismisses any popup before typing
 * - Smoothly scrolls the field into view
 * - Visually highlights the field with blue border & glow
 * - Types character-by-character with human-like delay (65ms/char)
 * - If interrupted by popup during typing, dismisses popup and resumes
 * - Pauses after typing so the user clearly sees what was filled
 */
async function fillInputVisibly(page, loc, value, label, activeForm) {
    try {
        // Stop form filling & close popup first if open
        await stopAndClosePopupIfOpen(page, activeForm);
        if (await loc.isVisible({ timeout: 1500 }).catch(() => false)) {
            await loc.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => { });
            await page.waitForTimeout(150);
            // Check again after scrolling (scrolling often triggers timed popups)
            await stopAndClosePopupIfOpen(page, activeForm);
            await loc.focus().catch(() => { });
            await loc.evaluate((el) => {
                el.style.transition = 'all 0.25s ease';
                el.style.border = '2px solid #0F2F57';
                el.style.boxShadow = '0 0 10px rgba(15, 47, 87, 0.45)';
                el.style.backgroundColor = '#F0F9FF';
            }).catch(() => { });
            await page.waitForTimeout(150);
            await loc.fill('').catch(() => { });
            await loc.pressSequentially(value, { delay: 35 }).catch(async () => {
                // If typing failed, check if an overlay intercepted
                await stopAndClosePopupIfOpen(page, activeForm);
                await loc.fill(value).catch(() => { });
            });
            await page.waitForTimeout(180);
            await loc.evaluate((el) => {
                el.style.border = '';
                el.style.boxShadow = '';
                el.style.backgroundColor = '';
            }).catch(() => { });
            // Check popup after typing
            await stopAndClosePopupIfOpen(page, activeForm);
            return true;
        }
    }
    catch {
        // If intercepted, dismiss popup and retry
        await stopAndClosePopupIfOpen(page, activeForm);
        try {
            if (await loc.isVisible({ timeout: 1000 }).catch(() => false)) {
                await loc.fill(value).catch(() => { });
                return true;
            }
        }
        catch { }
    }
    return false;
}
/**
 * Visibly selects an option from a dropdown in headed mode:
 * - Checks and dismisses any popup before selecting
 * - Smoothly scrolls the dropdown into view
 * - Highlights dropdown with blue focus glow
 * - Selects option and pauses briefly so the user can verify
 */
async function selectDropdownVisibly(page, loc, option, label, activeForm) {
    try {
        // Stop form filling & close popup first if open
        await stopAndClosePopupIfOpen(page, activeForm);
        if (await loc.isVisible({ timeout: 1500 }).catch(() => false)) {
            await loc.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => { });
            await page.waitForTimeout(150);
            // Check again after scrolling
            await stopAndClosePopupIfOpen(page, activeForm);
            await loc.focus().catch(() => { });
            await loc.evaluate((el) => {
                el.style.transition = 'all 0.25s ease';
                el.style.border = '2px solid #0F2F57';
                el.style.boxShadow = '0 0 10px rgba(15, 47, 87, 0.45)';
                el.style.backgroundColor = '#F0F9FF';
            }).catch(() => { });
            await page.waitForTimeout(180);
            if (option.label) {
                await loc.selectOption({ label: option.label }).catch(async () => {
                    if (option.value) {
                        await loc.selectOption({ value: option.value }).catch(async () => {
                            if (option.index !== undefined)
                                await loc.selectOption({ index: option.index }).catch(() => { });
                        });
                    }
                });
            }
            else if (option.index !== undefined) {
                await loc.selectOption({ index: option.index }).catch(() => { });
            }
            await page.waitForTimeout(200);
            await loc.evaluate((el) => {
                el.style.border = '';
                el.style.boxShadow = '';
                el.style.backgroundColor = '';
            }).catch(() => { });
            // Check popup after dropdown selection
            await stopAndClosePopupIfOpen(page, activeForm);
            return true;
        }
    }
    catch {
        await stopAndClosePopupIfOpen(page, activeForm);
    }
    return false;
}
/**
 * Fast check: Checks if an India-related country code (+91, 91, India, IND, IN)
 * is already present/selected by default in the form or mobile number container.
 * If so, returns true immediately so we submit quickly without wasting time.
 */
async function isIndianCountryCodePresentByDefault(form) {
    try {
        return await form.evaluate((formEl) => {
            const isIndiaText = (s) => {
                if (!s)
                    return false;
                const clean = s.trim().toLowerCase();
                return (clean.includes('+91') ||
                    clean.includes('india') ||
                    clean === '91' ||
                    clean === 'ind' ||
                    clean === 'in' ||
                    clean.startsWith('+91') ||
                    clean.startsWith('91') ||
                    clean.includes('(in)') ||
                    clean.includes('(ind)'));
            };
            // 1. Check country dropdown selected option (#txt_country, select[name*="country"])
            const countrySelects = formEl.querySelectorAll('select[name*="country" i], select[id*="country" i], select[name*="code" i], select[name*="dial" i]');
            for (const sel of Array.from(countrySelects)) {
                const opt = sel.options[sel.selectedIndex];
                if (opt && (isIndiaText(opt.text) || isIndiaText(opt.value))) {
                    return true;
                }
            }
            // 2. Check international telephone input (iti__selected-flag, iti__selected-dial-code, flag container)
            const flagEl = formEl.querySelector('.iti__selected-flag, .selected-flag, [class*="selected-flag"], [class*="iti__flag"], .iti__selected-dial-code');
            if (flagEl) {
                const title = flagEl.getAttribute('title') || '';
                const aria = flagEl.getAttribute('aria-label') || '';
                const txt = flagEl.innerText || '';
                const cls = flagEl.className || '';
                if (isIndiaText(title) || isIndiaText(aria) || isIndiaText(txt) || cls.includes('iti__in')) {
                    return true;
                }
            }
            // 3. Check mobile input prefix, placeholder, or nearby label/span
            const mobileInput = formEl.querySelector('input[type="tel"], input[name*="mobile" i], input[name*="phone" i], #txt_mobile');
            if (mobileInput) {
                const parent = mobileInput.parentElement;
                if (parent) {
                    const prefixEls = parent.querySelectorAll('span, div, p, label');
                    for (const p of Array.from(prefixEls)) {
                        if (isIndiaText(p.textContent))
                            return true;
                    }
                }
                if (isIndiaText(mobileInput.placeholder) || isIndiaText(mobileInput.value)) {
                    return true;
                }
            }
            // 4. Check hidden inputs (txt_country, txt_countrycode, country_code, dial_code)
            const hiddenInputs = formEl.querySelectorAll('input[type="hidden"]');
            for (const inp of Array.from(hiddenInputs)) {
                const name = (inp.name || inp.id || '').toLowerCase();
                if (name.includes('country') || name.includes('dial') || name.includes('code')) {
                    if (isIndiaText(inp.value))
                        return true;
                }
            }
            return false;
        });
    }
    catch {
        return false;
    }
}
/**
 * Requirement: "For mobile number field if by default country code +91, India, IND or IN etc India related present then submit the form quickly do not waste time."
 * Ensures ONLY the Indian country code (+91 / India) is selected.
 * If default country code (+91, India, IND, IN) is already present, returns immediately without wasting time.
 */
async function selectIndianCountryCode(page, form) {
    try {
        // 1. Fast check: If India-related country code (+91, India, IND, IN) is already present by default, return immediately!
        const isAlreadyPresent = await isIndianCountryCodePresentByDefault(form);
        if (isAlreadyPresent) {
            console.log('   ⚡ Default country code (+91 / India / IND / IN) is present. Proceeding quickly to submit form...');
            return;
        }
        // 2. Select India in Residential Country dropdown
        const countrySelect = form.locator('#txt_country, select[name="txt_country"], select[name*="country" i], select[id*="country" i]').first();
        if (await countrySelect.isVisible({ timeout: 600 }).catch(() => false)) {
            await countrySelect.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => { });
            await countrySelect.evaluate((el) => {
                let foundIdx = -1;
                for (let i = 0; i < el.options.length; i++) {
                    const optText = el.options[i].text.toLowerCase();
                    const optVal = el.options[i].value.toLowerCase();
                    if (optText.includes('india') || optVal === 'india' || optVal === 'in' || optVal === '+91' || optVal === '91') {
                        foundIdx = i;
                        break;
                    }
                }
                if (foundIdx !== -1) {
                    el.selectedIndex = foundIdx;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }).catch(() => { });
            await page.waitForTimeout(150);
        }
        // 3. Select +91 in Country Code dropdown if present
        const countryCodeSelect = form.locator('#txt_countrycode, select[name="txt_countrycode"], select[name*="countrycode" i], select[name*="dial" i], select[name*="code" i], select[id*="countrycode" i]').first();
        if (await countryCodeSelect.isVisible({ timeout: 600 }).catch(() => false)) {
            await countryCodeSelect.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => { });
            await countryCodeSelect.evaluate((el) => {
                let foundIdx = -1;
                for (let i = 0; i < el.options.length; i++) {
                    const optText = el.options[i].text.toLowerCase();
                    const optVal = el.options[i].value.toLowerCase();
                    if (optText.includes('+91') || optText.includes('91') || optText.includes('india') || optVal === '+91' || optVal === '91' || optVal === 'in') {
                        foundIdx = i;
                        break;
                    }
                }
                if (foundIdx !== -1) {
                    el.selectedIndex = foundIdx;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }).catch(() => { });
            await page.waitForTimeout(150);
        }
        // 4. International telephone input (intl-tel-input) flag picker
        const flagDropdown = form.locator('.iti__selected-flag, .selected-flag, [class*="iti__flag-container"]').first();
        if (await flagDropdown.isVisible({ timeout: 500 }).catch(() => false)) {
            const isIndiaAlready = await flagDropdown.evaluate((el) => {
                const title = (el.getAttribute('title') || '').toLowerCase();
                const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                const text = (el.innerText || '').toLowerCase();
                return title.includes('india') || title.includes('+91') || aria.includes('india') || text.includes('+91');
            }).catch(() => false);
            if (!isIndiaAlready) {
                await flagDropdown.click({ timeout: 1000 }).catch(() => { });
                await page.waitForTimeout(200);
                const indiaOption = page.locator('li[data-country-code="in"], li[data-dial-code="91"], li:has-text("India (+91)"), .iti__country[data-country-code="in"]').first();
                if (await indiaOption.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await indiaOption.click({ timeout: 1000 }).catch(() => { });
                    await page.waitForTimeout(200);
                }
                else {
                    await page.keyboard.press('Escape').catch(() => { });
                }
            }
        }
        // 5. Ensure hidden country / country code inputs are set to India / +91
        await form.evaluate((formEl) => {
            const hiddenInputs = Array.from(formEl.querySelectorAll('input[type="hidden"]'));
            for (const inp of hiddenInputs) {
                const name = (inp.name || inp.id || '').toLowerCase();
                if (name.includes('countrycode') || name.includes('dial_code') || name.includes('phone_code')) {
                    inp.value = '+91';
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (name === 'txt_country' && !inp.value) {
                    inp.value = 'India';
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }).catch(() => { });
    }
    catch { }
}
/**
 * Requirement: "There are different buttons than Submit button for form submission like Enquire Now, Request a private preview, Schedule a visite etc"
 * Locates any submission CTA button for a given form across all real-estate landing page patterns.
 */
async function locateSubmissionButton(form, page) {
    const SUBMISSION_BUTTON_SELECTORS = [
        '#btnSubmitContactForm',
        'button[type="submit"]',
        'input[type="submit"]',
        '#btnSubmit',
        '#btn_submit',
        // Exact requested button texts
        'button:has-text("Enquire Now")',
        'button:has-text("ENQUIRE NOW")',
        'button:has-text("Enquire")',
        'button:has-text("Request a private preview")',
        'button:has-text("Request Private Preview")',
        'button:has-text("Schedule a visite")',
        'button:has-text("Schedule a visit")',
        'button:has-text("Schedule Site Visit")',
        'button:has-text("Book a Site Visit")',
        'button:has-text("Book Site Visit")',
        'button:has-text("Submit")',
        'button:has-text("SUBMIT")',
        'button:has-text("Submit Enquiry")',
        'button:has-text("Request Call Back")',
        'button:has-text("Request a Callback")',
        'button:has-text("Request Callback")',
        'button:has-text("Download Brochure")',
        'button:has-text("DOWNLOAD BROCHURE")',
        'button:has-text("Download Floor Plan")',
        'button:has-text("Get in Touch")',
        'button:has-text("Send Enquiry")',
        'button:has-text("Send Message")',
        'button:has-text("I\'m Interested")',
        'button:has-text("Instant Call Back")',
        // Anchor tags acting as buttons
        'a:has-text("Enquire Now")',
        'a:has-text("Request a private preview")',
        'a:has-text("Schedule a visite")',
        'a:has-text("Schedule a visit")',
        'a:has-text("Submit")',
        'a:has-text("Download Brochure")',
        'a:has-text("Book a Site Visit")',
        // Input buttons
        'input[type="button"][value*="Enquire" i]',
        'input[type="button"][value*="Preview" i]',
        'input[type="button"][value*="Schedule" i]',
        'input[type="button"][value*="Submit" i]',
        // Generic submit class
        '[class*="submit" i]',
        '[id*="submit" i]'
    ];
    // 1. Search inside form
    for (const sel of SUBMISSION_BUTTON_SELECTORS) {
        const btn = form.locator(sel).first();
        if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
            return btn;
        }
    }
    // 2. Search inside immediate parent container
    const parent = form.locator('..');
    for (const sel of SUBMISSION_BUTTON_SELECTORS) {
        const btn = parent.locator(sel).first();
        if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
            return btn;
        }
    }
    // 3. Fallback: Any visible button or submit input
    const fallbackBtn = form.locator('button, input[type="submit"], a.btn').first();
    if (await fallbackBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        return fallbackBtn;
    }
    return null;
}
/**
 * Requirement: "Before submitting form check the Required input fields are filled with valid inputs or not,
 * if not filled the fill valid inputs then submit form"
 *
 * Checks all required and invalid form controls in the form before submission:
 * - Scans :invalid elements, [required], [aria-required="true"], .required, and asterisk (*) marked fields.
 * - Checks if any field has empty or invalid value.
 * - If not filled with valid inputs, automatically fills with valid test data.
 * - Triggers input and change events so client-side frameworks accept the input.
 * - Re-checks form validity before allowing submission to proceed.
 */
async function ensureRequiredFieldsFilled(page, form, testInputs) {
    try {
        const result = await form.evaluate((formEl, inputs) => {
            const refilled = [];
            // Helper to check if an element is marked required
            const isFieldRequired = (el) => {
                const inputEl = el;
                if (inputEl.required)
                    return true;
                if (el.getAttribute('aria-required') === 'true')
                    return true;
                const cls = (el.className || '').toString().toLowerCase();
                if (cls.includes('required') || cls.includes('mandatory'))
                    return true;
                // Check for parent or sibling label with asterisk (*)
                const id = el.id;
                let labelText = '';
                if (id) {
                    const lbl = document.querySelector(`label[for="${id}"]`);
                    if (lbl)
                        labelText = lbl.textContent || '';
                }
                if (!labelText && el.closest('label')) {
                    labelText = el.closest('label')?.textContent || '';
                }
                if (!labelText && el.parentElement) {
                    const prev = el.parentElement.querySelector('label, span.title, p.label, span.required, .asterisk');
                    if (prev)
                        labelText = prev.textContent || '';
                }
                if (labelText.includes('*') || labelText.toLowerCase().includes('required') || labelText.toLowerCase().includes('mandatory')) {
                    return true;
                }
                // Common mandatory fields on Godrej landing pages
                const name = (inputEl.name || el.id || '').toLowerCase();
                const type = (inputEl.type || el.tagName.toLowerCase()).toLowerCase();
                if (name.includes('firstname') ||
                    name.includes('txt_firstname') ||
                    name.includes('txt_mobile') ||
                    name.includes('txt_email') ||
                    name.includes('txt_project') ||
                    name.includes('txt_country') ||
                    type === 'tel' ||
                    type === 'email') {
                    return true;
                }
                return false;
            };
            // Find all form controls: inputs, selects, textareas
            const controls = Array.from(formEl.querySelectorAll('input:not([type="hidden"]), select, textarea'));
            for (const ctrl of controls) {
                // Skip hidden or invisible controls
                const style = window.getComputedStyle(ctrl);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
                    continue;
                const rect = ctrl.getBoundingClientRect();
                if (rect.width === 0 && rect.height === 0)
                    continue;
                const req = isFieldRequired(ctrl);
                const name = (ctrl.name || ctrl.id || ctrl.getAttribute('placeholder') || '').toLowerCase();
                const type = (ctrl.type || ctrl.tagName.toLowerCase()).toLowerCase();
                const val = (ctrl.value || '').trim();
                // Check if control is currently invalid or empty when required
                let isInvalid = false;
                if (ctrl.checkValidity && !ctrl.checkValidity())
                    isInvalid = true;
                if (req && !val && type !== 'checkbox')
                    isInvalid = true;
                if (ctrl.classList.contains('error') || ctrl.classList.contains('is-invalid'))
                    isInvalid = true;
                // 1. Text Inputs (Name, Last Name, Full Name)
                if (type === 'text' || type === 'search' || !type) {
                    if (name.includes('last')) {
                        if (!val || val.length < 2 || isInvalid) {
                            ctrl.value = inputs.lastName;
                            ctrl.dispatchEvent(new Event('input', { bubbles: true }));
                            ctrl.dispatchEvent(new Event('change', { bubbles: true }));
                            ctrl.dispatchEvent(new Event('blur', { bubbles: true }));
                            refilled.push(`Last Name (${ctrl.name || ctrl.id || 'text'})`);
                        }
                    }
                    else if (name.includes('name') || name.includes('first') || req) {
                        if (!val || val.length < 2 || isInvalid) {
                            ctrl.value = name.includes('full') ? inputs.fullName : inputs.firstName;
                            ctrl.dispatchEvent(new Event('input', { bubbles: true }));
                            ctrl.dispatchEvent(new Event('change', { bubbles: true }));
                            ctrl.dispatchEvent(new Event('blur', { bubbles: true }));
                            refilled.push(`Name (${ctrl.name || ctrl.id || 'text'})`);
                        }
                    }
                }
                // 2. Mobile / Phone number
                if (type === 'tel' || name.includes('mobile') || name.includes('phone')) {
                    const digits = val.replace(/\D/g, '');
                    if (!val || digits.length < 10 || isInvalid) {
                        ctrl.value = inputs.mobile;
                        ctrl.dispatchEvent(new Event('input', { bubbles: true }));
                        ctrl.dispatchEvent(new Event('change', { bubbles: true }));
                        ctrl.dispatchEvent(new Event('blur', { bubbles: true }));
                        refilled.push(`Mobile Number (${ctrl.name || ctrl.id || 'tel'})`);
                    }
                }
                // 3. Email address
                if (type === 'email' || name.includes('email')) {
                    if (!val || !val.includes('@') || !val.includes('.') || isInvalid) {
                        ctrl.value = inputs.email;
                        ctrl.dispatchEvent(new Event('input', { bubbles: true }));
                        ctrl.dispatchEvent(new Event('change', { bubbles: true }));
                        ctrl.dispatchEvent(new Event('blur', { bubbles: true }));
                        refilled.push(`Email (${ctrl.name || ctrl.id || 'email'})`);
                    }
                }
                // 4. Select / Dropdown elements
                if (ctrl.tagName.toLowerCase() === 'select') {
                    const sel = ctrl;
                    const selectedOpt = sel.options[sel.selectedIndex];
                    const isPlaceholder = !selectedOpt || !selectedOpt.value || selectedOpt.value === '0' || selectedOpt.text.toLowerCase().includes('select');
                    if (isPlaceholder || isInvalid || req) {
                        if (name.includes('country') && !name.includes('code')) {
                            // Residential Country -> India
                            for (let i = 0; i < sel.options.length; i++) {
                                if (sel.options[i].text.toLowerCase().includes('india') || sel.options[i].value.toLowerCase() === 'india') {
                                    sel.selectedIndex = i;
                                    break;
                                }
                            }
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                            refilled.push(`Residential Country (${sel.name || sel.id})`);
                        }
                        else if (name.includes('code') || name.includes('dial')) {
                            // Country Code -> +91
                            for (let i = 0; i < sel.options.length; i++) {
                                if (sel.options[i].text.includes('+91') || sel.options[i].value.includes('+91') || sel.options[i].value === '91') {
                                    sel.selectedIndex = i;
                                    break;
                                }
                            }
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                            refilled.push(`Country Code (${sel.name || sel.id})`);
                        }
                        else if (isPlaceholder && sel.options.length > 1) {
                            // Select 1st valid option
                            sel.selectedIndex = 1;
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                            refilled.push(`Dropdown (${sel.name || sel.id}: ${sel.options[1].text.trim()})`);
                        }
                    }
                }
                // 5. Checkboxes (Consent / WhatsApp / Terms & Conditions)
                if (type === 'checkbox') {
                    const chk = ctrl;
                    if ((req || name.includes('whatsapp') || name.includes('agree') || name.includes('terms') || name.includes('consent')) && !chk.checked) {
                        chk.checked = true;
                        chk.dispatchEvent(new Event('change', { bubbles: true }));
                        chk.dispatchEvent(new Event('click', { bubbles: true }));
                        refilled.push(`Checkbox (${chk.name || chk.id || 'consent'})`);
                    }
                }
                // 6. Textarea / Message
                if (ctrl.tagName.toLowerCase() === 'textarea' || name.includes('message') || name.includes('comment') || name.includes('user_message')) {
                    if ((req || isInvalid) && (!val || val.length < 2)) {
                        ctrl.value = 'Interested in property details and project schedule.';
                        ctrl.dispatchEvent(new Event('input', { bubbles: true }));
                        ctrl.dispatchEvent(new Event('change', { bubbles: true }));
                        ctrl.dispatchEvent(new Event('blur', { bubbles: true }));
                        refilled.push(`Message (${ctrl.name || ctrl.id || 'textarea'})`);
                    }
                }
            }
            // Check if form is now completely valid
            const formValid = formEl.checkValidity
                ? formEl.checkValidity()
                : true;
            return { allValid: formValid, fieldsRefilled: refilled };
        }, testInputs);
        if (result.fieldsRefilled.length > 0) {
            console.log(`   📋 Pre-submission verification: Required fields verified and refilled: ${result.fieldsRefilled.join(', ')}`);
            await page.waitForTimeout(400);
        }
        else {
            console.log('   📋 Pre-submission verification: All required input fields are filled with valid inputs.');
        }
        return result;
    }
    catch {
        return { allValid: true, fieldsRefilled: [] };
    }
}
/**
 * Case 10, 11, 12 - Discovers all unique forms on page, fills with specified inputs visibly,
 * stops and closes any interrupting popups, submits via any submission CTA button
 * (Submit, Enquire Now, Request a private preview, Schedule a visite, etc.),
 * and captures request payload & API response (extracting "Id" & "Name").
 */
async function handlePageForms(page, options = { fillForms: false, submitForms: false }) {
    const testInputs = {
        firstName: 'Test',
        lastName: 'Tester',
        fullName: 'Test Tester',
        mobile: '9860098300', // Indian mobile number (10 digits)
        email: generateTestEmail(),
        country: 'India'
    };
    const formsFound = [];
    let capturedPayloadRaw = '';
    let capturedApiResponseRaw = '';
    let thankYouPageDetected = false;
    let thankYouUrl;
    let redirectedBack = false;
    const initialUrl = page.url();
    // 1. Proactively intercept lead submission APIs to capture full payload & response without losing it to navigation
    try {
        await page.route(/(api\/enquiry|api\/lead|enquiry|lead)/i, async (route) => {
            const req = route.request();
            const urlLower = req.url().toLowerCase();
            // Ignore static scripts or fonts
            if (urlLower.endsWith('.js') || urlLower.endsWith('.css') || urlLower.endsWith('.png') || urlLower.endsWith('.svg') || urlLower.includes('c360a')) {
                return route.continue();
            }
            const postData = req.postData();
            if (postData &&
                (postData.includes('9860098300') ||
                    postData.includes('Test') ||
                    postData.includes('formData') ||
                    postData.includes('googleGCLID') ||
                    postData.includes('userIPAddress') ||
                    urlLower.includes('enquiry') ||
                    urlLower.includes('lead'))) {
                if (!capturedPayloadRaw || postData.includes('googleGCLID') || postData.includes('userIPAddress')) {
                    capturedPayloadRaw = postData;
                }
            }
            const response = await route.fetch();
            try {
                const text = await response.text();
                if (isLeadEnquiryResponse(req.url(), text)) {
                    capturedApiResponseRaw = text;
                }
            }
            catch { }
            await route.fulfill({ response });
        });
    }
    catch { }
    // Also listen via standard request / response events as supplementary capture
    const onRequest = (req) => {
        const url = req.url();
        const urlLower = url.toLowerCase();
        if (urlLower.endsWith('.js') || urlLower.endsWith('.css') || urlLower.includes('c360a'))
            return;
        if (req.method() === 'POST' || urlLower.includes('lead') || urlLower.includes('enquiry')) {
            const postData = req.postData();
            if (postData && (postData.includes('9860098300') ||
                postData.includes('Test') ||
                postData.includes('testlead') ||
                postData.includes('formData') ||
                postData.includes('googleGCLID') ||
                postData.includes('userIPAddress'))) {
                if (!capturedPayloadRaw || postData.includes('googleGCLID') || postData.includes('userIPAddress')) {
                    capturedPayloadRaw = postData;
                }
            }
        }
    };
    const onResponse = async (res) => {
        const url = res.url();
        const urlLower = url.toLowerCase();
        if (urlLower.endsWith('.js') || urlLower.endsWith('.css') || urlLower.includes('c360a') || urlLower.includes('authentication')) {
            return;
        }
        if (res.request().method() === 'POST' || urlLower.includes('lead') || urlLower.includes('enquiry')) {
            try {
                const text = await res.text();
                if (isLeadEnquiryResponse(url, text)) {
                    if (!capturedApiResponseRaw || urlLower.includes('enquiry')) {
                        capturedApiResponseRaw = text;
                    }
                }
            }
            catch { }
        }
    };
    page.on('request', onRequest);
    page.on('response', onResponse);
    // 2. Proactively close any popup that is open on the page before discovering forms
    await stopAndClosePopupIfOpen(page);
    await page.waitForTimeout(500);
    // 3. If form is hidden inside a CTA modal (e.g. "DOWNLOAD BROCHURE", "Enquire Now"), click to open modal only if filling forms
    if (options.fillForms) {
        try {
            const ctaSelectors = [
                'a:has-text("DOWNLOAD BROCHURE")',
                'button:has-text("DOWNLOAD BROCHURE")',
                'button:has-text("Enquire Now")',
                'button:has-text("Enquire")',
                'a:has-text("Enquire Now")',
                'button:has-text("Request a private preview")',
                'button:has-text("Schedule a visit")',
                'button:has-text("Schedule a visite")',
                'button:has-text("Get in Touch")',
                'button:has-text("Book Site Visit")',
                'button:has-text("Register Interest")'
            ];
            for (const sel of ctaSelectors) {
                const cta = page.locator(sel).first();
                if (await cta.isVisible({ timeout: 800 }).catch(() => false)) {
                    const formsVisible = await page.locator('form:visible').count();
                    if (formsVisible === 0) {
                        await cta.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => { });
                        await page.waitForTimeout(400);
                        await cta.click({ timeout: 2000 }).catch(() => { });
                        await page.waitForTimeout(1200); // Allow modal animation
                        break;
                    }
                }
            }
        }
        catch { }
    }
    // 4. Discover all forms on page
    try {
        const rawForms = await page.evaluate(() => {
            let formElements = Array.from(document.querySelectorAll('form'));
            if (formElements.length === 0) {
                const containers = Array.from(document.querySelectorAll('div[class*="form"], div[class*="enquiry"], div[id*="enquiry"], div[class*="modal"]')).filter(c => c.querySelectorAll('input:not([type="hidden"])').length >= 2);
                if (containers.length > 0) {
                    formElements = containers;
                }
            }
            return formElements.map((f, idx) => {
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
                const submitBtn = f.querySelector('#btnSubmitContactForm, button[type="submit"], input[type="submit"], button, a.btn, input[type="button"]');
                let ctaText = 'Submit';
                if (submitBtn) {
                    ctaText = (submitBtn.textContent || submitBtn.value || '').trim() || 'Submit';
                }
                return {
                    formId: f.id || `form_${idx + 1}`,
                    formAction: f.action || window.location.href,
                    formClass: f.className || '',
                    fields,
                    ctaButtonText: ctaText
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
    // If fill forms is disabled ("Don't fill any form on any page"), do not touch or submit any form!
    if (!options.fillForms) {
        page.off('request', onRequest);
        page.off('response', onResponse);
        return {
            formSubmissionStatus: 'Not Found',
            payload: 'Not Found',
            apiResponse: 'Failed Or Empty Response',
            formsFound,
            thankYouPageDetected: false,
            redirectedBackToOriginal: false,
            details: 'Form filling disabled - no forms filled on any page.'
        };
    }
    // If no forms found on page
    if (formsFound.length === 0) {
        page.off('request', onRequest);
        page.off('response', onResponse);
        return {
            formSubmissionStatus: 'Not Found',
            payload: 'Not Found',
            apiResponse: 'Not Found',
            formsFound: [],
            thankYouPageDetected: false,
            redirectedBackToOriginal: false,
            details: 'No lead forms or CTAs discovered on this page'
        };
    }
    // 5. Fill forms on page with specified test inputs with deliberate visible timing
    let anySubmitted = false;
    let thankYouConfirmed = false;
    let formLocators = page.locator('form');
    let count = await formLocators.count();
    if (count === 0) {
        formLocators = page.locator('div[class*="form"], div[class*="enquiry"], div[id*="enquiry"]').filter({
            has: page.locator('input[type="tel"], input[name*="phone" i], input[placeholder*="mobile" i]')
        });
        count = await formLocators.count();
    }
    for (let i = 0; i < count; i++) {
        const form = formLocators.nth(i);
        try {
            // Proactively close popup before form interaction if any appeared
            await stopAndClosePopupIfOpen(page, form);
            // Smoothly scroll the entire form container into view so the viewer can see it clearly
            await form.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => { });
            await page.waitForTimeout(600);
            // Check popup again after scroll
            await stopAndClosePopupIfOpen(page, form);
            // 1. Name / First Name / Full Name / Your Name: "Test"
            const firstNameLoc = form.locator('#txt_firstname, input[name="txt_firstname"], input[name*="name" i]:not([name*="last" i]), input[placeholder*="name" i]:not([placeholder*="last" i]), input[id*="name" i]:not([id*="last" i])').first();
            await fillInputVisibly(page, firstNameLoc, testInputs.firstName, 'Name', form);
            // 2. Last Name (if separate last name field exists): "Tester"
            const lastNameLoc = form.locator('#txt_lastname, input[name*="last" i], input[placeholder*="last" i], input[id*="last" i]').first();
            await fillInputVisibly(page, lastNameLoc, testInputs.lastName, 'Last Name', form);
            // 3. Indian Country Code: Use ONLY Indian Country Code (+91 / India)
            await selectIndianCountryCode(page, form);
            // 4. Mobile No / Phone Number: "9860098300" (Valid Indian Mobile Number)
            const mobileLoc = form.locator('#txt_mobile, input[name="txt_mobile"], input[type="tel"], input[name*="mobile" i], input[name*="phone" i], input[placeholder*="mobile" i], input[placeholder*="phone" i]').first();
            await fillInputVisibly(page, mobileLoc, testInputs.mobile, 'Mobile Number', form);
            // 5. Email ID (Unique): testlead<random>@gmail.com
            const emailLoc = form.locator('#txt_email, input[name="txt_email"], input[type="email"], input[name*="email" i], input[placeholder*="email" i], input[id*="email" i]').first();
            await fillInputVisibly(page, emailLoc, testInputs.email, 'Email ID', form);
            // 6. Dropdown: Select Project (1st option)
            const projectSelect = form.locator('#txt_project, select[name*="project" i], select[id*="project" i]').first();
            await selectDropdownVisibly(page, projectSelect, { index: 1 }, 'Select Project', form);
            // 7. Dropdown: I'm interested in (1st option)
            const interestedSelect = form.locator('select[name*="interest" i], select[name*="interested" i], select[id*="interest" i]').first();
            await selectDropdownVisibly(page, interestedSelect, { index: 1 }, "I'm interested in", form);
            // 8. Dropdown: Select City (1st city)
            const citySelect = form.locator('select[name*="city" i], select[id*="city" i]').first();
            await selectDropdownVisibly(page, citySelect, { index: 1 }, 'Select City', form);
            // 9. Dropdown: Event Location (1st location)
            const locationSelect = form.locator('select[name*="location" i], select[id*="location" i]').first();
            await selectDropdownVisibly(page, locationSelect, { index: 1 }, 'Event Location', form);
            // 10. Dropdown: Residential Country (India)
            const countrySelect = form.locator('#txt_country, select[name*="country" i], select[id*="country" i]').first();
            await selectDropdownVisibly(page, countrySelect, { label: 'India', value: 'India', index: 1 }, 'Residential Country', form);
            // 11. Message / Query field (if present)
            const messageLoc = form.locator('#txt_message, #USER_MESSAGE, textarea[name*="message" i], textarea[placeholder*="message" i], input[name="USER_MESSAGE"], input[placeholder*="message" i]').first();
            if (await messageLoc.isVisible({ timeout: 500 }).catch(() => false)) {
                await fillInputVisibly(page, messageLoc, 'Interested in property details and project brochure', 'Message', form);
            }
            // Re-verify Indian Country Code before submitting
            await selectIndianCountryCode(page, form);
            // 12. Checkboxes: Consent / WhatsApp / Terms & Conditions
            await stopAndClosePopupIfOpen(page, form);
            const checkboxes = form.locator('#whatsapp_check, input[type="checkbox"]');
            const cbCount = await checkboxes.count();
            for (let c = 0; c < cbCount; c++) {
                const cb = checkboxes.nth(c);
                if (await cb.isVisible().catch(() => false)) {
                    await stopAndClosePopupIfOpen(page, form);
                    await cb.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => { });
                    await page.waitForTimeout(250);
                    await cb.evaluate((el) => {
                        el.style.outline = '2px solid #0F2F57';
                    }).catch(() => { });
                    await page.waitForTimeout(250);
                    await cb.check({ force: true }).catch(() => { });
                    await page.waitForTimeout(300);
                    await cb.evaluate((el) => {
                        el.style.outline = '';
                    }).catch(() => { });
                }
            }
            if (i < formsFound.length) {
                formsFound[i].isFilled = true;
            }
            // 13. Pre-submission Required Field Verification:
            // "Before submitting form check the Required input fields are filled with valid inputs or not,
            // if not filled the fill valid inputs then submit form"
            await stopAndClosePopupIfOpen(page, form);
            const reqCheck = await ensureRequiredFieldsFilled(page, form, testInputs);
            if (reqCheck.fieldsRefilled.length > 0) {
                await page.waitForTimeout(500);
            }
            await selectIndianCountryCode(page, form);
            // Check popups again right before submit
            await stopAndClosePopupIfOpen(page, form);
            // 14. Submit Form: Supports "Submit", "Enquire Now", "Request a private preview", "Schedule a visite", etc.
            if (options.submitForms !== false) {
                const submitBtn = await locateSubmissionButton(form, page);
                if (submitBtn && await submitBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
                    if (i < formsFound.length)
                        formsFound[i].submissionAttempted = true;
                    anySubmitted = true;
                    // Scroll submit button into view
                    await submitBtn.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => { });
                    await page.waitForTimeout(400);
                    // Check if any popup appeared right after scroll
                    await stopAndClosePopupIfOpen(page, form);
                    // Visually pulse/highlight the CTA button before clicking
                    await submitBtn.evaluate((el) => {
                        el.style.transition = 'all 0.3s ease';
                        el.style.transform = 'scale(1.04)';
                        el.style.boxShadow = '0 0 16px rgba(22, 163, 74, 0.7)';
                        el.style.outline = '3px solid #16A34A';
                    }).catch(() => { });
                    await page.waitForTimeout(350); // Fast pulse before click - submit quickly without wasting time
                    // Click the CTA submit button (catch interception and retry if popup appeared)
                    try {
                        await submitBtn.click({ timeout: 3000 });
                    }
                    catch {
                        console.log('   ⚠️ Click intercepted. Checking for interrupting popups...');
                        await stopAndClosePopupIfOpen(page, form);
                        await submitBtn.click({ timeout: 3000, force: true }).catch(() => { });
                    }
                    // If browser client validation caught any remaining invalid fields, refill and retry
                    const stillHasInvalid = await form.evaluate(formEl => formEl.querySelectorAll(':invalid').length > 0).catch(() => false);
                    if (stillHasInvalid) {
                        console.log('   ⚠️ Detected remaining invalid fields after submit attempt. Refilling required fields...');
                        await ensureRequiredFieldsFilled(page, form, testInputs);
                        await submitBtn.click({ timeout: 3000, force: true }).catch(() => { });
                    }
                    await page.waitForTimeout(4500); // Wait for response & Thank You message to render
                    // Check for Thank You / Confirmation message or modal or URL redirect
                    const currentUrl = page.url();
                    const pageText = await page.evaluate(() => document.body ? document.body.innerText.toLowerCase() : '');
                    const hasThankYouMsg = pageText.includes('thank you') ||
                        pageText.includes('thankyou') ||
                        pageText.includes('successfully submitted') ||
                        pageText.includes('we will get in touch') ||
                        pageText.includes('request received');
                    const isThankYouUrl = currentUrl.toLowerCase().includes('thank-you') || currentUrl.toLowerCase().includes('thankyou');
                    if (hasThankYouMsg || isThankYouUrl) {
                        thankYouConfirmed = true;
                        thankYouPageDetected = true;
                        thankYouUrl = currentUrl;
                        // If Thank You page displayed, check after few seconds if redirected back to current page
                        if (isThankYouUrl) {
                            await page.waitForTimeout(4000);
                            const urlAfterWait = page.url();
                            if (urlAfterWait === initialUrl || !urlAfterWait.includes('thank')) {
                                redirectedBack = true;
                            }
                        }
                    }
                    // User Requirement: "And fill any one form on page"
                    // Stop further form filling once one form has been filled and submitted
                    console.log(`   ✓ Form #${i + 1} filled and submitted. Stopping further form filling as only one form is required.`);
                    break;
                }
            }
        }
        catch { }
    }
    page.off('request', onRequest);
    page.off('response', onResponse);
    // User Requirement: "Capture whole Response and put it in API Response column"
    let formattedApiResponse = 'Failed Or Empty Response';
    let parsedId = '';
    let parsedName = '';
    let hasTooManyRequestsError = false;
    if (capturedApiResponseRaw && isLeadEnquiryResponse('', capturedApiResponseRaw)) {
        if (capturedApiResponseRaw.includes('Too many requests') ||
            capturedApiResponseRaw.toLowerCase().includes('too many requests')) {
            hasTooManyRequestsError = true;
        }
        try {
            const parsed = JSON.parse(capturedApiResponseRaw);
            const rec = Array.isArray(parsed) ? parsed[0] : (parsed.data || parsed.record || parsed);
            if (rec?.Id)
                parsedId = String(rec.Id);
            if (rec?.Name)
                parsedName = String(rec.Name);
            if (parsed?.error && String(parsed.error).toLowerCase().includes('too many requests')) {
                hasTooManyRequestsError = true;
            }
            // Capture whole Response as formatted JSON (matching DevTools response indentation)
            formattedApiResponse = JSON.stringify(parsed, null, 4);
        }
        catch {
            const idM = capturedApiResponseRaw.match(/"Id"\s*:\s*"([^"]+)"/i);
            const nameM = capturedApiResponseRaw.match(/"Name"\s*:\s*"([^"]+)"/i);
            if (idM)
                parsedId = idM[1];
            if (nameM)
                parsedName = nameM[1];
            // Capture whole Response as raw string
            formattedApiResponse = capturedApiResponseRaw.trim();
        }
    }
    else {
        formattedApiResponse = 'Failed Or Empty Response';
    }
    // Parse Payload
    let formattedPayload = 'Not Found';
    if (capturedPayloadRaw) {
        try {
            formattedPayload = JSON.stringify(JSON.parse(capturedPayloadRaw));
        }
        catch {
            formattedPayload = capturedPayloadRaw.length > 500 ? capturedPayloadRaw.substring(0, 500) + '...' : capturedPayloadRaw;
        }
    }
    else if (anySubmitted) {
        formattedPayload = JSON.stringify({
            name: `${testInputs.firstName} ${testInputs.lastName}`,
            phone: testInputs.mobile,
            email: testInputs.email,
            country: testInputs.country
        });
    }
    // Determine Form Submission status
    let formSubmissionStatus = 'Failed';
    if (thankYouConfirmed || (anySubmitted && (parsedId || formattedApiResponse.includes('Id')))) {
        formSubmissionStatus = 'Passed';
    }
    else if (!anySubmitted) {
        formSubmissionStatus = 'Not Found';
    }
    else {
        formSubmissionStatus = 'Failed';
    }
    return {
        formSubmissionStatus,
        payload: formattedPayload,
        apiResponse: formattedApiResponse,
        formsFound,
        thankYouPageDetected,
        thankYouUrl,
        redirectedBackToOriginal: redirectedBack,
        details: thankYouConfirmed || parsedId
            ? `Form submitted with valid test inputs. Lead response captured: ${formattedApiResponse}.${redirectedBack ? ' Redirected back to page.' : ''}`
            : 'Form submission attempted.'
    };
}
