import { Page, Response } from 'playwright';
import { generateBustedToken, generateBustedUrl } from '../utils/url-utils';

export interface BustedUrlCheckResult {
  bustedUrl: string;
  tokenUsed: string;
  loadedSuccessfully: boolean;
  finalUrl: string;
  responseStatus: number;
}

/**
 * Case 2 – Check page should open with busted url or not,
 * use ?busted=32refef in the end of the page link and change the text
 * after “=” sign to generate unique busted url every time when hit.
 */
export async function checkBustedUrl(
  page: Page,
  originalUrl: string,
  timeoutMs: number = 30000
): Promise<{ result: BustedUrlCheckResult; response: Response | null }> {
  const token = generateBustedToken();
  const bustedUrl = generateBustedUrl(originalUrl, token);

  let response: Response | null = null;
  let loaded = false;

  try {
    response = await page.goto(bustedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs
    });
    
    // Allow brief settle for client scripts
    await page.waitForTimeout(2000);
    loaded = response !== null && response.status() < 400;
  } catch (error) {
    loaded = false;
  }

  const finalUrl = page.url();
  const responseStatus = response ? response.status() : 0;

  return {
    result: {
      bustedUrl,
      tokenUsed: token,
      loadedSuccessfully: loaded,
      finalUrl,
      responseStatus
    },
    response
  };
}
