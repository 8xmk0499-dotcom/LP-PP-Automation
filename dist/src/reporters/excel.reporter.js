"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXCEL_COLUMNS = void 0;
exports.generateExcelReport = generateExcelReport;
const exceljs_1 = __importDefault(require("exceljs"));
exports.EXCEL_COLUMNS = [
    'Page URL',
    'HTTP Status',
    'Password Protection',
    'SEO Meta Title',
    'Meta Description',
    'Canonical URL',
    'Index Follow',
    'GTM Tag',
    'Other GTM Tags',
    'Beacon Code',
    'Clarity Code',
    'GCLID',
    'IP Address'
];
/**
 * Creates an Excel report containing ONLY the 13 specified columns in a single sheet.
 */
async function generateExcelReport(results, outputPath) {
    const workbook = new exceljs_1.default.Workbook();
    workbook.creator = 'GPL Page Analysis Automation';
    workbook.lastModifiedBy = 'Playwright Automation';
    workbook.created = new Date();
    workbook.modified = new Date();
    // Create exactly ONE sheet
    const worksheet = workbook.addWorksheet('GPL Page Analysis', {
        views: [{ state: 'frozen', ySplit: 1 }]
    });
    // Define columns matching the exact requirement
    worksheet.columns = [
        { header: 'Page URL', key: 'pageUrl', width: 40 },
        { header: 'HTTP Status', key: 'httpStatus', width: 16 },
        { header: 'Password Protection', key: 'passwordProtection', width: 22 },
        { header: 'SEO Meta Title', key: 'seoMetaTitle', width: 35 },
        { header: 'Meta Description', key: 'metaDescription', width: 45 },
        { header: 'Canonical URL', key: 'canonicalUrl', width: 35 },
        { header: 'Index Follow', key: 'indexFollow', width: 28 },
        { header: 'GTM Tag', key: 'gtmTag', width: 16 },
        { header: 'Other GTM Tags', key: 'otherGtmTags', width: 25 },
        { header: 'Beacon Code', key: 'beaconCode', width: 16 },
        { header: 'Clarity Code', key: 'clarityCode', width: 16 },
        { header: 'GCLID', key: 'gclid', width: 14 },
        { header: 'IP Address', key: 'ipAddress', width: 16 }
    ];
    // Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.height = 32;
    headerRow.eachCell((cell) => {
        cell.font = {
            name: 'Calibri',
            size: 11,
            bold: true,
            color: { argb: 'FFFFFFFF' }
        };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0F2F57' } // Godrej Navy
        };
        cell.alignment = {
            vertical: 'middle',
            horizontal: 'center',
            wrapText: true
        };
        cell.border = {
            top: { style: 'medium', color: { argb: 'FF0B223F' } },
            bottom: { style: 'medium', color: { argb: 'FF0B223F' } },
            left: { style: 'thin', color: { argb: 'FF334155' } },
            right: { style: 'thin', color: { argb: 'FF334155' } }
        };
    });
    // Populate data rows
    results.forEach((r, idx) => {
        const row = worksheet.addRow({
            pageUrl: r.pageUrl,
            httpStatus: r.httpStatus,
            passwordProtection: r.passwordProtection,
            seoMetaTitle: r.seoMetaTitle,
            metaDescription: r.metaDescription,
            canonicalUrl: r.canonicalUrl,
            indexFollow: r.indexFollow,
            gtmTag: r.gtmTag,
            otherGtmTags: r.otherGtmTags,
            beaconCode: r.beaconCode,
            clarityCode: r.clarityCode,
            gclid: r.gclid,
            ipAddress: r.ipAddress
        });
        row.height = 24;
        const isEven = idx % 2 === 0;
        row.eachCell((cell, colNumber) => {
            // Base cell font and border
            cell.font = { name: 'Calibri', size: 10 };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
            // Zebra striping for non-status cells
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }
            };
            // Alignment
            if ([1, 4, 5, 6].includes(colNumber)) {
                cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            }
            else {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }
            // Value-based styling for Passed / Failed columns
            const cellVal = String(cell.value || '');
            if (cellVal === 'Passed' || cellVal.startsWith('Passed') || cellVal === '200 (Passed)') {
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF166534' } }; // Dark green
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFDCFCE7' } // Soft green
                };
            }
            else if (cellVal === 'Failed' || cellVal.startsWith('Failed') || cellVal.includes('Failed')) {
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF991B1B' } }; // Dark red
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFEE2E2' } // Soft red
                };
            }
        });
    });
    // Auto-fit column widths with min/max bounds
    worksheet.columns.forEach((column) => {
        let maxLength = 12;
        if (column.eachCell) {
            column.eachCell({ includeEmpty: false }, (cell) => {
                const val = cell.value ? String(cell.value) : '';
                const lineLen = Math.max(...val.split('\n').map(l => l.length));
                if (lineLen > maxLength)
                    maxLength = lineLen;
            });
        }
        column.width = Math.min(Math.max(maxLength + 4, 14), 50);
    });
    await workbook.xlsx.writeFile(outputPath);
    return outputPath;
}
