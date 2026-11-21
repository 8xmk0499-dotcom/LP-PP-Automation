"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TARGET_CLARITY_URL = exports.TARGET_CLARITY_ID = void 0;
exports.checkClarityCode = checkClarityCode;
exports.TARGET_CLARITY_ID = 'ulvpk6eqzz';
exports.TARGET_CLARITY_URL = 'https://www.clarity.ms/tag/ulvpk6eqzz';
/**
 * Case 7 – Check Clarity code –
 * Specifically checks for the exact Microsoft Clarity script/tag code 'ulvpk6eqzz'
 * and URL 'https://www.clarity.ms/tag/ulvpk6eqzz'.
 * Only passes if the exact script name and code 'ulvpk6eqzz' is explicitly detected.
 */
async function checkClarityCode(page, networkRequests, targetId = exports.TARGET_CLARITY_ID) {
    const normalizedId = targetId.toLowerCase();
    const normalizedUrl = exports.TARGET_CLARITY_URL.toLowerCase();
    let foundInNetwork = false;
    let matchedNetworkCall = '';
    let foundInDom = false;
    let matchedDomSnippet = '';
    // ----------------------------------------------------
    // 1. SEARCH EXACT CLARITY CODE (ulvpk6eqzz) IN NETWORK
    // ----------------------------------------------------
    for (const req of networkRequests) {
        const urlLower = req.url.toLowerCase();
        const fullText = `${req.url} ${req.postData || ''}`.toLowerCase();
        if (urlLower.includes(normalizedId) ||
            urlLower.includes('clarity.ms/tag/' + normalizedId) ||
            fullText.includes(normalizedId)) {
            foundInNetwork = true;
            matchedNetworkCall = `${req.method} ${req.url}`;
            break;
        }
    }
    // ----------------------------------------------------
    // 2. INSPECT PAGE (DOM Scripts strictly for ulvpk6eqzz)
    // ----------------------------------------------------
    const domResult = await page.evaluate((id) => {
        const scripts = document.querySelectorAll('script');
        for (const s of Array.from(scripts)) {
            const src = (s.getAttribute('src') || '').toLowerCase();
            const text = (s.textContent || '').toLowerCase();
            if (src.includes(id) || text.includes(id) || src.includes('clarity.ms/tag/' + id)) {
                return {
                    found: true,
                    snippet: s.getAttribute('src') || text.substring(0, 120)
                };
            }
        }
        return { found: false, snippet: '' };
    }, normalizedId);
    if (domResult.found) {
        foundInDom = true;
        matchedDomSnippet = domResult.snippet;
    }
    // ----------------------------------------------------
    // 3. SCAN HTML SOURCE AS FALLBACK (strictly for ulvpk6eqzz)
    // ----------------------------------------------------
    if (!foundInDom && !foundInNetwork) {
        try {
            const html = await page.content();
            if (html.toLowerCase().includes(normalizedId)) {
                foundInDom = true;
                matchedDomSnippet = `Found ${targetId} inside page HTML source`;
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
        inspectionDetails = `Clarity script/tag code '${targetId}' verified in [${locations.join(' | ')}]`;
    }
    else {
        inspectionDetails = `Clarity script/tag code '${targetId}' not found in Network requests or DOM scripts.`;
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
