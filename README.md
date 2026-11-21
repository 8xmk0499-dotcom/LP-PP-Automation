# Godrej Properties (GPL) Page Analysis & Quality Audit Automation

Enterprise-grade automated audit solution built with **Playwright** and **TypeScript** for analyzing landing pages and property pages from the Godrej Properties website ([godrejproperties.com](https://godrejproperties.com/)).

The suite validates page availability, cache-busting behavior, SEO tags, tracking telemetry (GTM, Microsoft Clarity, Salesforce Beacon, GCLID, IP address), lead capture forms/CTAs, and outgoing API payloads. It generates dual reports: an **Excel spreadsheet report** (strictly formatted with the 13 required columns in a single sheet) and a **responsive, modern HTML dashboard** optimized for both desktop and mobile viewports.

---

## 📋 Audit Test Cases Covered

| Case | Test Description | Success Criteria | Output Column |
| :--- | :--- | :--- | :--- |
| **Case 1** | **Password Protected** | Checks for JavaScript "Enter password to view this page" popup dialogs, "Access Denied" screens, or auth walls. | `Yes` (Red) if protected / popup visible; `NO` (Green) if open. |
| **Case 2** | **Cache-Busting URL Navigation** | Generates and appends unique `?busted=<unique_token>` every run. Validates page load. | Recorded in detailed report & URL hit. |
| **Case 3** | **HTTP Status Code** | Confirms whether page returns HTTP 200 OK. | `200 (Passed)` or `<Code> (Failed)`. |
| **Case 4** | **SEO Meta Data** | Extracts `<title>`, `<meta name="title">`, `<meta name="description">`, and `<link rel="canonical">`. | `SEO Meta Title`, `Meta Description`, `Canonical URL`. |
| **Case 5** | **Index / Follow Directives** | Evaluates `<meta name="robots">` / `<meta name="googlebot">`. | `Passed (index, follow)` or `Failed (noindex)`. |
| **Case 6** | **GTM Tags & Network Beacon** | Inspects page DOM (scripts, dataLayer, GTM globals), filters **beacon** requests in Network, and verifies standard tag `GTM-M7T2KZD` on Main & Thank You page; captures all other GTM tags. | `GTM-M7T2KZD` (`Passed`/`Failed`), `Other GTM Tags` (Comma-separated list or `None`). |
| **Case 7** | **Microsoft Clarity Code** | Inspects page DOM and searches **clarity** in Network for `https://www.clarity.ms/tag/ulvpk6eqzz` (ID `ulvpk6eqzz`). | `Clarity Code` (`Passed` / `Failed`). |
| **Case 8** | **Salesforce Beacon Code** | Inspects page DOM and searches **beacon** in Network for `https://cdn.c360a.salesforce.com/beacon/c360a/81ab4cd6-a5cb-41f8-a83e-7878b2b4537a/scripts/c360a.min.js`. | `Beacon Code` (`Passed` / `Failed`). |
| **Case 10** | **Form Submission** | Fills unique inputs (Name: `Test`, Last Name: `Tester`, Mobile: `9860098300` with **Indian country code ONLY (+91 / India)**, unique Email `testlead...`, dropdown selections, Country: `India`). Automatically **detects interrupting popups during form filling, stops filling to close popup first, then resumes**. Submits via various CTA buttons (`Submit`, `Enquire Now`, `Request a private preview`, `Schedule a visite`, etc.) and verifies Thank You / confirmation and redirect back. | `Passed` / `Failed` / `Not Found`. |
| **Case 11** | **Form Payload** | Inspects and captures the submitted form payload. | Formatted payload JSON or `Not Found`. |
| **Case 12** | **API Response** | Inspects and captures the HTTP status and body response from the submission endpoint. | Formatted response or `Not Found`. |
| **Case 13** | **Monotype Font Family** | Verifies if font-family is `GI Sans`, `GI Sans Display` or `GI Sans Text`. | `Passed` / `Failed`. |
| **Case 14** | **Page Speed Performance** | Measures Desktop & Mobile performance score (0-100). Mobile green if 70-80, else red. Desktop green if 80-90, else red. | `Desktop Page Speed`, `Mobile Page Speed`. |

---

## 📊 Report Formats & Structure

### 1. Excel Report (`Excel Report/analysis_report-<N>.xlsx`)
- Stored under: `Excel Report/`
- Contains **exactly one sheet** named `GPL Page Analysis`.
- Contains **strictly the 15 required columns in the exact arranged sequence**:
  1. `Sr. No.`
  2. `Page URL`
  3. `HTTP Status`
  4. `Password Protected` (`Yes` in Red if password prompt/access denied, `NO` in Green if open; unlocks with `gpl@123`)
  5. `GTM-M7T2KZD` (`Passed` / `Failed`)
  6. `Beacon Code` (`Passed` / `Failed`)
  7. `Clarity Code` (`Passed` / `Failed`)
  8. `Monotype` (`Passed` in Green if font-family contains `GI Sans`, `GI Sans Display` or `GI Sans Text`, else `Failed` in Red)
  9. `SEO Meta Title` (`Not Found` in Red)
  10. `Meta Description` (`Not Found` in Red)
  11. `Canonical URL` (`Not Found` in Red)
  12. `Index Follow` (`Passed` in Green if `index, follow`, else `Failed` in Red)
  13. `Other GTM Tags` (Discovered tags, e.g. `GTM-WEBTEMPLATE`, `GTM-W3CGF5G2`, etc.)
  14. `Desktop Page Speed` (Above 80 [≥ 80] in Green, else Red)
  15. `Mobile Page Speed` (Above 70 [≥ 70] in Green, else Red)
- Styled with Godrej Deep Navy headers, Calibri typography, auto-adjusted column widths, color-coded status badges (`Passed` in light green, `Failed` in light red, `Yes` in red, `NO` in green), and **"Not Found" text highlighted in red colour**.

### 2. HTML Report (`Html Report/analysis_report-<N>.html`)
- Stored under: `Html Report/`
- **Responsive on Desktop & Mobile** (switches to vertical card views on phones/tablets).
- Self-contained styles (no internet or external CSS/CDN needed to view).
- **Executive KPI Cards**: Total Pages Audited, Pass Rate %, Forms Detected, APIs Intercepted.
- **Search & Filter Bar**: Instant search by URL or keyword, filter by Pass/Fail status.
- **Expandable Deep-Inspection Drawer**:
  - Google SERP Snippet Preview (how the page looks on Google search results).
  - Busted URL hit and page load latency in milliseconds.
  - Telemetry breakdown for GTM, Clarity, Salesforce Beacon, GCLID, and IP.
  - Discovered form fields, form IDs, action endpoints, and CTA buttons.
  - Formatted JSON code blocks of all captured outgoing API payloads and backend responses.

---

## 🚀 How to Run the Automation

### Method 1: Interactive Prompt (Easiest)
Run without any arguments. The script will prompt you in the terminal to enter 1 or more URLs separated by commas, or press Enter to run all URLs from `urls.txt`:
```bash
npm start
```

### Method 2: Command Line Argument with Multiple URLs
Pass URLs directly using the `--urls` flag (separated by commas):
```bash
npm start -- --urls="https://www.godrejproperties.com/,https://www.godrejproperties.com/mumbai"
```

### Method 3: Batch Run via `urls.txt`
Add any number of URLs into [urls.txt](file:///d:/GPL%20New%20Automation/Page%20Analysis/urls.txt) (one per line), and run:
```bash
npm start -- --file=urls.txt
```
*(Or simply press **Enter** when prompted).*

### Optional Flags:
- `--headless`: Run browser in headless mode (default is headed in **full-screen size** to bypass Akamai bot detection on GPL and provide complete visibility).
- `--submit`: Submit the lead form after filling test data to test the thank you page and redirection.

### 🖥️ Full Screen & Visible Form Filling in Headed Mode:
- **Full Screen Browser**: Headed mode launches Chromium with `--start-maximized` and dynamic native screen viewport so you can see the whole webpage clearly across your monitor.
- **Visible Form Filling**:
  - **Required Input Verification**: Before submitting the form, scans and checks all required and invalid form controls (`[required]`, `[aria-required]`, asterisk `*`, and mandatory fields). If any required field is empty or unselected, it automatically fills it with valid test inputs before submitting.
  - **Popup Stopper & Resume**: If an interrupting popup/modal opens on the page while form filling, the automation immediately stops form filling, closes the popup first, waits for dismissal, and then seamlessly resumes filling the form.
  - **Indian Country Code Only & Fast Submission**: Checks if an India-related country code (`+91`, `India`, `IND`, `IN`) is already present by default; if present, skips redundant dropdown checks and submits the form quickly without wasting time. If not present, automatically sets the code to `+91` / `India`.
  - **Multiple CTA Submit Buttons**: Supports real-estate CTA button variations beyond standard submit, including `Enquire Now`, `Request a private preview`, `Schedule a visite`, `Schedule a visit`, `Book a Site Visit`, `Download Brochure`, and `Submit`.
  - Automatically scrolls the form container and active fields into view.
  - Highlights each active input with a colored focus ring.
  - Types character-by-character with realistic typing delay (65ms/char) instead of instantaneous injection.
  - Pauses after filling each field and selecting dropdowns so you can clearly observe every entry being typed and selected.
  - Visually pulses the submit CTA button before clicking and waits for confirmation / redirect.

---

## 🛠️ Project Structure

```
Page Analysis/
├── Excel Report/                  # Generated Excel reports (analysis_report-1.xlsx, etc.)
├── Html Report/                   # Generated HTML reports (analysis_report-1.html, etc.)
├── src/
│   ├── types/
│   │   └── index.ts               # TypeScript data definitions & audit results
│   ├── core/
│   │   ├── browser.ts             # Playwright browser manager with anti-detection headers
│   │   └── auditor.ts             # Core audit runner coordinating all checks
│   ├── checks/
│   │   ├── password.check.ts      # Case 1: Password protection verification
│   │   ├── busted-url.check.ts    # Case 2: Cache-busting URL generator & validator
│   │   ├── http-status.check.ts   # Case 3: HTTP 200 verification
│   │   ├── seo.check.ts           # Case 4 & 5: SEO Meta & Index/Follow
│   │   ├── gtm.check.ts           # Case 6: Standard GTM (GTM-M7T2KZD) & other tags
│   │   ├── clarity.check.ts       # Case 7: Microsoft Clarity code (ulvpk6eqzz)
│   │   ├── beacon.check.ts        # Case 8: Salesforce Beacon code
│   │   ├── tracking.check.ts      # Case 9: GCLID & IP Address detection
│   │   └── form-handler.ts        # Lead form finder, safe data fill & API interceptor
│   ├── reporters/
│   │   ├── excel.reporter.ts      # 13-column single-sheet Excel report generator
│   │   └── html.reporter.ts       # Responsive desktop & mobile HTML dashboard
│   ├── utils/
│   │   ├── url-utils.ts           # URL normalizer & random token generator
│   │   ├── file-naming.ts         # Non-overwriting paired report sequence generator
│   │   └── cli-prompt.ts          # Interactive prompt & argument parser
│   └── index.ts                   # Main application entry point
├── urls.txt                       # Input file for batch URL testing
├── package.json                   # Dependencies and run scripts
├── tsconfig.json                  # TypeScript compiler options
└── README.md                      # Complete documentation
```
