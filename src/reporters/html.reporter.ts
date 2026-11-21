import fs from 'fs';
import { PageAuditResult } from '../types';

/**
 * Escapes HTML characters to prevent XSS.
 */
function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Highlights 'Not Found' text in red colour, with optional truncation for normal text.
 */
function renderCellContent(text: string | undefined | null, maxLen?: number): string {
  if (!text) return '<span class="text-not-found">Not Found</span>';
  const trimmed = text.trim();
  if (trimmed.toLowerCase() === 'not found') {
    return '<span class="text-not-found">Not Found</span>';
  }
  if (trimmed.toLowerCase().includes('not found')) {
    const display = maxLen && text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
    return escapeHtml(display).replace(/not found/gi, '<span class="text-not-found">Not Found</span>');
  }
  const display = maxLen && text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
  return escapeHtml(display);
}

/**
 * Requirement: Capture whole Response and put it in API Response column.
 * If Failed Or Empty Response or error, display in red.
 */
function renderApiResponseContent(text: string | undefined | null, maxLen: number = 40): string {
  if (!text) return '<span class="text-not-found">Failed Or Empty Response</span>';
  const trimmed = text.trim();
  if (
    trimmed === 'Failed Or Empty Response' ||
    trimmed.toLowerCase() === 'failed or empty response' ||
    trimmed.toLowerCase() === 'empty response' ||
    trimmed.toLowerCase() === 'not found'
  ) {
    return '<span class="text-not-found">Failed Or Empty Response</span>';
  }
  if (trimmed.includes('Too many requests') || (trimmed.startsWith('{') && trimmed.includes('"error"'))) {
    const singleLine = trimmed.replace(/\s+/g, ' ');
    const display = maxLen && singleLine.length > maxLen ? singleLine.substring(0, maxLen) + '...' : singleLine;
    return '<span class="text-not-found">' + escapeHtml(display) + '</span>';
  }
  const singleLine = trimmed.replace(/\s+/g, ' ');
  const display = maxLen && singleLine.length > maxLen ? singleLine.substring(0, maxLen) + '...' : singleLine;
  return escapeHtml(display);
}

/**
 * Generates an ultra-clean, mobile-responsive HTML report.
 */
export async function generateHtmlReport(
  results: PageAuditResult[],
  outputPath: string,
  reportNumber: number
): Promise<string> {
  const totalPages = results.length;
  const passedPages = results.filter(r =>
    r.httpStatus.includes('200') &&
    r.passwordProtection === 'NO' &&
    r.gtmTag === 'Passed'
  ).length;

  const totalForms = results.reduce((acc, r) => acc + (r.formsFound?.length || 0), 0);
  const totalApiCalls = results.reduce((acc, r) => acc + (r.apiCallsCaptured?.length || 0), 0);
  const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GPL Landing Page Analysis Report #${reportNumber}</title>
  <style>
    :root {
      --primary: #0F2F57;
      --primary-light: #1E3A8A;
      --accent: #D97706;
      --bg: #F8FAFC;
      --surface: #FFFFFF;
      --text: #0F172A;
      --text-muted: #64748B;
      --border: #E2E8F0;
      --pass-bg: #DCFCE7;
      --pass-text: #166534;
      --fail-bg: #FEE2E2;
      --fail-text: #991B1B;
      --warn-bg: #FEF3C7;
      --warn-text: #92400E;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 16px;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    /* Header */
    header {
      background: linear-gradient(135deg, #0F2F57 0%, #1E3A8A 100%);
      color: white;
      padding: 24px 28px;
      border-radius: 12px;
      margin-bottom: 24px;
      box-shadow: 0 4px 12px rgba(15, 47, 87, 0.15);
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }

    .header-title h1 {
      font-size: 1.6rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-title p {
      font-size: 0.88rem;
      color: #CBD5E1;
      margin-top: 4px;
    }

    .header-badge {
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(8px);
      padding: 8px 16px;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 600;
      border: 1px solid rgba(255, 255, 255, 0.25);
    }

    /* Summary KPI Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .kpi-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 18px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .kpi-label {
      font-size: 0.8rem;
      text-transform: uppercase;
      font-weight: 600;
      color: var(--text-muted);
      letter-spacing: 0.05em;
    }

    .kpi-value {
      font-size: 1.8rem;
      font-weight: 700;
      color: var(--primary);
    }

    .kpi-desc {
      font-size: 0.78rem;
      color: var(--text-muted);
    }

    /* Controls Bar */
    .controls-bar {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
    }

    .search-box {
      flex: 1;
      min-width: 240px;
      display: flex;
      align-items: center;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8px 12px;
    }

    .search-box input {
      border: none;
      background: transparent;
      outline: none;
      width: 100%;
      font-size: 0.9rem;
      color: var(--text);
    }

    .filter-select {
      border: 1px solid var(--border);
      background: var(--surface);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 0.88rem;
      outline: none;
      cursor: pointer;
    }

    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid var(--border);
      background: var(--surface);
      transition: all 0.2s ease;
    }

    .btn:hover {
      background: #F1F5F9;
    }

    /* Table Container */
    .table-container {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow-x: auto;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
      margin-bottom: 30px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      min-width: 1100px;
    }

    th {
      background: #0F2F57;
      color: white;
      text-align: left;
      padding: 12px 14px;
      font-weight: 600;
      white-space: nowrap;
      position: sticky;
      top: 0;
    }

    td {
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
    }

    tr:nth-child(even) td {
      background-color: #FAFCFE;
    }

    tr:hover td {
      background-color: #F1F5F9;
    }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.78rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .badge-pass {
      background-color: var(--pass-bg);
      color: var(--pass-text);
      border: 1px solid #BBF7D0;
    }

    .badge-fail {
      background-color: var(--fail-bg);
      color: var(--fail-text);
      border: 1px solid #FECACA;
    }

    .badge-warn {
      background-color: var(--warn-bg);
      color: var(--warn-text);
      border: 1px solid #FDE68A;
    }

    .text-not-found {
      color: #DC2626 !important;
      font-weight: 700;
      background-color: #FEE2E2;
      padding: 2px 7px;
      border-radius: 4px;
      border: 1px solid #FECACA;
      display: inline-block;
      font-size: 0.78rem;
      white-space: nowrap;
    }

    .url-link {
      color: #1D4ED8;
      text-decoration: none;
      font-weight: 500;
      word-break: break-all;
    }

    .url-link:hover {
      text-decoration: underline;
    }

    .toggle-details-btn {
      background: none;
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 0.75rem;
      cursor: pointer;
      color: var(--text-muted);
    }

    .toggle-details-btn:hover {
      background: #E2E8F0;
      color: var(--text);
    }

    /* Deep Details Drawer */
    .details-row {
      display: none;
    }

    .details-row.active {
      display: table-row;
    }

    .details-container {
      background: #F8FAFC;
      padding: 18px 24px;
      border-bottom: 2px solid var(--border);
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
    }

    .details-card {
      background: white;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
    }

    .details-card h4 {
      font-size: 0.85rem;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 10px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 6px;
    }

    .details-list {
      list-style: none;
      font-size: 0.8rem;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .details-list li {
      display: flex;
      justify-content: space-between;
      gap: 10px;
    }

    .details-list .lbl {
      color: var(--text-muted);
      font-weight: 500;
    }

    .details-list .val {
      font-weight: 600;
      word-break: break-word;
      text-align: right;
    }

    /* SERP Google Preview */
    .serp-box {
      font-family: Arial, sans-serif;
      padding: 10px;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
    }

    .serp-url {
      font-size: 0.75rem;
      color: #202124;
      line-height: 1.3;
      margin-bottom: 2px;
      word-break: break-all;
    }

    .serp-title {
      font-size: 0.95rem;
      color: #1a0dab;
      text-decoration: none;
      font-weight: 400;
      line-height: 1.3;
      cursor: pointer;
    }

    .serp-title:hover {
      text-decoration: underline;
    }

    .serp-desc {
      font-size: 0.8rem;
      color: #4d5156;
      line-height: 1.4;
      margin-top: 4px;
    }

    /* Code block for API calls */
    .code-block {
      background: #0F172A;
      color: #38BDF8;
      font-family: Consolas, monospace;
      font-size: 0.75rem;
      padding: 10px;
      border-radius: 6px;
      max-height: 180px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }

    /* Mobile Responsive Card Overrides */
    @media (max-width: 768px) {
      body { padding: 10px; }
      header { padding: 18px; }
      .header-title h1 { font-size: 1.25rem; }
      .kpi-value { font-size: 1.4rem; }
      .table-container { border: none; background: transparent; box-shadow: none; }
      table, thead, tbody, th, td, tr { display: block; }
      thead tr { position: absolute; top: -9999px; left: -9999px; }
      tr.main-row {
        background: white;
        border: 1px solid var(--border);
        border-radius: 10px;
        margin-bottom: 14px;
        padding: 14px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      }
      td {
        border: none;
        padding: 6px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        text-align: right;
      }
      td::before {
        content: attr(data-label);
        font-weight: 600;
        color: var(--text-muted);
        text-align: left;
        margin-right: 12px;
      }
      .details-container {
        grid-template-columns: 1fr;
        padding: 12px;
      }
    }
  </style>
</head>
<body>

<div class="container">
  <!-- Header -->
  <header>
    <div class="header-title">
      <h1>Godrej Properties Landing Page Analysis</h1>
      <p>Automated Playwright + TypeScript Quality & Tracking Audit • Generated ${generatedAt}</p>
    </div>
    <div class="header-badge">
      Report #${reportNumber}
    </div>
  </header>

  <!-- KPI Summary Cards -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <span class="kpi-label">Pages Audited</span>
      <span class="kpi-value">${totalPages}</span>
      <span class="kpi-desc">Landing & Property URLs</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Fully Passing Pages</span>
      <span class="kpi-value" style="color: #16A34A;">${passedPages}</span>
      <span class="kpi-desc">${totalPages > 0 ? Math.round((passedPages / totalPages) * 100) : 0}% success rate</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Forms Detected</span>
      <span class="kpi-value">${totalForms}</span>
      <span class="kpi-desc">Lead / Enquiry CTAs Tested</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">APIs Intercepted</span>
      <span class="kpi-value">${totalApiCalls}</span>
      <span class="kpi-desc">Lead & Telemetry calls</span>
    </div>
  </div>

  <!-- Search & Filter Controls -->
  <div class="controls-bar">
    <div class="search-box">
      <input type="text" id="searchInput" placeholder="Search by URL, Title, or Tag..." onkeyup="filterTable()">
    </div>
    <div style="display: flex; gap: 10px;">
      <select id="statusFilter" class="filter-select" onchange="filterTable()">
        <option value="ALL">All Pages</option>
        <option value="PASS">HTTP 200 Only</option>
        <option value="FAIL">Has Failures</option>
      </select>
      <button class="btn" onclick="window.print()">Print Report</button>
    </div>
  </div>

  <!-- Main Analysis Table -->
  <div class="table-container">
    <table id="analysisTable">
      <thead>
        <tr>
          <th>Sr. No.</th>
          <th>Page URL</th>
          <th>HTTP Status</th>
          <th>Password Protected</th>
          <th>GTM-M7T2KZD</th>
          <th>Beacon Code</th>
          <th>Clarity Code</th>
          <th>Monotype</th>
          <th>GCLID</th>
          <th>IP Address</th>
          <th>Form Submission</th>
          <th>Payload</th>
          <th>API Response</th>
          <th>SEO Meta Title</th>
          <th>Meta Description</th>
          <th>Canonical URL</th>
          <th>Index Follow</th>
          <th>Other GTM Tags</th>
          <th>Desktop Page Speed</th>
          <th>Mobile Page Speed</th>
          <th>Inspect</th>
        </tr>
      </thead>
      <tbody>
        ${results.map((r, i) => {
          const passClass = (val: string) => {
            if (val === 'Yes') return 'badge-fail'; // Red for password protected
            if (val === 'NO') return 'badge-pass';  // Green for not protected
            if (val.toLowerCase().includes('not found')) return 'badge-fail'; // Red for Not Found
            if (val.includes('Failed Or Empty Response') || val.includes('Too many requests')) return 'badge-fail';
            return val === 'Passed' || val.startsWith('Passed') || val.includes('200')
              ? 'badge-pass'
              : 'badge-fail';
          };

          const desktopSpeedClass = r.desktopPageSpeed >= 80 ? 'badge-pass' : 'badge-fail';
          const mobileSpeedClass = r.mobilePageSpeed >= 70 ? 'badge-pass' : 'badge-fail';

          return `
          <tr class="main-row" id="row-${i}">
            <td data-label="Sr. No." style="text-align: center; font-weight: 600;">
              ${i + 1}
            </td>
            <td data-label="Page URL">
              <a href="${escapeHtml(r.pageUrl)}" target="_blank" class="url-link" title="${escapeHtml(r.pageUrl)}">
                ${escapeHtml(r.pageUrl)}
              </a>
            </td>
            <td data-label="HTTP Status">
              <span class="badge ${passClass(r.httpStatus)}">${escapeHtml(r.httpStatus)}</span>
            </td>
            <td data-label="Password Protected">
              <span class="badge ${passClass(r.passwordProtection)}">${escapeHtml(r.passwordProtection)}</span>
            </td>
            <td data-label="GTM-M7T2KZD">
              <span class="badge ${passClass(r.gtmTag)}">${escapeHtml(r.gtmTag)}</span>
            </td>
            <td data-label="Beacon Code">
              <span class="badge ${passClass(r.beaconCode)}">${escapeHtml(r.beaconCode)}</span>
            </td>
            <td data-label="Clarity Code">
              <span class="badge ${passClass(r.clarityCode)}">${escapeHtml(r.clarityCode)}</span>
            </td>
            <td data-label="Monotype">
              <span class="badge ${passClass(r.monotype)}">${escapeHtml(r.monotype)}</span>
            </td>
            <td data-label="GCLID">
              <span class="badge ${passClass(r.gclid)}">${escapeHtml(r.gclid)}</span>
            </td>
            <td data-label="IP Address">
              <span class="badge ${passClass(r.ipAddress)}">${escapeHtml(r.ipAddress)}</span>
            </td>
            <td data-label="Form Submission">
              <span class="badge ${passClass(r.formSubmission)}">${escapeHtml(r.formSubmission)}</span>
            </td>
            <td data-label="Payload" title="${escapeHtml(r.payload)}">
              ${renderCellContent(r.payload, 30)}
            </td>
            <td data-label="API Response" title="${escapeHtml(r.apiResponse)}">
              ${renderApiResponseContent(r.apiResponse, 35)}
            </td>
            <td data-label="SEO Meta Title" title="${escapeHtml(r.seoMetaTitle)}">
              ${renderCellContent(r.seoMetaTitle, 35)}
            </td>
            <td data-label="Meta Description" title="${escapeHtml(r.metaDescription)}">
              ${renderCellContent(r.metaDescription, 40)}
            </td>
            <td data-label="Canonical URL" title="${escapeHtml(r.canonicalUrl)}">
              ${renderCellContent(r.canonicalUrl, 35)}
            </td>
            <td data-label="Index Follow">
              <span class="badge ${passClass(r.indexFollow)}">${escapeHtml(r.indexFollow)}</span>
            </td>
            <td data-label="Other GTM Tags">
              ${renderCellContent(r.otherGtmTags)}
            </td>
            <td data-label="Desktop Page Speed">
              <span class="badge ${desktopSpeedClass}">${r.desktopPageSpeed}</span>
            </td>
            <td data-label="Mobile Page Speed">
              <span class="badge ${mobileSpeedClass}">${r.mobilePageSpeed}</span>
            </td>
            <td data-label="Inspect">
              <button class="toggle-details-btn" onclick="toggleDetails(${i})">Details</button>
            </td>
          </tr>

          <!-- Deep Inspection Drawer -->
          <tr class="details-row" id="details-${i}">
            <td colspan="21" style="padding: 0;">
              <div class="details-container">
                <!-- SERP Preview Card -->
                <div class="details-card">
                  <h4>Google SERP Snippet Preview</h4>
                  <div class="serp-box">
                    <div class="serp-url">${r.canonicalUrl.toLowerCase().includes('not found') ? '<span class="text-not-found">Not Found</span>' : escapeHtml(r.canonicalUrl || r.pageUrl)}</div>
                    <div class="serp-title">${r.seoMetaTitle.toLowerCase().includes('not found') ? '<span class="text-not-found">Not Found</span>' : escapeHtml(r.seoMetaTitle)}</div>
                    <div class="serp-desc">${r.metaDescription.toLowerCase().includes('not found') ? '<span class="text-not-found">Not Found</span>' : escapeHtml(r.metaDescription)}</div>
                  </div>
                </div>

                <!-- Cache-Busting & Navigation Metrics -->
                <div class="details-card">
                  <h4>Navigation & Cache-Busting (Case 2)</h4>
                  <ul class="details-list">
                    <li><span class="lbl">Busted URL Hit:</span> <span class="val" style="font-size:0.75rem;">${escapeHtml(r.bustedUrl)}</span></li>
                    <li><span class="lbl">Busted URL Loaded:</span> <span class="val"><span class="badge ${r.bustedUrlLoaded ? 'badge-pass' : 'badge-fail'}">${r.bustedUrlLoaded ? 'Passed' : 'Failed'}</span></span></li>
                    <li><span class="lbl">Load Time:</span> <span class="val">${r.loadTimeMs} ms</span></li>
                    <li><span class="lbl">HTTP Code:</span> <span class="val">${r.httpStatusCode}</span></li>
                  </ul>
                </div>

                <!-- Tracking & Telemetry Details -->
                <div class="details-card">
                  <h4>Telemetry & Tag Audit (Cases 6, 7 & 8)</h4>
                  <ul class="details-list">
                    <li><span class="lbl">Target GTM (GTM-M7T2KZD):</span> <span class="val"><span class="badge ${passClass(r.gtmTag)}">${escapeHtml(r.gtmTag)}</span></span></li>
                    <li><span class="lbl">Other GTM Tags Found:</span> <span class="val">${escapeHtml(r.otherGtmTags)}</span></li>
                    <li><span class="lbl">Microsoft Clarity Code:</span> <span class="val"><span class="badge ${passClass(r.clarityCode)}">${escapeHtml(r.clarityCode)}</span></span></li>
                    <li><span class="lbl">Salesforce Beacon Code:</span> <span class="val"><span class="badge ${passClass(r.beaconCode)}">${escapeHtml(r.beaconCode)}</span></span></li>
                  </ul>
                  ${r.gtmInspectionDetails || r.clarityInspectionDetails || r.beaconInspectionDetails ? `
                    <div style="margin-top:10px; padding:8px; background:#F1F5F9; border-radius:6px; font-size:0.75rem; color:var(--text-muted);">
                      ${r.gtmInspectionDetails ? `<div><strong>Case 6 Network/DOM Check:</strong> ${escapeHtml(r.gtmInspectionDetails)}</div>` : ''}
                      ${r.clarityInspectionDetails ? `<div style="margin-top:4px;"><strong>Case 7 Network 'clarity' Check:</strong> ${escapeHtml(r.clarityInspectionDetails)}</div>` : ''}
                      ${r.beaconInspectionDetails ? `<div style="margin-top:4px;"><strong>Case 8 Network 'beacon' Check:</strong> ${escapeHtml(r.beaconInspectionDetails)}</div>` : ''}
                    </div>
                  ` : ''}
                </div>

                <!-- Monotype Font Typography Audit -->
                <div class="details-card">
                  <h4>Monotype Typography Audit (Case 13)</h4>
                  <ul class="details-list">
                    <li><span class="lbl">Monotype Status:</span> <span class="val"><span class="badge ${passClass(r.monotype)}">${escapeHtml(r.monotype)}</span></span></li>
                    <li><span class="lbl">Valid Fonts Required:</span> <span class="val">Gisans, GI Sans, GI Sans Text, GI Sans Display</span></li>
                  </ul>
                  ${r.monotypeDetails ? `
                    <div style="margin-top:10px; padding:8px; background:#F1F5F9; border-radius:6px; font-size:0.75rem; color:var(--text-muted);">
                      <div><strong>Typography Inspection:</strong> ${escapeHtml(r.monotypeDetails)}</div>
                    </div>
                  ` : ''}
                </div>

                <!-- Forms & CTAs Captured -->
                <div class="details-card">
                  <h4>Forms & CTAs (${r.formsFound.length})</h4>
                  ${r.formsFound.length === 0 ? '<p style="font-size:0.8rem; color:var(--text-muted);">No form elements discovered on this page.</p>' : `
                    <div style="display:flex; flex-direction:column; gap:8px;">
                      ${r.formsFound.map(f => `
                        <div style="background:#F1F5F9; padding:8px; border-radius:6px; font-size:0.75rem;">
                          <div><strong>ID:</strong> ${escapeHtml(f.formId)} | <strong>Action:</strong> ${escapeHtml(f.formAction)}</div>
                          <div><strong>Fields:</strong> ${f.fields.map(field => `${field.name} (${field.type})`).join(', ')}</div>
                          <div><strong>Filled with Test Data:</strong> ${f.isFilled ? 'Yes' : 'No'}</div>
                        </div>
                      `).join('')}
                    </div>
                  `}
                </div>

                <!-- Captured APIs & Payloads -->
                <div class="details-card" style="grid-column: 1 / -1;">
                  <h4>Captured Network API Payloads & Responses (${r.apiCallsCaptured.length})</h4>
                  ${r.apiCallsCaptured.length === 0 ? '<p style="font-size:0.8rem; color:var(--text-muted);">No outgoing lead or telemetry POST/API requests intercepted during page load.</p>' : `
                    <div style="display:flex; flex-direction:column; gap:8px;">
                      ${r.apiCallsCaptured.map(api => `
                        <div class="code-block">
[${escapeHtml(api.method)}] ${escapeHtml(api.url)} &rarr; HTTP ${api.status}
Request Payload: ${escapeHtml(typeof api.requestPayload === 'object' ? JSON.stringify(api.requestPayload, null, 2) : String(api.requestPayload || 'None'))}
Response Body: ${escapeHtml(typeof api.responseBody === 'object' ? JSON.stringify(api.responseBody, null, 2) : String(api.responseBody || 'None'))}
                        </div>
                      `).join('')}
                    </div>
                  `}
                </div>
              </div>
            </td>
          </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>
</div>

<script>
  function toggleDetails(index) {
    const row = document.getElementById('details-' + index);
    if (row) {
      row.classList.toggle('active');
    }
  }

  function filterTable() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const filter = document.getElementById('statusFilter').value;
    const rows = document.querySelectorAll('.main-row');

    rows.forEach((row, idx) => {
      const text = row.innerText.toLowerCase();
      const matchesSearch = text.includes(query);
      let matchesFilter = true;

      if (filter === 'PASS') {
        matchesFilter = text.includes('200') && !text.includes('failed');
      } else if (filter === 'FAIL') {
        matchesFilter = text.includes('failed');
      }

      if (matchesSearch && matchesFilter) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
        const details = document.getElementById('details-' + idx);
        if (details) details.classList.remove('active');
      }
    });
  }
</script>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, 'utf-8');
  return outputPath;
}
