"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNextReportPaths = getNextReportPaths;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Determines the next sequential report paths ensuring no overwrites.
 * Folders: 'Html Report' and 'Excel Report'
 * Names: 'analysis_report-<number>.html' and 'analysis_report-<number>.xlsx'
 */
function getNextReportPaths(baseDir = process.cwd()) {
    const htmlDir = path_1.default.join(baseDir, 'Html Report');
    const excelDir = path_1.default.join(baseDir, 'Excel Report');
    if (!fs_1.default.existsSync(htmlDir)) {
        fs_1.default.mkdirSync(htmlDir, { recursive: true });
    }
    if (!fs_1.default.existsSync(excelDir)) {
        fs_1.default.mkdirSync(excelDir, { recursive: true });
    }
    let index = 1;
    while (true) {
        const htmlName = `analysis_report-${index}.html`;
        const excelName = `analysis_report-${index}.xlsx`;
        const htmlCandidate = path_1.default.join(htmlDir, htmlName);
        const excelCandidate = path_1.default.join(excelDir, excelName);
        if (!fs_1.default.existsSync(htmlCandidate) && !fs_1.default.existsSync(excelCandidate)) {
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
