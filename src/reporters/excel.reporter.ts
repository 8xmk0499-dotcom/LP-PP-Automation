import path from 'path';
import ExcelJS from 'exceljs';
import { PageAuditResult } from '../types';

export const EXCEL_COLUMNS = [
  'Sr. No.',
  'Page URL',
  'HTTP Status',
  'Password Protected',
  'GTM-M7T2KZD',
  'Beacon Code',
  'Clarity Code',
  'Monotype',
  'GCLID',
  'IP Address',
  'Form Submission',
  'Payload',
  'API Response',
  'SEO Meta Title',
  'Meta Description',
  'Canonical URL',
  'Index Follow',
  'Other GTM Tags',
  'Desktop Page Speed',
  'Mobile Page Speed'
] as const;

/**
 * Creates an Excel report containing all 20 specified columns in a single sheet,
 * ordered exactly according to requirements (Monotype right after Clarity Code).
 */
export async function generateExcelReport(
  results: PageAuditResult[],
  outputPath: string
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GPL Page Analysis Automation';
  workbook.lastModifiedBy = 'Playwright Automation';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Create exactly ONE sheet
  const worksheet = workbook.addWorksheet('GPL Page Analysis', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  // Define columns matching the exact requested order (20 columns: Monotype after Clarity Code)
  worksheet.columns = [
    { header: 'Sr. No.', key: 'srNo', width: 10 },
    { header: 'Page URL', key: 'pageUrl', width: 38 },
    { header: 'HTTP Status', key: 'httpStatus', width: 16 },
    { header: 'Password Protected', key: 'passwordProtection', width: 22 },
    { header: 'GTM-M7T2KZD', key: 'gtmTag', width: 18 },
    { header: 'Beacon Code', key: 'beaconCode', width: 16 },
    { header: 'Clarity Code', key: 'clarityCode', width: 16 },
    { header: 'Monotype', key: 'monotype', width: 16 },
    { header: 'GCLID', key: 'gclid', width: 16 },
    { header: 'IP Address', key: 'ipAddress', width: 16 },
    { header: 'Form Submission', key: 'formSubmission', width: 18 },
    { header: 'Payload', key: 'payload', width: 36 },
    { header: 'API Response', key: 'apiResponse', width: 36 },
    { header: 'SEO Meta Title', key: 'seoMetaTitle', width: 35 },
    { header: 'Meta Description', key: 'metaDescription', width: 45 },
    { header: 'Canonical URL', key: 'canonicalUrl', width: 35 },
    { header: 'Index Follow', key: 'indexFollow', width: 26 },
    { header: 'Other GTM Tags', key: 'otherGtmTags', width: 24 },
    { header: 'Desktop Page Speed', key: 'desktopPageSpeed', width: 22 },
    { header: 'Mobile Page Speed', key: 'mobilePageSpeed', width: 22 }
  ];

  // Style Header Row
  const headerRow = worksheet.getRow(1);
  headerRow.height = 34;
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
      srNo: idx + 1,
      pageUrl: r.pageUrl,
      httpStatus: r.httpStatus,
      passwordProtection: r.passwordProtection,
      gtmTag: r.gtmTag,
      beaconCode: r.beaconCode,
      clarityCode: r.clarityCode,
      monotype: r.monotype,
      gclid: r.gclid,
      ipAddress: r.ipAddress,
      formSubmission: r.formSubmission,
      payload: r.payload,
      apiResponse: r.apiResponse,
      seoMetaTitle: r.seoMetaTitle,
      metaDescription: r.metaDescription,
      canonicalUrl: r.canonicalUrl,
      indexFollow: r.indexFollow,
      otherGtmTags: r.otherGtmTags,
      desktopPageSpeed: r.desktopPageSpeed,
      mobilePageSpeed: r.mobilePageSpeed
    });

    row.height = 26;
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

      // Alignment: URLs (2), Payload (12), API Response (13), Titles (14), Descriptions (15), Canonicals (16), Other GTM Tags (18) to left; status/numbers to center
      if ([2, 12, 13, 14, 15, 16, 18].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }

      const cellVal = String(cell.value ?? '');
      const numVal = typeof cell.value === 'number' ? cell.value : parseFloat(cellVal);

      // 1. Password Protected: Yes (Red), NO (Green)
      if (cellVal === 'Yes') {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      } else if (cellVal === 'NO') {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF16A34A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      }
      // 2. Not Found, Failed Or Empty Response, or Rate limit Error in red colour
      else if (
        cellVal.toLowerCase().includes('not found') ||
        cellVal.includes('Too many requests') ||
        cellVal === 'Failed Or Empty Response'
      ) {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      }
      // 3. Desktop Page Speed (Col 19): Above 80 (>= 80) -> Green, else Red
      else if (colNumber === 19 && !isNaN(numVal)) {
        if (numVal >= 80) {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF16A34A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        } else {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        }
      }
      // 4. Mobile Page Speed (Col 20): Above 70 (>= 70) -> Green, else Red
      else if (colNumber === 20 && !isNaN(numVal)) {
        if (numVal >= 70) {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF16A34A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        } else {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        }
      }
      // 5. General Passed status: Green
      else if (cellVal === 'Passed' || cellVal.startsWith('Passed') || cellVal === '200 (Passed)') {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF166534' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      }
      // 6. General Failed status: Red
      else if (cellVal === 'Failed' || cellVal.startsWith('Failed') || cellVal.includes('Failed')) {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF991B1B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      }
    });
  });

  // Auto-fit column widths with min/max bounds
  worksheet.columns.forEach((column) => {
    let maxLength = 10;
    if (column.eachCell) {
      column.eachCell({ includeEmpty: false }, (cell) => {
        const val = cell.value ? String(cell.value) : '';
        const lineLen = Math.max(...val.split('\n').map(l => l.length));
        if (lineLen > maxLength) maxLength = lineLen;
      });
    }
    column.width = Math.min(Math.max(maxLength + 3, 12), 45);
  });

  try {
    await workbook.xlsx.writeFile(outputPath);
    return outputPath;
  } catch (err: any) {
    if (err.code === 'EBUSY') {
      const dir = path.dirname(outputPath);
      const ext = path.extname(outputPath);
      const base = path.basename(outputPath, ext);
      let candidate = '';
      for (let attempt = 1; attempt <= 20; attempt++) {
        candidate = path.join(dir, `${base}_${attempt}${ext}`);
        try {
          await workbook.xlsx.writeFile(candidate);
          console.warn(`   ⚠️ Warning: "${outputPath}" is open/locked in another program. Saved to "${candidate}" instead.`);
          return candidate;
        } catch (innerErr: any) {
          if (innerErr.code !== 'EBUSY') throw innerErr;
        }
      }
    }
    throw err;
  }
}
