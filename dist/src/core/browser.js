"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBrowser = createBrowser;
exports.createBrowserContext = createBrowserContext;
const playwright_1 = require("playwright");
async function createBrowser(options = {}) {
    // GPL's WAF / Akamai blocks standard headless mode, so headed is default.
    // Can be overridden by passing headless: true or setting HEADLESS=true.
    const headless = options.headless !== undefined
        ? options.headless
        : (process.env.HEADLESS === 'true');
    const browser = await playwright_1.chromium.launch({
        headless,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-size=1920,1080',
            '--start-maximized'
        ]
    });
    return browser;
}
async function createBrowserContext(browser) {
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezoneId: 'Asia/Kolkata',
        extraHTTPHeaders: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Ch-Ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Upgrade-Insecure-Requests': '1'
        }
    });
    return context;
}
