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
const monotype_check_1 = require("../checks/monotype.check");
const pagespeed_check_1 = require("../checks/pagespeed.check");
async function auditPage(context, targetUrl, options = {}) {
    const page = await context.newPage();
    // Stealth: Remove navigator.webdriver flag & install Web Vitals performance observers
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        // Polyfill __name in browser context in case esbuild injects it
        window.__name = function (target) { return target; };
        // Web Vitals Observers (LCP, CLS, TBT / LongTasks)
        window.__perfMetrics = { lcp: 0, cls: 0, tbt: 0, longTasksCount: 0 };
        try {
            new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    window.__perfMetrics.lcp = Math.round(entry.startTime);
                }
            }).observe({ type: 'largest-contentful-paint', buffered: true });
        }
        catch { }
        try {
            new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (!entry.hadRecentInput) {
                        window.__perfMetrics.cls += entry.value;
                    }
                }
            }).observe({ type: 'layout-shift', buffered: true });
        }
        catch { }
        try {
            new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    const blocking = entry.duration - 50;
                    if (blocking > 0) {
                        window.__perfMetrics.tbt += Math.round(blocking);
                    }
                    window.__perfMetrics.longTasksCount++;
                }
            }).observe({ type: 'longtask', buffered: true });
        }
        catch { }
    });
    const networkRequests = [];
    const networkUrls = [];
    const capturedNetworkData = [];
    const apiCallsCaptured = [];
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });
    // Listen for JavaScript prompt() dialogs ("Enter password to view this page:")
    let passwordPromptDetected = false;
    let passwordPromptMessage = '';
    page.on('dialog', async (dialog) => {
        const msg = dialog.message();
        const type = dialog.type();
        if (type === 'prompt' ||
            type === 'alert' ||
            msg.toLowerCase().includes('password') ||
            msg.toLowerCase().includes('enter password')) {
            if (msg.toLowerCase().includes('password') ||
                msg.toLowerCase().includes('enter password') ||
                type === 'prompt') {
                passwordPromptDetected = true;
                passwordPromptMessage = msg;
                // Enter password to view this page: gpl@123 to unlock the page
                await dialog.accept('gpl@123').catch(() => { });
                return;
            }
        }
        await dialog.dismiss().catch(() => { });
    });
    // Intercept and record network requests & responses
    page.on('request', req => {
        const url = req.url();
        const method = req.method();
        const resourceType = req.resourceType();
        const postData = req.postData() || undefined;
        const headers = req.headers();
        networkUrls.push(url);
        networkRequests.push({
            url,
            method,
            resourceType,
            postData,
            headers
        });
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
    // Case 1: Password Protection Check (Yes = protected in red, NO = not protected in green)
    const passwordCheck = await (0, password_check_1.checkPasswordProtection)(page, response, passwordPromptDetected, passwordPromptMessage);
    // Case 4 & 5: SEO Meta Title, Meta Description, Canonical URL, Index Follow
    const seoCheck = await (0, seo_check_1.checkSeoData)(page);
    // Case 13: Check Monotype Font Family (GI Sans, GI Sans Display, GI Sans Text)
    const monotypeCheck = await (0, monotype_check_1.checkMonotypeFont)(page);
    // Case 14: Desktop & Mobile Page Speed Performance
    const pageSpeed = await (0, pagespeed_check_1.calculatePageSpeed)(page);
    // Case 10, 11, 12: Discover and fill any one form on page
    const formResult = await (0, form_handler_1.handlePageForms)(page, {
        fillForms: options.fillForms !== false,
        submitForms: options.submitForms !== false
    });
    // Case 6: Standard GTM (GTM-M7T2KZD) + Other GTM Tags (by inspecting page and searching beacon in Network)
    const gtmCheck = await (0, gtm_check_1.checkGtmTags)(page, networkRequests, gtm_check_1.TARGET_GTM_TAG, formResult.thankYouPageDetected);
    // Case 7: Clarity Code (by inspecting page and searching clarity in Network)
    const clarityCheck = await (0, clarity_check_1.checkClarityCode)(page, networkRequests);
    // Case 8: Beacon Code (by inspecting page and searching beacon in Network)
    const beaconCheck = await (0, beacon_check_1.checkBeaconCode)(page, networkRequests);
    // Supplementary tracking check for GCLID & IP on page/network/cookies/dataLayer (for extended inspection drawer)
    const trackingCheck = await (0, tracking_check_1.checkGclidAndIp)(page, capturedNetworkData);
    // Verify and prioritize genuine lead enquiry API response from captured network calls
    let finalApiResponse = formResult.apiResponse;
    const isFormApiResponseValid = (0, form_handler_1.isLeadEnquiryResponse)('', finalApiResponse);
    if (!isFormApiResponseValid || finalApiResponse === 'Failed Or Empty Response') {
        // Search in apiCallsCaptured specifically for /api/enquiry or PropStrength lead calls
        const enquiryCall = apiCallsCaptured.find(c => c.url.toLowerCase().includes('/api/enquiry') && c.responseBody) || apiCallsCaptured.find(c => c.url.toLowerCase().includes('enquiry') && c.responseBody && typeof c.responseBody === 'object') || apiCallsCaptured.find(c => c.responseBody && (JSON.stringify(c.responseBody).includes('PropStrength') ||
            JSON.stringify(c.responseBody).includes('ENQ - ')));
        if (enquiryCall && enquiryCall.responseBody) {
            finalApiResponse = typeof enquiryCall.responseBody === 'object'
                ? JSON.stringify(enquiryCall.responseBody, null, 4)
                : String(enquiryCall.responseBody);
        }
        else {
            finalApiResponse = 'Failed Or Empty Response';
        }
    }
    // Also ensure finalPayload prioritizes /api/enquiry payload
    let finalPayload = formResult.payload;
    if (!finalPayload || finalPayload === 'Not Found' || !finalPayload.includes('formData')) {
        const enquiryCall = apiCallsCaptured.find(c => c.url.toLowerCase().includes('/api/enquiry') && c.requestPayload) || apiCallsCaptured.find(c => c.url.toLowerCase().includes('enquiry') && c.requestPayload) || apiCallsCaptured.find(c => c.requestPayload && JSON.stringify(c.requestPayload).includes('formData'));
        if (enquiryCall && enquiryCall.requestPayload) {
            finalPayload = typeof enquiryCall.requestPayload === 'object'
                ? JSON.stringify(enquiryCall.requestPayload, null, 4)
                : String(enquiryCall.requestPayload);
        }
    }
    // User Requirement:
    // "If you find GCLID & IP Address in Payload then on wright passed in report otherwise failed refer screenshot for example"
    const payloadStr = finalPayload || '';
    const payloadLower = payloadStr.toLowerCase();
    let hasGclidInPayload = false;
    let hasIpInPayload = false;
    if (payloadStr && payloadStr !== 'Not Found') {
        // 1. GCLID check strictly in Payload (e.g. googleGCLID, gclid, gcl_id)
        hasGclidInPayload =
            payloadLower.includes('gclid') ||
                payloadLower.includes('gcl_id');
        // 2. IP Address check strictly in Payload (e.g. userIPAddress, ipAddress, ip_address, client_ip, user_ip, or IPv4 pattern)
        hasIpInPayload =
            payloadLower.includes('useripaddress') ||
                payloadLower.includes('ipaddress') ||
                payloadLower.includes('ip_address') ||
                payloadLower.includes('client_ip') ||
                payloadLower.includes('user_ip') ||
                (payloadLower.includes('userip') && payloadLower.includes('address')) ||
                /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(payloadStr);
    }
    // Strictly write Passed if present in Payload, otherwise Failed
    const gclidStatus = hasGclidInPayload ? 'Passed' : 'Failed';
    const ipAddressStatus = hasIpInPayload ? 'Passed' : 'Failed';
    await page.close();
    return {
        srNo: options.srNo || 1,
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
        gclid: gclidStatus,
        ipAddress: ipAddressStatus,
        formSubmission: formResult.formSubmissionStatus,
        payload: finalPayload,
        apiResponse: finalApiResponse,
        monotype: monotypeCheck.status,
        desktopPageSpeed: pageSpeed.desktopScore,
        mobilePageSpeed: pageSpeed.mobileScore,
        // Extended inspection details for Cases 6, 7, 8, 10, 13
        gtmInspectionDetails: gtmCheck.inspectionDetails,
        clarityInspectionDetails: clarityCheck.inspectionDetails,
        beaconInspectionDetails: beaconCheck.inspectionDetails,
        monotypeDetails: monotypeCheck.details,
        formDetails: formResult.details,
        // Extended audit properties
        bustedUrl: bustedResult.bustedUrl,
        bustedUrlLoaded: bustedResult.loadedSuccessfully,
        gtmFoundOnThankYouPage: formResult.thankYouPageDetected,
        detectedIpValue: trackingCheck.detectedIp,
        allGtmTagsList: gtmCheck.allGtmTags,
        formsFound: formResult.formsFound,
        apiCallsCaptured,
        consoleErrors,
        loadTimeMs,
        testedAt: new Date().toISOString()
    };
}
