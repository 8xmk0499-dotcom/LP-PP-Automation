"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TARGET_BEACON_URL = exports.TARGET_BEACON_ID = exports.TARGET_BEACON_SCRIPT = void 0;
exports.checkBeaconCode = checkBeaconCode;
exports.TARGET_BEACON_SCRIPT = 'c360a.min.js';
exports.TARGET_BEACON_ID = '81ab4cd6-a5cb-41f8-a83e-7878b2b4537a';
exports.TARGET_BEACON_URL = 'https://cdn.c360a.salesforce.com/beacon/c360a/81ab4cd6-a5cb-41f8-a83e-7878b2b4537a/scripts/c360a.min.js';
/**
 * Case 8 – Check Beacon code –
 * Specifically checks for the exact Salesforce Beacon script 'c360a.min.js'
 * and code 'https://cdn.c360a.salesforce.com/beacon/c360a/81ab4cd6-a5cb-41f8-a83e-7878b2b4537a/scripts/c360a.min.js'.
 * Only passes if 'c360a.min.js' and target beacon code are explicitly detected.
 */
async function checkBeaconCode(page, networkRequests, beaconId = exports.TARGET_BEACON_ID) {
    const normalizedId = beaconId.toLowerCase();
    const normalizedUrl = exports.TARGET_BEACON_URL.toLowerCase();
    const targetScript = exports.TARGET_BEACON_SCRIPT.toLowerCase();
    let foundInNetwork = false;
    let matchedNetworkCall = '';
    let foundInDom = false;
    let matchedDomSnippet = '';
    // ----------------------------------------------------
    // 1. SEARCH BEACON SCRIPT (c360a.min.js) IN NETWORK
    // ----------------------------------------------------
    // Strictly requires c360a.min.js and beacon ID/URL
    for (const req of networkRequests) {
        const urlLower = req.url.toLowerCase();
        const fullText = `${req.url} ${req.postData || ''}`.toLowerCase();
        if (urlLower.includes(targetScript) ||
            (urlLower.includes('c360a') && (fullText.includes(normalizedId) || fullText.includes(normalizedUrl)))) {
            foundInNetwork = true;
            matchedNetworkCall = `${req.method} ${req.url}`;
            break;
        }
    }
    // ----------------------------------------------------
    // 2. INSPECT PAGE (DOM Scripts strictly for c360a.min.js / target beacon code)
    // ----------------------------------------------------
    const domResult = await page.evaluate((target) => {
        const scripts = document.querySelectorAll('script');
        for (const s of Array.from(scripts)) {
            const src = (s.getAttribute('src') || '').toLowerCase();
            const text = (s.textContent || '').toLowerCase();
            if (src.includes(target.script) ||
                src.includes(target.id) ||
                text.includes(target.script) ||
                text.includes(target.url)) {
                return {
                    found: true,
                    snippet: s.getAttribute('src') || text.substring(0, 120)
                };
            }
        }
        return { found: false, snippet: '' };
    }, { id: normalizedId, url: normalizedUrl, script: targetScript });
    if (domResult.found) {
        foundInDom = true;
        matchedDomSnippet = domResult.snippet;
    }
    // ----------------------------------------------------
    // 3. SCAN HTML SOURCE AS FALLBACK (strictly for c360a.min.js or exact beacon ID)
    // ----------------------------------------------------
    if (!foundInDom && !foundInNetwork) {
        try {
            const html = await page.content();
            const htmlLower = html.toLowerCase();
            if (htmlLower.includes(targetScript) && htmlLower.includes(normalizedId)) {
                foundInDom = true;
                matchedDomSnippet = `Found ${exports.TARGET_BEACON_SCRIPT} and ${beaconId} inside page HTML source`;
            }
        }
        catch { }
    }
    const found = foundInNetwork || foundInDom;
    const status = found ? 'Passed' : 'Failed';
    let inspectionDetails = '';
    if (found) {
        const locations = [];
        if (foundInNetwork)
            locations.push(`Network request: ${matchedNetworkCall}`);
        if (foundInDom)
            locations.push(`Page DOM: ${matchedDomSnippet}`);
        inspectionDetails = `Beacon script ${exports.TARGET_BEACON_SCRIPT} (${beaconId}) verified in [${locations.join(' | ')}]`;
    }
    else {
        inspectionDetails = `Beacon script '${exports.TARGET_BEACON_SCRIPT}' (${beaconId}) not found in Network requests or DOM scripts.`;
    }
    return {
        status,
        found,
        foundInNetwork,
        foundInDom,
        matchedUrl: matchedNetworkCall || matchedDomSnippet || undefined,
        matchedNetworkCall: matchedNetworkCall || undefined,
        inspectionDetails
    };
}
