import { Page } from 'playwright';
import { NetworkRequestEntry } from '../types';

export interface GtmCheckResult {
  standardGtmPassed: 'Passed' | 'Failed';
  standardGtmFound: boolean;
  otherGtmTags: string;
  allGtmTags: string[];
  inspectionDetails: string;
}

export const TARGET_GTM_TAG = 'GTM-M7T2KZD';

/**
 * Validates whether a GTM tag is a genuine Google Tag Manager Container ID.
 * Standard GTM Container IDs:
 * - Start with GTM-
 * - Followed strictly by 4 to 9 uppercase alphanumeric characters (e.g. GTM-M7T2KZD, GTM-KF67BF96)
 * - Do NOT contain additional hyphens or underscores (like GTM-LANDING-PAGE-LEADS)
 * - Do NOT contain word/template labels (like GTM-WEBTEMPLATE)
 */
export function isGenuineGtmContainerTag(tag: string): boolean {
  if (!tag) return false;
  const clean = tag.trim().toUpperCase();

  // Must match exactly GTM-[4-9 alphanumeric chars] with no further hyphens or symbols
  if (!/^GTM-[A-Z0-9]{4,9}$/.test(clean)) {
    return false;
  }

  // Exclude dictionary/descriptive words that might have no numbers (e.g. WEBTEMPLATE, TEMPLATE, DEFAULT)
  const suffix = clean.replace('GTM-', '');
  const excludedWords = [
    'TEMPLATE',
    'WEBTEMPLATE',
    'DEFAULT',
    'CONTAIN',
    'CONTAINER',
    'LANDING',
    'PREVIEW',
    'STAGING',
    'HEADER',
    'FOOTER'
  ];

  if (excludedWords.some(w => suffix === w || suffix.includes(w))) {
    return false;
  }

  return true;
}

/**
 * Case 6 - Standard Landing page GTM tag ‘GTM-M7T2KZD’ is present or not on Main page & thank you page,
 * also capture all other GTM tags present on page, by inspecting page and searching beacon in Network.
 * Only genuine GTM container IDs (like GTM-KF67BF96, GTM-M7T2KZD) are captured.
 */
export async function checkGtmTags(
  page: Page,
  networkRequests: NetworkRequestEntry[],
  targetTag: string = TARGET_GTM_TAG,
  thankYouPageFound?: boolean
): Promise<GtmCheckResult> {
  // Regex strictly matching GTM container ID format without trailing hyphens or words
  const gtmRegex = /\bGTM-[A-Za-z0-9]{4,9}(?![A-Za-z0-9_-])/g;
  const upperTarget = targetTag.toUpperCase();

  const foundSources: string[] = [];
  const allDiscoveredTags: string[] = [];

  // ----------------------------------------------------
  // 1. INSPECT PAGE (DOM, Scripts, dataLayer, GTM Globals)
  // ----------------------------------------------------
  const domGtms: { tags: string[]; sources: string[] } = await page.evaluate(() => {
    const tags: string[] = [];
    const sources: string[] = [];
    const regex = /\bGTM-[A-Za-z0-9]{4,9}(?![A-Za-z0-9_-])/g;

    // A. Check script tags (src & textContent)
    const scripts = document.querySelectorAll('script, noscript, iframe');
    scripts.forEach((s) => {
      const src = s.getAttribute('src') || '';
      const text = s.textContent || '';
      const combined = `${src} ${text}`;
      const matches = combined.match(regex);
      if (matches) {
        tags.push(...matches);
        sources.push(`DOM <${s.tagName.toLowerCase()}> element: ${src || text.substring(0, 100)}`);
      }
    });

    // B. Check window.dataLayer
    try {
      const dl = (window as any).dataLayer;
      if (Array.isArray(dl)) {
        const str = JSON.stringify(dl);
        const matches = str.match(regex);
        if (matches) {
          tags.push(...matches);
          sources.push('window.dataLayer');
        }
      }
    } catch {}

    // C. Check window.google_tag_manager global object
    try {
      const gtmObj = (window as any).google_tag_manager;
      if (gtmObj && typeof gtmObj === 'object') {
        Object.keys(gtmObj).forEach(k => {
          const upper = k.toUpperCase();
          if (/^GTM-[A-Z0-9]{4,9}$/.test(upper)) {
            tags.push(upper);
            sources.push(`window.google_tag_manager['${k}']`);
          }
        });
      }
    } catch {}

    return { tags, sources };
  });

  allDiscoveredTags.push(...domGtms.tags);
  if (domGtms.tags.map(t => t.toUpperCase()).includes(upperTarget)) {
    foundSources.push('Page DOM (Scripts / dataLayer / GTM global)');
  }

  // Also scan full HTML content
  try {
    const html = await page.content();
    const htmlMatches = html.match(gtmRegex) || [];
    allDiscoveredTags.push(...htmlMatches);
    if (htmlMatches.map(t => t.toUpperCase()).includes(upperTarget) && !foundSources.includes('Page DOM (Scripts / dataLayer / GTM global)')) {
      foundSources.push('Page HTML Source');
    }
  } catch {}

  // ----------------------------------------------------
  // 2. SEARCH BEACON IN NETWORK AND CHECK GTM TAG
  // ----------------------------------------------------
  const beaconRequests = networkRequests.filter(req => {
    const urlLower = req.url.toLowerCase();
    const typeLower = (req.resourceType || '').toLowerCase();
    return (
      urlLower.includes('beacon') ||
      typeLower === 'beacon' ||
      typeLower === 'ping' ||
      urlLower.includes('/g/collect')
    );
  });

  beaconRequests.forEach(beacon => {
    const combined = `${beacon.url} ${beacon.postData || ''}`;
    const matches = combined.match(gtmRegex);
    if (matches) {
      allDiscoveredTags.push(...matches);
      if (matches.map(t => t.toUpperCase()).includes(upperTarget)) {
        foundSources.push(`Network Beacon [${beacon.method} ${beacon.url.substring(0, 80)}]`);
      }
    }
  });

  // Also check all other Network requests (e.g. gtm.js, google-analytics, etc.)
  networkRequests.forEach(req => {
    const combined = `${req.url} ${req.postData || ''}`;
    const matches = combined.match(gtmRegex);
    if (matches) {
      allDiscoveredTags.push(...matches);
      if (matches.map(t => t.toUpperCase()).includes(upperTarget) && !foundSources.some(s => s.includes('Network'))) {
        foundSources.push(`Network Request [${req.method} ${req.url.substring(0, 80)}]`);
      }
    }
  });

  // ----------------------------------------------------
  // 3. CHECK THANK YOU PAGE (if available)
  // ----------------------------------------------------
  if (thankYouPageFound) {
    foundSources.push('Thank You Page Verified');
  }

  // ----------------------------------------------------
  // 4. ASSEMBLE RESULTS: Filter strictly to genuine GTM container IDs
  // ----------------------------------------------------
  const allUniqueGtms = Array.from(
    new Set(allDiscoveredTags.map(t => t.toUpperCase()).filter(isGenuineGtmContainerTag))
  );

  const standardGtmFound = allUniqueGtms.includes(upperTarget);
  const standardGtmPassed: 'Passed' | 'Failed' = standardGtmFound ? 'Passed' : 'Failed';

  // Only genuine other GTM container tags (like GTM-KF67BF96)
  const otherTags = allUniqueGtms.filter(t => t !== upperTarget);
  const otherGtmTags = otherTags.length > 0 ? otherTags.join(', ') : 'None';

  let inspectionDetails = '';
  if (standardGtmFound) {
    inspectionDetails = `Target ${targetTag} found via: ${foundSources.join(' | ')}`;
    if (otherTags.length > 0) {
      inspectionDetails += ` | Other genuine GTM container tags: ${otherTags.join(', ')}`;
    }
  } else {
    inspectionDetails = `Target ${targetTag} not found in page DOM, nor in Network Beacon requests (searched ${beaconRequests.length} beacon calls, ${networkRequests.length} total calls). Discovered genuine tags: ${allUniqueGtms.join(', ') || 'None'}`;
  }

  return {
    standardGtmPassed,
    standardGtmFound,
    otherGtmTags,
    allGtmTags: allUniqueGtms,
    inspectionDetails
  };
}
