"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TARGET_CLARITY_URL = exports.TARGET_CLARITY_ID = void 0;
exports.checkClarityCode = checkClarityCode;
exports.TARGET_CLARITY_ID = 'ulvpk6eqzz';
exports.TARGET_CLARITY_URL = 'https://www.clarity.ms/tag/ulvpk6eqzz';
/**
 * Case 7 – Check Clarity code – ‘https://www.clarity.ms/tag/ulvpk6eqzz’ is present or not on the page.
 */
async function checkClarityCode(page, networkUrls, targetId = exports.TARGET_CLARITY_ID) {
    // 1. Check network requests
    const networkMatch = networkUrls.find(url => url.toLowerCase().includes(targetId.toLowerCase()) ||
        (url.includes('clarity.ms') && url.includes(targetId)));
    if (networkMatch) {
        return {
            status: 'Passed',
            found: true,
            matchedUrl: networkMatch
        };
    }
    // 2. Check DOM scripts and window.clarity
    const domMatch = await page.evaluate((id) => {
        // Check script tags
        const scripts = document.querySelectorAll('script');
        for (const s of Array.from(scripts)) {
            const src = s.getAttribute('src') || '';
            const text = s.textContent || '';
            if (src.toLowerCase().includes(id.toLowerCase()) || text.toLowerCase().includes(id.toLowerCase())) {
                return src || 'inline-clarity-script';
            }
        }
        // Check window.clarity
        if (typeof window.clarity === 'function' || window._clarity) {
            return 'window.clarity detected';
        }
        return null;
    }, targetId);
    if (domMatch) {
        return {
            status: 'Passed',
            found: true,
            matchedUrl: domMatch
        };
    }
    // 3. Check HTML source as fallback
    try {
        const html = await page.content();
        if (html.toLowerCase().includes(targetId.toLowerCase())) {
            return {
                status: 'Passed',
                found: true,
                matchedUrl: exports.TARGET_CLARITY_URL
            };
        }
    }
    catch { }
    return {
        status: 'Failed',
        found: false
    };
}
