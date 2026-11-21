"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTargetUrls = getTargetUrls;
exports.readUrlsFromFile = readUrlsFromFile;
const promises_1 = __importDefault(require("readline/promises"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const url_utils_1 = require("./url-utils");
/**
 * Reads URLs from CLI arguments, interactive prompt, or urls.txt file.
 */
async function getTargetUrls() {
    const args = process.argv.slice(2);
    let urls = [];
    let headless = process.env.HEADLESS === 'true';
    let submitForms = false;
    // 1. Parse command line flags
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--headless') {
            headless = true;
        }
        else if (arg === '--headed') {
            headless = false;
        }
        else if (arg === '--submit') {
            submitForms = true;
        }
        else if (arg.startsWith('--urls=')) {
            const raw = arg.replace('--urls=', '');
            urls.push(...raw.split(',').map((u) => u.trim()).filter(Boolean));
        }
        else if (arg === '--urls' && i + 1 < args.length) {
            urls.push(...args[i + 1].split(',').map((u) => u.trim()).filter(Boolean));
            i++;
        }
        else if (arg.startsWith('--file=')) {
            const filePath = arg.replace('--file=', '').trim();
            urls.push(...readUrlsFromFile(filePath));
        }
        else if (arg.startsWith('http://') || arg.startsWith('https://')) {
            urls.push(arg.trim());
        }
    }
    // 2. If URLs were found in arguments, return them
    if (urls.length > 0) {
        return {
            urls: urls.map(url_utils_1.normalizeUrl),
            headless,
            submitForms
        };
    }
    // 3. Check if standard urls.txt exists and has content
    const defaultFilePath = path_1.default.join(process.cwd(), 'urls.txt');
    const fileUrls = readUrlsFromFile(defaultFilePath);
    // 4. Interactive prompt for the user at runtime
    const rl = promises_1.default.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    console.log('\n======================================================');
    console.log('   GODREJ PROPERTIES (GPL) PAGE ANALYSIS RUNNER       ');
    console.log('======================================================\n');
    if (fileUrls.length > 0) {
        console.log(`Found ${fileUrls.length} URL(s) in urls.txt:`);
        fileUrls.forEach((u, i) => console.log(`  [${i + 1}] ${u}`));
        console.log('');
    }
    const promptMsg = fileUrls.length > 0
        ? 'Enter URL(s) to test (separated by comma), or press Enter to run all URLs from urls.txt:\n> '
        : 'Enter URL(s) to test (separated by comma or space):\n> ';
    const answer = await rl.question(promptMsg);
    rl.close();
    const enteredUrls = answer
        .split(/[\s,]+/)
        .map((u) => u.trim())
        .filter((u) => u.length > 0 && (u.startsWith('http') || u.includes('.')));
    if (enteredUrls.length > 0) {
        urls = enteredUrls;
    }
    else if (fileUrls.length > 0) {
        urls = fileUrls;
    }
    else {
        // Fallback sample URLs if nothing provided
        urls = [
            'https://www.godrejproperties.com/',
            'https://www.godrejproperties.com/mumbai'
        ];
        console.log('\nNo URL provided. Using default GPL testing URLs:\n' + urls.join('\n'));
    }
    return {
        urls: urls.map(url_utils_1.normalizeUrl),
        headless,
        submitForms
    };
}
/**
 * Reads lines from file, ignoring blank lines and comments (#).
 */
function readUrlsFromFile(filePath) {
    if (!fs_1.default.existsSync(filePath))
        return [];
    try {
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        return content
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && !line.startsWith('#'));
    }
    catch {
        return [];
    }
}
