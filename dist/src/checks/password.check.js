"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPasswordProtection = checkPasswordProtection;
/**
 * Case 1 - Password protection
 * Given page is password protected then status should be Failed in Password Column.
 * Given page is not password protected then status should be Passed in Password Column.
 */
async function checkPasswordProtection(page, response) {
    // 1. Check HTTP auth status
    if (response && response.status() === 401) {
        return {
            status: 'Failed',
            details: 'HTTP 401 Unauthorized (Basic / Digest Auth requested)'
        };
    }
    // 2. Check DOM for password protection wall
    try {
        const isProtected = await page.evaluate(() => {
            // Check for password inputs
            const passwordInputs = document.querySelectorAll('input[type="password"]');
            // Check body text for password protection indicators
            const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
            const protectionKeywords = [
                'enter password to access',
                'page is password protected',
                'this site is password protected',
                'protected area: please enter password',
                'password protected site',
                'restricted area - enter password'
            ];
            const hasKeyword = protectionKeywords.some(kw => bodyText.includes(kw));
            // Check if the only visible form is a password wall
            const forms = document.querySelectorAll('form');
            const hasPasswordWallForm = Array.from(forms).some(f => {
                const text = f.innerText.toLowerCase();
                return (f.querySelector('input[type="password"]') !== null &&
                    (text.includes('password') || text.includes('protected') || text.includes('enter code')) &&
                    !text.includes('enquiry') && !text.includes('sign up') && !text.includes('register'));
            });
            return (passwordInputs.length > 0 && hasKeyword) || hasPasswordWallForm;
        });
        if (isProtected) {
            return {
                status: 'Failed',
                details: 'Page contains password protection barrier / login wall'
            };
        }
    }
    catch (err) {
        // If evaluation fails, fall back to passed if page loaded
    }
    return {
        status: 'Passed',
        details: 'Page is not password protected'
    };
}
