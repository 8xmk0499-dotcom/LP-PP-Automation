"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkBustedUrl = checkBustedUrl;
const url_utils_1 = require("../utils/url-utils");
/**
 * Case 2 – Check page should open with busted url or not,
 * use ?busted=32refef in the end of the page link and change the text
 * after “=” sign to generate unique busted url every time when hit.
 */
async function checkBustedUrl(page, originalUrl, timeoutMs = 30000) {
    const token = (0, url_utils_1.generateBustedToken)();
    const bustedUrl = (0, url_utils_1.generateBustedUrl)(originalUrl, token);
    let response = null;
    let loaded = false;
    try {
        response = await page.goto(bustedUrl, {
            waitUntil: 'domcontentloaded',
            timeout: timeoutMs
        });
        // Allow brief settle for client scripts
        await page.waitForTimeout(2000);
        loaded = response !== null && response.status() < 400;
    }
    catch (error) {
        loaded = false;
    }
    const finalUrl = page.url();
    const responseStatus = response ? response.status() : 0;
    return {
        result: {
            bustedUrl,
            tokenUsed: token,
            loadedSuccessfully: loaded,
            finalUrl,
            responseStatus
        },
        response
    };
}
