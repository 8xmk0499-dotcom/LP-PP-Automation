"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditPage = auditPage;
const busted_url_check_1 = require("../checks/busted-url.check");
const http_status_check_1 = require("../checks/http-status.check");
const password_check_1 = require("../checks/password.check");
const seo_check_1 = require("../checks/seo.check");
const gtm_check_1 = require("../checks/gtm.check");
const clarity_check_1 = require("../checks/clarity.check");
const beacon_check_1 = require("../checks/beacon.check");
const tracking_check_1 = require("../checks/tracking.check");
const form_handler_1 = require("../checks/form-handler");
async function auditPage(context, targetUrl, options = {}) {
    const page = await context.newPage();
    // Stealth: Remove navigator.webdriver flag
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    const networkUrls = [];
    const capturedNetworkData = [];
    const apiCallsCaptured = [];
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });
    // Intercept and record network requests & responses
    page.on('request', req => {
        const url = req.url();
        networkUrls.push(url);
        const method = req.method();
        const postData = req.postData() || undefined;
        // Track CRM, lead, or analytics API calls
        const isApi = method === 'POST' ||
            url.includes('/api/') ||
            url.includes('lead') ||
            url.includes('enquiry') ||
            url.includes('submit') ||
            url.includes('c360a') ||
            url.includes('ipify');
        if (isApi) {
            capturedNetworkData.push({ url, postData });
        }
    });
    page.on('response', async (res) => {
        const url = res.url();
        const method = res.request().method();
        const status = res.status();
        // Capture response data for relevant API calls
        const isApi = (method === 'POST' || url.includes('/api/') || url.includes('lead') || url.includes('enquiry')) &&
            !url.includes('.js') &&
            !url.includes('.css') &&
            !url.includes('.png') &&
            !url.includes('.svg');
        if (isApi) {
            let responseBody = null;
            try {
                const text = await res.text();
                try {
                    responseBody = JSON.parse(text);
                }
                catch {
                    responseBody = text.length > 500 ? text.substring(0, 500) + '...' : text;
                }
            }
            catch { }
            let postPayload = null;
            try {
                const postData = res.request().postData();
                if (postData) {
                    try {
                        postPayload = JSON.parse(postData);
                    }
                    catch {
                        postPayload = postData;
                    }
                }
            }
            catch { }
            apiCallsCaptured.push({
                url,
                method,
                status,
                requestPayload: postPayload,
                responseBody,
                timestamp: new Date().toISOString()
            });
        }
    });
    const startTime = Date.now();
    // Case 2: Hit page with busted URL (?busted=<unique_token>)
    const { result: bustedResult, response } = await (0, busted_url_check_1.checkBustedUrl)(page, targetUrl, options.timeout || 35000);
    const loadTimeMs = Date.now() - startTime;
    // Case 3: HTTP Status Check
    const httpCheck = (0, http_status_check_1.checkHttpStatus)(response);
    // Case 1: Password Protection Check
    const passwordCheck = await (0, password_check_1.checkPasswordProtection)(page, response);
    // Case 4 & 5: SEO Meta Title, Meta Description, Canonical URL, Index Follow
    const seoCheck = await (0, seo_check_1.checkSeoData)(page);
    // Form & CTA Discovery + Fill Test Data
    const formResult = await (0, form_handler_1.discoverAndFillForms)(page, {
        fillForms: options.fillForms !== false,
        submitForms: options.submitForms === true
    });
    // Case 6: Standard GTM (GTM-M7T2KZD) + Other GTM Tags
    const gtmCheck = await (0, gtm_check_1.checkGtmTags)(page, networkUrls, gtm_check_1.TARGET_GTM_TAG);
    // Case 7: Clarity Code (ulvpk6eqzz)
    const clarityCheck = await (0, clarity_check_1.checkClarityCode)(page, networkUrls);
    // Case 8: Beacon Code (81ab4cd6-a5cb-41f8-a83e-7878b2b4537a)
    const beaconCheck = await (0, beacon_check_1.checkBeaconCode)(page, networkUrls);
    // Case 9: GCLID & IP Address
    const trackingCheck = await (0, tracking_check_1.checkGclidAndIp)(page, capturedNetworkData);
    await page.close();
    return {
        pageUrl: targetUrl,
        httpStatus: httpCheck.formattedOutput,
        httpStatusCode: httpCheck.statusCode,
        passwordProtection: passwordCheck.status,
        seoMetaTitle: seoCheck.metaTitle,
        metaDescription: seoCheck.metaDescription,
        canonicalUrl: seoCheck.canonicalUrl,
        indexFollow: seoCheck.indexFollowStatus,
        gtmTag: gtmCheck.standardGtmPassed,
        otherGtmTags: gtmCheck.otherGtmTags,
        beaconCode: beaconCheck.status,
        clarityCode: clarityCheck.status,
        gclid: trackingCheck.gclidStatus,
        ipAddress: trackingCheck.ipStatus,
        // Extended audit properties
        bustedUrl: bustedResult.bustedUrl,
        bustedUrlLoaded: bustedResult.loadedSuccessfully,
        gtmFoundOnThankYouPage: formResult.thankYouGtmFound,
        detectedIpValue: trackingCheck.detectedIp,
        allGtmTagsList: gtmCheck.allGtmTags,
        formsFound: formResult.formsFound,
        apiCallsCaptured,
        consoleErrors,
        loadTimeMs,
        testedAt: new Date().toISOString()
    };
}
