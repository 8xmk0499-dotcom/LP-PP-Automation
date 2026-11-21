import fs from 'fs';
import path from 'path';

export interface ReportPaths {
  reportNumber: number;
  htmlDir: string;
  excelDir: string;
  htmlPath: string;
  excelPath: string;
  htmlFilename: string;
  excelFilename: string;
}

/**
 * Determines the next sequential report paths ensuring no overwrites.
 * Folders: 'Html Report' and 'Excel Report'
 * Names: 'analysis_report-<number>.html' and 'analysis_report-<number>.xlsx'
 */
export function getNextReportPaths(baseDir: string = process.cwd()): ReportPaths {
  const htmlDir = path.join(baseDir, 'Html Report');
  const excelDir = path.join(baseDir, 'Excel Report');

  if (!fs.existsSync(htmlDir)) {
    fs.mkdirSync(htmlDir, { recursive: true });
  }
  if (!fs.existsSync(excelDir)) {
    fs.mkdirSync(excelDir, { recursive: true });
  }

  let index = 1;
  while (true) {
    const htmlName = `analysis_report-${index}.html`;
    const excelName = `analysis_report-${index}.xlsx`;
    const htmlCandidate = path.join(htmlDir, htmlName);
    const excelCandidate = path.join(excelDir, excelName);

    if (!fs.existsSync(htmlCandidate) && !fs.existsSync(excelCandidate)) {
      return {
        reportNumber: index,
        htmlDir,
        excelDir,
        htmlPath: htmlCandidate,
        excelPath: excelCandidate,
        htmlFilename: htmlName,
        excelFilename: excelName
      };
    }
    index++;
  }
}
