export interface FormFieldInfo {
  name: string;
  type: string;
  placeholder?: string;
  value?: string;
}

export interface CapturedForm {
  formId: string;
  formAction: string;
  formClass: string;
  fields: FormFieldInfo[];
  ctaButtonText?: string;
  isFilled: boolean;
  submissionAttempted: boolean;
}

export interface CapturedApiCall {
  url: string;
  method: string;
  status: number;
  requestHeaders?: Record<string, string>;
  requestPayload?: any;
  responseBody?: any;
  timestamp: string;
}

export interface NetworkRequestEntry {
  url: string;
  method: string;
  resourceType: string;
  postData?: string;
  headers?: Record<string, string>;
}

export interface PageAuditResult {
  // 20 Columns in Report (Exact Order: Monotype right after Clarity Code)
  srNo: number;                          // Column 1: Sr. No.
  pageUrl: string;                       // Column 2: Page URL
  httpStatus: string;                    // Column 3: HTTP Status
  httpStatusCode: number;
  passwordProtection: 'Yes' | 'NO';     // Column 4: Password Protected (Yes in Red, NO in Green)
  gtmTag: 'Passed' | 'Failed';           // Column 5: GTM-M7T2KZD
  beaconCode: 'Passed' | 'Failed';       // Column 6: Beacon Code
  clarityCode: 'Passed' | 'Failed';      // Column 7: Clarity Code
  monotype: 'Passed' | 'Failed';         // Column 8: Monotype (GI Sans fonts - after Clarity Code)
  gclid: 'Passed' | 'Failed';            // Column 9: GCLID
  ipAddress: 'Passed' | 'Failed';        // Column 10: IP Address
  formSubmission: 'Passed' | 'Failed' | 'Not Found'; // Column 11: Form Submission
  payload: string;                       // Column 12: Payload
  apiResponse: string;                   // Column 13: API Response
  seoMetaTitle: string;                  // Column 14: SEO Meta Title
  metaDescription: string;               // Column 15: Meta Description
  canonicalUrl: string;                  // Column 16: Canonical URL
  indexFollow: string;                   // Column 17: Index Follow
  otherGtmTags: string;                  // Column 18: Other GTM Tags
  desktopPageSpeed: number;              // Column 19: Desktop Page Speed (>= 80 green, else red)
  mobilePageSpeed: number;               // Column 20: Mobile Page Speed (>= 70 green, else red)

  // Internal / Extended telemetry
  gtmInspectionDetails?: string;
  clarityInspectionDetails?: string;
  beaconInspectionDetails?: string;
  monotypeDetails?: string;
  formDetails?: string;

  // Extended inspection data for rich HTML report
  bustedUrl: string;
  bustedUrlLoaded: boolean;
  gtmFoundOnThankYouPage?: boolean;
  detectedIpValue?: string;
  allGtmTagsList: string[];
  formsFound: CapturedForm[];
  apiCallsCaptured: CapturedApiCall[];
  consoleErrors: string[];
  loadTimeMs: number;
  testedAt: string;
}

export interface RunnerOptions {
  urls: string[];
  headless?: boolean;
  fillForms?: boolean;
  submitForms?: boolean;
  timeout?: number;
}
