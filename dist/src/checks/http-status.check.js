"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkHttpStatus = checkHttpStatus;
/**
 * Case 3 - Confirm HTTP 200 status code or not for given page.
 */
function checkHttpStatus(response) {
    if (!response) {
        return {
            statusCode: 0,
            statusText: 'No Response',
            is200: false,
            formattedOutput: '0 (Failed - No Response)'
        };
    }
    const code = response.status();
    const is200 = code === 200;
    return {
        statusCode: code,
        statusText: response.statusText(),
        is200,
        formattedOutput: is200 ? '200 (Passed)' : `${code} (Failed)`
    };
}
