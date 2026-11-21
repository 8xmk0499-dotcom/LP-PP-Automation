import { BrowserContext } from 'playwright';
import { PageAuditResult, CapturedApiCall, NetworkRequestEntry } from '../types';
import { checkBustedUrl } from '../checks/busted-url.check';
import { checkHttpStatus } from '../checks/http-status.check';
import { checkPasswordProtection } from '../checks/password.check';
import { checkSeoData } from '../checks/seo.check';
import { checkGtmTags, TARGET_GTM_TAG } from '../checks/gtm.check';
import { checkClarityCode } from '../checks/clarity.check';
import { checkBeaconCode } from '../checks/beacon.check';
import { checkGclidAndIp } from '../checks/tracking.check';
import { handlePageForms, isLeadEnquiryResponse } from '../checks/form-handler';
import { checkMonotypeFont } from '../checks/monotype.check';
import { calculatePageSpeed } from '../checks/pagespeed.check';

export interface AuditOptions {
  srNo?: number;
  fillForms?: boolean;
  submitForms?: boolean;
  timeout?: number;
}

export async function auditPage(
  context: BrowserContext,
  targetUrl: string,
  options: AuditOptions = {}
): Promise<PageAuditResult> {
  const page = await context.newPage();

  // Stealth: Remove navigator.webdriver flag & install Web Vitals performance observers
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // Polyfill __name in browser context in case esbuild injects it
    (window as any).__name = function(target: any) { return target; };

    // Web Vitals Observers (LCP, CLS, TBT / LongTasks)
    (window as any).__perfMetrics = { lcp: 0, cls: 0, tbt: 0, longTasksCount: 0 };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          (window as any).__perfMetrics.lcp = Math.round(entry.startTime);
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            (window as any).__perfMetrics.cls += (entry as any).value;
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const blocking = entry.duration - 50;
          if (blocking > 0) {
            (window as any).__perfMetrics.tbt += Math.round(blocking);
          }
          (window as any).__perfMetrics.longTasksCount++;
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch {}
  });

  const networkRequests: NetworkRequestEntry[] = [];
  const networkUrls: string[] = [];
  const capturedNetworkData: { url: string; postData?: string; responseBody?: string }[] = [];
  const apiCallsCaptured: CapturedApiCall[] = [];
  const consoleErrors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Listen for JavaScript prompt() dialogs ("Enter password to view this page:")
  let passwordPromptDetected = false;
  let passwordPromptMessage = '';
  page.on('dialog', async dialog => {
    const msg = dialog.message();
    const type = dialog.type();
    if (
      type === 'prompt' ||
      type === 'alert' ||
      msg.toLowerCase().includes('password') ||
      msg.toLowerCase().includes('enter password')
    ) {
      if (
        msg.toLowerCase().includes('password') ||
        msg.toLowerCase().includes('enter password') ||
        type === 'prompt'
      ) {
        passwordPromptDetected = true;
        passwordPromptMessage = msg;
        // Enter password to view this page: gpl@123 to unlock the page
        await dialog.accept('gpl@123').catch(() => {});
        return;
      }
    }
    await dialog.dismiss().catch(() => {});
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
    const isApi =
      method === 'POST' ||
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

  page.on('response', async res => {
    const url = res.url();
    const method = res.request().method();
    const status = res.status();

    // Capture response data for relevant API calls
    const isApi =
      (method === 'POST' || url.includes('/api/') || url.includes('lead') || url.includes('enquiry')) &&
      !url.includes('.js') &&
      !url.includes('.css') &&
      !url.includes('.png') &&
      !url.includes('.svg');

    if (isApi) {
      let responseBody: any = null;
      try {
        const text = await res.text();
        try {
          responseBody = JSON.parse(text);
        } catch {
          responseBody = text.length > 500 ? text.substring(0, 500) + '...' : text;
        }
      } catch {}

      let postPayload: any = null;
      try {
        const postData = res.request().postData();
        if (postData) {
          try {
            postPayload = JSON.parse(postData);
          } catch {
            postPayload = postData;
          }
        }
      } catch {}

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
  const { result: bustedResult, response } = await checkBustedUrl(
    page,
    targetUrl,
    options.timeout || 35000
  );

  const loadTimeMs = Date.now() - startTime;

  // Case 3: HTTP Status Check
  const httpCheck = checkHttpStatus(response);

  // Case 1: Password Protection Check (Yes = protected in red, NO = not protected in green)
  const passwordCheck = await checkPasswordProtection(
    page,
    response,
    passwordPromptDetected,
    passwordPromptMessage
  );

  // Case 4 & 5: SEO Meta Title, Meta Description, Canonical URL, Index Follow
  const seoCheck = await checkSeoData(page);

  // Case 13: Check Monotype Font Family (GI Sans, GI Sans Display, GI Sans Text)
  const monotypeCheck = await checkMonotypeFont(page);

  // Case 14: Desktop & Mobile Page Speed Performance
  const pageSpeed = await calculatePageSpeed(page);

  // Case 10, 11, 12: Discover and fill any one form on page
  const formResult = await handlePageForms(page, {
    fillForms: options.fillForms !== false,
    submitForms: options.submitForms !== false
  });

  // Case 6: Standard GTM (GTM-M7T2KZD) + Other GTM Tags (by inspecting page and searching beacon in Network)
  const gtmCheck = await checkGtmTags(page, networkRequests, TARGET_GTM_TAG, formResult.thankYouPageDetected);

  // Case 7: Clarity Code (by inspecting page and searching clarity in Network)
  const clarityCheck = await checkClarityCode(page, networkRequests);

  // Case 8: Beacon Code (by inspecting page and searching beacon in Network)
  const beaconCheck = await checkBeaconCode(page, networkRequests);

  // Supplementary tracking check for GCLID & IP on page/network/cookies/dataLayer (for extended inspection drawer)
  const trackingCheck = await checkGclidAndIp(page, capturedNetworkData);

  // Verify and prioritize genuine lead enquiry API response from captured network calls
  let finalApiResponse = formResult.apiResponse;
  const isFormApiResponseValid = isLeadEnquiryResponse('', finalApiResponse);

  if (!isFormApiResponseValid || finalApiResponse === 'Failed Or Empty Response') {
    // Search in apiCallsCaptured specifically for /api/enquiry or PropStrength lead calls
    const enquiryCall = apiCallsCaptured.find(
      c => c.url.toLowerCase().includes('/api/enquiry') && c.responseBody
    ) || apiCallsCaptured.find(
      c => c.url.toLowerCase().includes('enquiry') && c.responseBody && typeof c.responseBody === 'object'
    ) || apiCallsCaptured.find(
      c => c.responseBody && (
        JSON.stringify(c.responseBody).includes('PropStrength') ||
        JSON.stringify(c.responseBody).includes('ENQ - ')
      )
    );

    if (enquiryCall && enquiryCall.responseBody) {
      finalApiResponse = typeof enquiryCall.responseBody === 'object'
        ? JSON.stringify(enquiryCall.responseBody, null, 4)
        : String(enquiryCall.responseBody);
    } else {
      finalApiResponse = 'Failed Or Empty Response';
    }
  }

  // Also ensure finalPayload prioritizes /api/enquiry payload
  let finalPayload = formResult.payload;
  if (!finalPayload || finalPayload === 'Not Found' || !finalPayload.includes('formData')) {
    const enquiryCall = apiCallsCaptured.find(
      c => c.url.toLowerCase().includes('/api/enquiry') && c.requestPayload
    ) || apiCallsCaptured.find(
      c => c.url.toLowerCase().includes('enquiry') && c.requestPayload
    ) || apiCallsCaptured.find(
      c => c.requestPayload && JSON.stringify(c.requestPayload).includes('formData')
    );

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
  const gclidStatus: 'Passed' | 'Failed' = hasGclidInPayload ? 'Passed' : 'Failed';
  const ipAddressStatus: 'Passed' | 'Failed' = hasIpInPayload ? 'Passed' : 'Failed';

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
