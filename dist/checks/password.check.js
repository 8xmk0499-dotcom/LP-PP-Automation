"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPasswordProtection = checkPasswordProtection;
/**
 * Case 1 - Password protection:
 * If Access Denied or Enter Password popup is visible -> write 'Yes' in red colour.
 * Otherwise -> write 'NO' in green colour.
 */
async function checkPasswordProtection(page, response, dialogDetected = false, dialogMessage = '') {
    // 1. Check if browser prompt() dialog for password was triggered
    if (dialogDetected) {
        return {
            status: 'Yes',
            isProtected: true,
            details: `Enter Password popup dialog detected: "${dialogMessage || 'Enter password to view this page'}"`
        };
    }
    // 2. Check HTTP status code (401 Unauthorized)
    if (response && response.status() === 401) {
        return {
            status: 'Yes',
            isProtected: true,
            details: 'HTTP 401 Unauthorized (Password / Auth challenge requested)'
        };
    }
    // 3. Inspect DOM for "Access Denied" or password protection text/elements
    try {
        const domProtection = await page.evaluate(() => {
            const bodyText = (document.body ? document.body.innerText : '').toLowerCase();
            const titleText = (document.title || '').toLowerCase();
            // Check specific GPL Access Denied wall
            const isGplAccessDenied = bodyText.includes('access denied') &&
                (bodyText.includes('you have exceeded the maximum number of attempts') ||
                    bodyText.includes('attempts left') ||
                    bodyText.includes('enter password'));
            // Check generic Access Denied heading
            const hasAccessDeniedHeading = Array.from(document.querySelectorAll('h1, h2, h3, p')).some(el => {
                const text = (el.textContent || '').trim().toLowerCase();
                return text === 'access denied' || text.includes('access denied');
            });
            // Check for prompt text rendered on page
            const hasPasswordPromptText = bodyText.includes('enter password to view this page') ||
                bodyText.includes('enter password to access') ||
                bodyText.includes('page is password protected') ||
                bodyText.includes('this site is password protected');
            // Check for password inputs
            const passwordInputs = document.querySelectorAll('input[type="password"]');
            const hasPasswordInput = passwordInputs.length > 0 && (bodyText.includes('password') ||
                bodyText.includes('protected') ||
                bodyText.includes('enter code'));
            return {
                isProtected: isGplAccessDenied || (hasAccessDeniedHeading && isGplAccessDenied) || hasPasswordPromptText || hasPasswordInput,
                reason: isGplAccessDenied
                    ? 'Access denied: You have exceeded the maximum number of attempts'
                    : hasPasswordPromptText
                        ? 'Enter password text visible on page'
                        : hasPasswordInput
                            ? 'Password input field gate found'
                            : ''
            };
        });
        if (domProtection.isProtected) {
            return {
                status: 'Yes',
                isProtected: true,
                details: domProtection.reason || 'Access Denied / Password protection visible on page'
            };
        }
    }
    catch { }
    // Not password protected
    return {
        status: 'NO',
        isProtected: false,
        details: 'Page is not password protected'
    };
}
