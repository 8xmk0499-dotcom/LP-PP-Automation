"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cli_prompt_1 = require("./utils/cli-prompt");
const browser_1 = require("./core/browser");
const auditor_1 = require("./core/auditor");
const file_naming_1 = require("./utils/file-naming");
const excel_reporter_1 = require("./reporters/excel.reporter");
const html_reporter_1 = require("./reporters/html.reporter");
async function main() {
    console.clear();
    const { urls, headless, submitForms } = await (0, cli_prompt_1.getTargetUrls)();
    if (urls.length === 0) {
        console.error('No valid URLs provided to audit. Exiting.');
        process.exit(1);
    }
    console.log(`\nStarting Page Analysis for ${urls.length} URL(s)...`);
    console.log(`Browser Mode: ${headless ? 'Headless' : 'Headed (Real Browser)'}`);
    console.log('------------------------------------------------------\n');
    const results = [];
    const browser = await (0, browser_1.createBrowser)({ headless });
    const context = await (0, browser_1.createBrowserContext)(browser, { headless });
    try {
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            console.log(`[${i + 1}/${urls.length}] Auditing: ${url}`);
            try {
                const auditResult = await (0, auditor_1.auditPage)(context, url, {
                    srNo: i + 1,
                    fillForms: true,
                    submitForms: true,
                    timeout: 45000
                });
                results.push(auditResult);
                // Print compact console summary for this page
                console.log(`  ✓ HTTP Status:        ${auditResult.httpStatus}`);
                console.log(`  ✓ Password Protect:   ${auditResult.passwordProtection}`);
                console.log(`  ✓ Busted URL Hit:     ${auditResult.bustedUrl}`);
                console.log(`  ✓ Meta Title:         ${auditResult.seoMetaTitle.substring(0, 45)}...`);
                console.log(`  ✓ Index Follow:       ${auditResult.indexFollow}`);
                console.log(`  ✓ GTM-M7T2KZD:        ${auditResult.gtmTag}`);
                console.log(`  ✓ Other GTM Tags:     ${auditResult.otherGtmTags}`);
                console.log(`  ✓ Beacon Code:        ${auditResult.beaconCode}`);
                console.log(`  ✓ Clarity Code:       ${auditResult.clarityCode}`);
                console.log(`  ✓ GCLID:              ${auditResult.gclid}`);
                console.log(`  ✓ IP Address:         ${auditResult.ipAddress}`);
                console.log(`  ✓ Form Submission:    ${auditResult.formSubmission}`);
                console.log(`  ✓ Payload:            ${auditResult.payload.substring(0, 45)}...`);
                console.log(`  ✓ API Response:       ${auditResult.apiResponse}`);
                console.log(`  ✓ Monotype (GI Sans): ${auditResult.monotype}`);
                console.log(`  ✓ Desktop Page Speed: ${auditResult.desktopPageSpeed} | Mobile: ${auditResult.mobilePageSpeed}`);
                console.log(`  ✓ Forms Detected:     ${auditResult.formsFound.length} | API Calls: ${auditResult.apiCallsCaptured.length}`);
                console.log('');
            }
            catch (err) {
                console.error(`  ✗ Error auditing ${url}:`, err.message);
                // Record error row
                results.push({
                    srNo: i + 1,
                    pageUrl: url,
                    httpStatus: '0 (Failed)',
                    httpStatusCode: 0,
                    passwordProtection: 'Yes',
                    seoMetaTitle: 'Audit Error',
                    metaDescription: err.message || '',
                    canonicalUrl: url,
                    indexFollow: 'Failed (Error)',
                    gtmTag: 'Failed',
                    otherGtmTags: 'None',
                    beaconCode: 'Failed',
                    clarityCode: 'Failed',
                    formSubmission: 'Failed',
                    payload: 'Not Found',
                    apiResponse: 'Failed Or Empty Response',
                    monotype: 'Failed',
                    desktopPageSpeed: 0,
                    mobilePageSpeed: 0,
                    gclid: 'Failed',
                    ipAddress: 'Failed',
                    bustedUrl: url,
                    bustedUrlLoaded: false,
                    allGtmTagsList: [],
                    formsFound: [],
                    apiCallsCaptured: [],
                    consoleErrors: [err.message],
                    loadTimeMs: 0,
                    testedAt: new Date().toISOString()
                });
            }
        }
    }
    finally {
        await context.close();
        await browser.close();
    }
    // Generate Reports
    console.log('Generating Reports...');
    const reportPaths = (0, file_naming_1.getNextReportPaths)();
    const finalExcelPath = await (0, excel_reporter_1.generateExcelReport)(results, reportPaths.excelPath);
    console.log(`✓ Excel Report generated: ${finalExcelPath}`);
    await (0, html_reporter_1.generateHtmlReport)(results, reportPaths.htmlPath, reportPaths.reportNumber);
    console.log(`✓ HTML Report generated:  ${reportPaths.htmlPath}`);
    console.log('\n======================================================');
    console.log('                 AUDIT COMPLETED                      ');
    console.log('======================================================');
    console.log(`Total Pages Audited: ${results.length}`);
    console.log(`Excel Report:  file://${finalExcelPath.replace(/\\/g, '/')}`);
    console.log(`HTML Report:   file://${reportPaths.htmlPath.replace(/\\/g, '/')}`);
    console.log('======================================================\n');
}
main().catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
});
