import { Page } from 'playwright';

export interface MonotypeCheckResult {
  status: 'Passed' | 'Failed';
  fontsDetected: string[];
  matchedFont?: string;
  invalidFontsDetected?: string[];
  details: string;
}

/**
 * Case 13 – Check Font family on the page:
 * Valid Fonts: Gisans, GI Sans, GI Sans Text, GI Sans Display
 * Rule: If other than following fonts visible on page (including right panel, root, headers, buttons, body)
 * then Marked Failed in Monotype column.
 * Only if valid fonts are present and NO unauthorized fonts are visible on page/right panel, mark Passed.
 */
export async function checkMonotypeFont(page: Page): Promise<MonotypeCheckResult> {
  try {
    const fontAudit = await page.evaluate(() => {
      // Define __name polyfill in page context
      try {
        if (typeof (window as any).__name === 'undefined') {
          (window as any).__name = function(t: any) { return t; };
        }
      } catch {}

      const validTargetNames = [
        'gi sans',
        'gisans',
        'gi-sans',
        'gi sans display',
        'gisansdisplay',
        'gi sans text',
        'gisanstext'
      ];

      function isFontValid(fontName: string): boolean {
        if (!fontName) return false;
        const lower = fontName.toLowerCase();
        for (let i = 0; i < validTargetNames.length; i++) {
          const t = validTargetNames[i];
          if (
            lower === t ||
            lower.indexOf('gi sans') === 0 ||
            lower.indexOf('gisans') === 0 ||
            lower.indexOf('gi-sans') === 0
          ) {
            return true;
          }
        }
        return false;
      }

      const validFonts = new Set<string>();
      const invalidFontsMap = new Map<string, { tag: string; sample: string }>();
      const allFontsDetected = new Set<string>();

      // 1. Check Root document element (<html>) & right panel gutter background
      const htmlStyle = window.getComputedStyle(document.documentElement);
      const htmlRawFont = htmlStyle.fontFamily || '';
      const htmlPrimaryFont = htmlRawFont.split(',')[0].replace(/['"]/g, '').trim();
      if (htmlPrimaryFont) {
        allFontsDetected.add(htmlPrimaryFont);
        if (isFontValid(htmlPrimaryFont)) {
          validFonts.add(htmlPrimaryFont);
        } else {
          invalidFontsMap.set(htmlPrimaryFont, {
            tag: 'html (Right panel / root)',
            sample: 'Right panel gutter & root typography'
          });
        }
      }

      // 2. Check Document Body (<body>)
      if (document.body) {
        const bodyStyle = window.getComputedStyle(document.body);
        const bodyRawFont = bodyStyle.fontFamily || '';
        const bodyPrimaryFont = bodyRawFont.split(',')[0].replace(/['"]/g, '').trim();
        if (bodyPrimaryFont) {
          allFontsDetected.add(bodyPrimaryFont);
          if (isFontValid(bodyPrimaryFont)) {
            validFonts.add(bodyPrimaryFont);
          } else if (!invalidFontsMap.has(bodyPrimaryFont)) {
            invalidFontsMap.set(bodyPrimaryFont, {
              tag: 'body',
              sample: 'Global body typography'
            });
          }
        }
      }

      // 3. Check right edge panels, floating CTAs, and side tabs (e.g. stickyEnquireButton, right drawer)
      const vpWidth = window.innerWidth;
      const allElements = Array.from(document.querySelectorAll('*')) as HTMLElement[];

      for (const el of allElements) {
        if (!el || typeof el.getBoundingClientRect !== 'function') continue;
        const rect = el.getBoundingClientRect();
        if (rect.right >= vpWidth - 60 && rect.width > 0 && rect.height > 0) {
          const style = window.getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            const raw = style.fontFamily || '';
            const primary = raw.split(',')[0].replace(/['"]/g, '').trim();
            if (primary) {
              allFontsDetected.add(primary);
              const lower = primary.toLowerCase();
              const isIcon = lower.includes('icon') || lower.includes('awesome') || lower.includes('glyph');
              if (!isIcon) {
                if (isFontValid(primary)) {
                  validFonts.add(primary);
                } else if (!invalidFontsMap.has(primary)) {
                  const tagDesc = el.id ? `${el.tagName.toLowerCase()}#${el.id}` : el.tagName.toLowerCase();
                  invalidFontsMap.set(primary, {
                    tag: `${tagDesc} (Right panel)`,
                    sample: (el.textContent || '').trim().substring(0, 35) || 'Right side panel'
                  });
                }
              }
            }
          }
        }
      }

      // 4. Check all visible text-bearing content elements across the page
      for (const el of allElements) {
        if (!el || typeof el.getBoundingClientRect !== 'function') continue;
        const isInteractiveInput = ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'OPTION'].includes(el.tagName);
        const inputVal = (el as HTMLInputElement).value || (el as HTMLInputElement).placeholder || '';
        const text = ((el.textContent || '') + ' ' + inputVal).trim();
        if (!text || text.length < 1) continue;

        // Verify visibility
        const style = window.getComputedStyle(el);
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          parseFloat(style.opacity || '1') <= 0.05
        ) {
          continue;
        }

        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 && rect.height <= 0) continue;

        // Focus on elements that directly host text to prevent parent containers duplicating child warnings
        const hasDirectText = Array.from(el.childNodes).some(
          n => n.nodeType === Node.TEXT_NODE && (n.textContent || '').trim().length > 0
        );
        if (!hasDirectText && !isInteractiveInput && el.children.length > 0) continue;

        const rawFont = style.fontFamily || '';
        if (!rawFont) continue;

        const primaryFont = rawFont.split(',')[0].replace(/['"]/g, '').trim();
        if (!primaryFont) continue;

        allFontsDetected.add(primaryFont);
        const primaryLower = primaryFont.toLowerCase();

        // Skip icon fonts
        const isIconFont =
          primaryLower.includes('icon') ||
          primaryLower.includes('awesome') ||
          primaryLower.includes('glyph') ||
          primaryLower.includes('feather');
        if (isIconFont) continue;

        if (isFontValid(primaryFont)) {
          validFonts.add(primaryFont);
        } else {
          if (!invalidFontsMap.has(primaryFont)) {
            invalidFontsMap.set(primaryFont, {
              tag: el.tagName.toLowerCase(),
              sample: text.length > 35 ? text.substring(0, 35) + '...' : text
            });
          }
        }
      }

      return {
        validFonts: Array.from(validFonts),
        invalidFonts: Array.from(invalidFontsMap.entries()).map(([font, data]) => ({
          font,
          tag: data.tag,
          sample: data.sample
        })),
        allFontsDetected: Array.from(allFontsDetected)
      };
    });

    // Prioritize Times New Roman and prominent fonts first in details summary
    const sortedInvalidFonts = [...fontAudit.invalidFonts].sort((a, b) => {
      const aTimes = a.font.toLowerCase().includes('times') || a.font.toLowerCase().includes('roman') ? -1 : 1;
      const bTimes = b.font.toLowerCase().includes('times') || b.font.toLowerCase().includes('roman') ? -1 : 1;
      return aTimes - bTimes;
    });

    const invalidFontNames = sortedInvalidFonts.map(f => f.font);

    // Rule: If other than following fonts visible on page then Marked Failed
    if (invalidFontNames.length > 0) {
      const invalidSummary = sortedInvalidFonts
        .slice(0, 6)
        .map(f => `${f.font} (<${f.tag}>: "${f.sample}")`)
        .join(', ');

      return {
        status: 'Failed',
        fontsDetected: fontAudit.allFontsDetected,
        invalidFontsDetected: invalidFontNames,
        matchedFont: fontAudit.validFonts[0] || undefined,
        details: `Failed: Unauthorized/mixed fonts visible on page/right panel: ${invalidSummary}. Valid fonts strictly required: Gisans, GI Sans, GI Sans Text, GI Sans Display.`
      };
    }

    // If no valid font was detected on visible text
    if (fontAudit.validFonts.length === 0) {
      return {
        status: 'Failed',
        fontsDetected: fontAudit.allFontsDetected,
        invalidFontsDetected: invalidFontNames,
        details: `Failed: Valid Monotype fonts (Gisans, GI Sans, GI Sans Text, GI Sans Display) not detected on visible page elements.`
      };
    }

    // All visible text elements use valid fonts
    return {
      status: 'Passed',
      fontsDetected: fontAudit.allFontsDetected,
      matchedFont: fontAudit.validFonts.join(', '),
      details: `Passed: All visible page typography and panels strictly use valid Monotype fonts (${fontAudit.validFonts.join(', ')}).`
    };
  } catch (err: any) {
    return {
      status: 'Failed',
      fontsDetected: [],
      details: `Font check error: ${err.message}`
    };
  }
}
