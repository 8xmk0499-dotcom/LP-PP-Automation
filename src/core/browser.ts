import { chromium, Browser, BrowserContext } from 'playwright';

export interface BrowserOptions {
  headless?: boolean;
}

export async function createBrowser(options: BrowserOptions = {}): Promise<Browser> {
  // GPL's WAF / Akamai blocks standard headless mode, so headed is default.
  // Can be overridden by passing headless: true or setting HEADLESS=true.
  const headless = options.headless !== undefined
    ? options.headless
    : (process.env.HEADLESS === 'true');

  const browser = await chromium.launch({
    headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--start-maximized',
      '--window-position=0,0'
    ]
  });

  return browser;
}

export async function createBrowserContext(
  browser: Browser,
  options: BrowserOptions = {}
): Promise<BrowserContext> {
  const headless = options.headless !== undefined
    ? options.headless
    : (process.env.HEADLESS === 'true');

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    // In headed mode, viewport: null allows the browser window to open truly maximized in full screen
    viewport: headless ? { width: 1920, height: 1080 } : null,
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata',
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Ch-Ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Upgrade-Insecure-Requests': '1'
    }
  });

  return context;
}
