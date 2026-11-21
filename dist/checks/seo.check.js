"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkSeoData = checkSeoData;
/**
 * Case 4 – Capture SEO data like - Meta Title, Meta Description, Canonical URL
 * Case 5 – Check Index Follow should be there or not
 */
async function checkSeoData(page) {
    const data = await page.evaluate(() => {
        // 1. Meta Title
        const titleTag = document.title || '';
        const metaTitleEl = document.querySelector('meta[name="title"]') || document.querySelector('meta[property="og:title"]');
        const metaTitle = (metaTitleEl?.getAttribute('content') || titleTag || '').trim();
        // 2. Meta Description
        const metaDescEl = document.querySelector('meta[name="description"]') || document.querySelector('meta[property="og:description"]');
        const metaDescription = (metaDescEl?.getAttribute('content') || '').trim();
        // 3. Canonical URL
        const canonicalEl = document.querySelector('link[rel="canonical"]');
        const canonicalUrl = (canonicalEl?.getAttribute('href') || '').trim();
        // 4. Robots / Index Follow
        const robotsEl = document.querySelector('meta[name="robots"]') || document.querySelector('meta[name="googlebot"]');
        const robotsContent = (robotsEl?.getAttribute('content') || '').trim().toLowerCase();
        return {
            metaTitle,
            metaDescription,
            canonicalUrl,
            robotsContent
        };
    });
    // Evaluate Index Follow status
    let indexFollowStatus = '';
    let isIndexFollowPassed = false;
    if (!data.robotsContent) {
        // Default search engine behavior when robots tag is absent is index, follow
        indexFollowStatus = 'Passed (Default: index, follow)';
        isIndexFollowPassed = true;
    }
    else {
        const hasNoIndex = data.robotsContent.includes('noindex');
        const hasNoFollow = data.robotsContent.includes('nofollow');
        const hasIndex = data.robotsContent.includes('index') && !hasNoIndex;
        const hasFollow = data.robotsContent.includes('follow') && !hasNoFollow;
        if (hasNoIndex && hasNoFollow) {
            indexFollowStatus = 'Failed (noindex, nofollow)';
            isIndexFollowPassed = false;
        }
        else if (hasNoIndex) {
            indexFollowStatus = 'Failed (noindex)';
            isIndexFollowPassed = false;
        }
        else if (hasNoFollow) {
            indexFollowStatus = 'Failed (nofollow)';
            isIndexFollowPassed = false;
        }
        else if (hasIndex && hasFollow) {
            indexFollowStatus = 'Passed (index, follow)';
            isIndexFollowPassed = true;
        }
        else if (hasIndex) {
            indexFollowStatus = 'Passed (index)';
            isIndexFollowPassed = true;
        }
        else {
            indexFollowStatus = `Passed (${data.robotsContent})`;
            isIndexFollowPassed = true;
        }
    }
    return {
        metaTitle: data.metaTitle || 'Not Found',
        metaDescription: data.metaDescription || 'Not Found',
        canonicalUrl: data.canonicalUrl || 'Not Found',
        robotsContent: data.robotsContent || 'Not Specified',
        indexFollowStatus,
        isIndexFollowPassed
    };
}
