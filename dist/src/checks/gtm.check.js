"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TARGET_GTM_TAG = void 0;
exports.checkGtmTags = checkGtmTags;
exports.TARGET_GTM_TAG = 'GTM-M7T2KZD';
/**
 * Case 6 - Standard Landing page GTM tag ‘GTM-M7T2KZD’ is present or not on Main page & thank you page,
 * also capture all other GTM tags present on page.
 */
async function checkGtmTags(page, networkUrls, targetTag = exports.TARGET_GTM_TAG) {
    const gtmRegex = /GTM-[A-Z0-9_-]+/gi;
    // 1. Scan DOM and window objects
    const domGtms = await page.evaluate(() => {
        const found = [];
        const regex = /GTM-[A-Z0-9_-]+/gi;
        // Check script contents and src
        const scripts = document.querySelectorAll('script, noscript, iframe');
        scripts.forEach(s => {
            const src = s.getAttribute('src') || '';
            const text = s.textContent || '';
            const matches = `${src} ${text}`.match(regex);
            if (matches)
                found.push(...matches);
        });
        // Check dataLayer
        try {
            const dl = window.dataLayer;
            if (Array.isArray(dl)) {
                const dlStr = JSON.stringify(dl);
                const matches = dlStr.match(regex);
                if (matches)
                    found.push(...matches);
            }
        }
        catch { }
        // Check google_tag_manager object
        try {
            const gtmObj = window.google_tag_manager;
            if (gtmObj && typeof gtmObj === 'object') {
                Object.keys(gtmObj).forEach(k => {
                    if (k.startsWith('GTM-'))
                        found.push(k);
                });
            }
        }
        catch { }
        return found;
    });
    // 2. Scan network requests
    const networkGtms = [];
    networkUrls.forEach(url => {
        const matches = url.match(gtmRegex);
        if (matches)
            networkGtms.push(...matches);
    });
    // 3. Scan full page HTML source
    let htmlGtms = [];
    try {
        const html = await page.content();
        htmlGtms = html.match(gtmRegex) || [];
    }
    catch { }
    // Deduplicate and uppercase all tags
    const allUniqueGtms = Array.from(new Set([...domGtms, ...networkGtms, ...htmlGtms].map(t => t.toUpperCase())));
    const upperTarget = targetTag.toUpperCase();
    const standardGtmFound = allUniqueGtms.includes(upperTarget);
    const standardGtmPassed = standardGtmFound ? 'Passed' : 'Failed';
    const otherTags = allUniqueGtms.filter(t => t !== upperTarget);
    const otherGtmTags = otherTags.length > 0 ? otherTags.join(', ') : 'None';
    return {
        standardGtmPassed,
        standardGtmFound,
        otherGtmTags,
        allGtmTags: allUniqueGtms
    };
}
