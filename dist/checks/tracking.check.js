"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkGclidAndIp = checkGclidAndIp;
/**
 * Case 9 – Check GCLID , IP Address is present or not on the page.
 * If present then Passed otherwise failed.
 */
async function checkGclidAndIp(page, capturedNetworkData) {
    const currentUrl = page.url();
    // 1. Evaluate inside browser context
    const domResult = await page.evaluate(() => {
        let gclidFound = false;
        let gclidSource = '';
        let ipFound = false;
        let ipValue = '';
        let ipSource = '';
        // Regex for IP detection (excluding standard localhost/common masks)
        const ipv4Regex = /\b(?!127\.0\.0\.1|0\.0\.0\.0)(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-5])\.(?:[1-9]?\d|1\d\d|2[0-4]\d|25[0-5])\.(?:[1-9]?\d|1\d\d|2[0-4]\d|25[0-5])\.(?:[1-9]?\d|1\d\d|2[0-4]\d|25[0-5])\b/;
        // A. Check inputs (e.g., hidden inputs for CRM lead tracking)
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            const el = input;
            const name = (el.name || '').toLowerCase();
            const id = (el.id || '').toLowerCase();
            const val = (el.value || '').trim();
            // Check GCLID input
            if (name.includes('gclid') || id.includes('gclid')) {
                gclidFound = true;
                gclidSource = `Input [name="${el.name || el.id}"] (value: "${val}")`;
            }
            // Check IP input
            if ((name.includes('ip') || id.includes('ip') || name.includes('client_ip') || name.includes('user_ip')) &&
                (name !== 'description' && name !== 'zip' && name !== 'equipment')) {
                if (val && ipv4Regex.test(val)) {
                    ipFound = true;
                    ipValue = val;
                    ipSource = `Input [name="${el.name || el.id}"]`;
                }
            }
        });
        // B. Check dataLayer
        try {
            const dl = window.dataLayer;
            if (Array.isArray(dl)) {
                for (const item of dl) {
                    const str = JSON.stringify(item);
                    if (!gclidFound && str.toLowerCase().includes('gclid')) {
                        gclidFound = true;
                        gclidSource = 'dataLayer object';
                    }
                    if (!ipFound) {
                        const ipMatch = str.match(ipv4Regex);
                        if (ipMatch) {
                            ipFound = true;
                            ipValue = ipMatch[0];
                            ipSource = 'dataLayer object';
                        }
                    }
                }
            }
        }
        catch { }
        // C. Check LocalStorage and SessionStorage
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i) || '';
                const val = localStorage.getItem(key) || '';
                if (key.toLowerCase().includes('gclid') || val.toLowerCase().includes('gclid')) {
                    gclidFound = true;
                    gclidSource = `localStorage key "${key}"`;
                }
                const ipMatch = val.match(ipv4Regex);
                if (ipMatch && !ipFound) {
                    ipFound = true;
                    ipValue = ipMatch[0];
                    ipSource = `localStorage key "${key}"`;
                }
            }
        }
        catch { }
        // D. Check Cookies
        try {
            const cookies = document.cookie || '';
            if (cookies.toLowerCase().includes('gclid') || cookies.includes('_gcl_') || cookies.includes('_gac_')) {
                gclidFound = true;
                gclidSource = 'Browser Cookie (_gcl / gclid)';
            }
            const cookieIpMatch = cookies.match(ipv4Regex);
            if (cookieIpMatch && !ipFound) {
                ipFound = true;
                ipValue = cookieIpMatch[0];
                ipSource = 'Browser Cookie';
            }
        }
        catch { }
        return { gclidFound, gclidSource, ipFound, ipValue, ipSource };
    });
    let gclidFound = domResult.gclidFound;
    let gclidSource = domResult.gclidSource;
    let ipFound = domResult.ipFound;
    let detectedIp = domResult.ipValue;
    let ipSource = domResult.ipSource;
    // 2. Check current page URL for ?gclid=
    if (!gclidFound && currentUrl.toLowerCase().includes('gclid=')) {
        gclidFound = true;
        gclidSource = 'Page URL parameter';
    }
    // 3. Check captured network requests / responses
    const ipv4Regex = /\b(?!127\.0\.0\.1|0\.0\.0\.0)(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-5])\.(?:[1-9]?\d|1\d\d|2[0-4]\d|25[0-5])\.(?:[1-9]?\d|1\d\d|2[0-4]\d|25[0-5])\.(?:[1-9]?\d|1\d\d|2[0-4]\d|25[0-5])\b/;
    for (const item of capturedNetworkData) {
        const combined = `${item.url} ${item.postData || ''} ${item.responseBody || ''}`;
        if (!gclidFound && combined.toLowerCase().includes('gclid')) {
            gclidFound = true;
            gclidSource = `Network call (${new URL(item.url).hostname})`;
        }
        if (!ipFound) {
            // Check if this was an IP lookup API (ipify, ipinfo, geoip, etc.)
            const isIpApi = item.url.includes('ipify') || item.url.includes('ipinfo') || item.url.includes('geoip') || item.url.includes('/api/ip');
            const ipMatch = combined.match(ipv4Regex);
            if (ipMatch && (isIpApi || item.postData?.toLowerCase().includes('ip'))) {
                ipFound = true;
                detectedIp = ipMatch[0];
                ipSource = `API (${item.url})`;
            }
        }
    }
    return {
        gclidStatus: gclidFound ? 'Passed' : 'Failed',
        gclidFound,
        gclidSource,
        ipStatus: ipFound ? 'Passed' : 'Failed',
        ipFound,
        detectedIp,
        ipSource
    };
}
