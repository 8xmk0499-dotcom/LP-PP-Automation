"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TARGET_BEACON_URL = exports.TARGET_BEACON_ID = void 0;
exports.checkBeaconCode = checkBeaconCode;
exports.TARGET_BEACON_ID = '81ab4cd6-a5cb-41f8-a83e-7878b2b4537a';
exports.TARGET_BEACON_URL = 'https://cdn.c360a.salesforce.com/beacon/c360a/81ab4cd6-a5cb-41f8-a83e-7878b2b4537a/scripts/c360a.min.js';
/**
 * Case 8 – Check Beacon code –
 * ‘https://cdn.c360a.salesforce.com/beacon/c360a/81ab4cd6-a5cb-41f8-a83e-7878b2b4537a/scripts/c360a.min.js’
 */
async function checkBeaconCode(page, networkUrls, beaconId = exports.TARGET_BEACON_ID) {
    const normalizedId = beaconId.toLowerCase();
    // 1. Check network requests
    const networkMatch = networkUrls.find(url => url.toLowerCase().includes(normalizedId) ||
        (url.includes('c360a') && url.includes(normalizedId)));
    if (networkMatch) {
        return {
            status: 'Passed',
            found: true,
            matchedUrl: networkMatch
        };
    }
    // 2. Check DOM scripts and Salesforce c360a / beacon globals
    const domMatch = await page.evaluate((id) => {
        const scripts = document.querySelectorAll('script');
        for (const s of Array.from(scripts)) {
            const src = s.getAttribute('src') || '';
            const text = s.textContent || '';
            if (src.toLowerCase().includes(id) || text.toLowerCase().includes(id)) {
                return src || 'inline-c360a-beacon-script';
            }
        }
        // Check Salesforce globals
        if (window.SalesforceInteractions || window.Evergage || window.c360a) {
            return 'Salesforce Beacon global detected';
        }
        return null;
    }, normalizedId);
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
        if (html.toLowerCase().includes(normalizedId)) {
            return {
                status: 'Passed',
                found: true,
                matchedUrl: exports.TARGET_BEACON_URL
            };
        }
    }
    catch { }
    return {
        status: 'Failed',
        found: false
    };
}
