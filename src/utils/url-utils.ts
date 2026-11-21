import crypto from 'crypto';

/**
 * Generates a unique alphanumeric busted token.
 * E.g., '32refef' or 8-character unique alphanumeric string.
 */
export function generateBustedToken(): string {
  return crypto.randomBytes(4).toString('hex');
}

/**
 * Appends ?busted=<token> or &busted=<token> to the URL,
 * ensuring unique text after '=' every time.
 */
export function generateBustedUrl(url: string, token: string = generateBustedToken()): string {
  try {
    const parsed = new URL(url.trim());
    parsed.searchParams.set('busted', token);
    return parsed.toString();
  } catch {
    const separator = url.includes('?') ? '&' : '?';
    return `${url.trim()}${separator}busted=${token}`;
  }
}

/**
 * Validates and normalizes URL string.
 */
export function normalizeUrl(url: string): string {
  let trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}
