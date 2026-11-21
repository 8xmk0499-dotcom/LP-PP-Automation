"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBustedToken = generateBustedToken;
exports.generateBustedUrl = generateBustedUrl;
exports.normalizeUrl = normalizeUrl;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Generates a unique alphanumeric busted token.
 * E.g., '32refef' or 8-character unique alphanumeric string.
 */
function generateBustedToken() {
    return crypto_1.default.randomBytes(4).toString('hex');
}
/**
 * Appends ?busted=<token> or &busted=<token> to the URL,
 * ensuring unique text after '=' every time.
 */
function generateBustedUrl(url, token = generateBustedToken()) {
    try {
        const parsed = new URL(url.trim());
        parsed.searchParams.set('busted', token);
        return parsed.toString();
    }
    catch {
        const separator = url.includes('?') ? '&' : '?';
        return `${url.trim()}${separator}busted=${token}`;
    }
}
/**
 * Validates and normalizes URL string.
 */
function normalizeUrl(url) {
    let trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        trimmed = `https://${trimmed}`;
    }
    return trimmed;
}
