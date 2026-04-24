import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

let browserInstance = null;

// ─── Error Classification ─────────────────────────────────────────────────────

/**
 * Maps raw error messages to user-friendly error codes and messages.
 * This lets the frontend display contextual feedback instead of raw stack traces.
 */
const classifyError = (error) => {
    const msg = (error.message || '').toLowerCase();

    if (msg.includes('net::err_name_not_resolved') || msg.includes('getaddrinfo enotfound')) {
        return {
            code: 'DNS_RESOLUTION_FAILED',
            message: 'The website address could not be found. Please check the URL and try again.',
            retryable: false,
        };
    }
    if (msg.includes('net::err_connection_refused')) {
        return {
            code: 'CONNECTION_REFUSED',
            message: 'The website refused the connection. The server may be down or blocking automated access.',
            retryable: true,
        };
    }
    if (msg.includes('net::err_connection_timed_out')) {
        return {
            code: 'CONNECTION_TIMEOUT',
            message: 'The connection to the website timed out. The server may be unreachable.',
            retryable: true,
        };
    }
    if (msg.includes('net::err_ssl') || msg.includes('net::err_cert')) {
        return {
            code: 'SSL_ERROR',
            message: 'The website has an invalid or expired SSL certificate.',
            retryable: false,
        };
    }
    if (msg.includes('navigation timeout')) {
        return {
            code: 'NAVIGATION_TIMEOUT',
            message: 'The page took too long to load. It may be slow or have persistent background connections.',
            retryable: true,
        };
    }
    if (msg.includes('target closed') || msg.includes('session closed') || msg.includes('protocol error')) {
        return {
            code: 'BROWSER_CRASHED',
            message: 'The browser session crashed unexpectedly. Retrying with a fresh instance.',
            retryable: true,
        };
    }
    if (msg.includes('net::err_aborted')) {
        return {
            code: 'REQUEST_ABORTED',
            message: 'The page request was aborted — possibly due to a redirect loop or server-side block.',
            retryable: true,
        };
    }
    if (msg.includes('net::err_too_many_redirects')) {
        return {
            code: 'TOO_MANY_REDIRECTS',
            message: 'The website has a redirect loop. Please verify the URL is correct.',
            retryable: false,
        };
    }

    return {
        code: 'CRAWL_ERROR',
        message: error.message || 'An unexpected error occurred during the crawl.',
        retryable: false,
    };
};

// ─── URL Validation ───────────────────────────────────────────────────────────

/**
 * Validates and normalizes a URL before crawling.
 * Returns { valid, url, error }.
 */
const validateUrl = (url) => {
    if (!url || typeof url !== 'string') {
        return { valid: false, url: null, error: 'URL is required.' };
    }

    let normalized = url.trim();

    // Prepend https:// if no protocol is present
    if (!/^https?:\/\//i.test(normalized)) {
        normalized = `https://${normalized}`;
    }

    try {
        const parsed = new URL(normalized);

        // Only allow http/https
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return { valid: false, url: null, error: `Unsupported protocol: ${parsed.protocol}` };
        }

        // Block obvious local/private targets
        const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];
        if (blockedHosts.includes(parsed.hostname)) {
            return { valid: false, url: null, error: 'Crawling localhost or private addresses is not allowed.' };
        }

        return { valid: true, url: parsed.href, error: null };

    } catch {
        return { valid: false, url: null, error: 'The URL format is invalid.' };
    }
};

// ─── Internal: Shared Browser Instance ───────────────────────────────────────

const getBrowserInstance = async () => {
    // If the previous instance is dead, clear it so we create a new one
    if (browserInstance) {
        try {
            // A quick health-check: if the browser process is gone, this will throw
            if (!browserInstance.isConnected()) {
                console.warn('[browser] Previous instance disconnected. Launching a new one.');
                browserInstance = null;
            }
        } catch {
            browserInstance = null;
        }
    }

    if (!browserInstance) {
        browserInstance = await puppeteer.launch({
            headless: true,
            executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--no-zygote',
                '--no-first-run'
            ]
        });

        // Auto-clear the reference if the browser process exits unexpectedly
        browserInstance.on('disconnected', () => {
            console.warn('[browser] Browser disconnected unexpectedly.');
            browserInstance = null;
        });
    }
    return browserInstance;
};

/**
 * Force-kill the current browser instance and null out the reference.
 * Used as a recovery step when the browser enters a broken state.
 */
const resetBrowserInstance = async () => {
    if (browserInstance) {
        try { await browserInstance.close(); } catch { /* already dead */ }
        browserInstance = null;
    }
};

// ─── Tool 1: crawlPage ────────────────────────────────────────────────────────

/**
 * Navigation strategies, tried in order. If the stricter strategy times out,
 * we fall back to a more lenient one so that slow sites still get crawled.
 */
const NAV_STRATEGIES = [
    { waitUntil: 'networkidle2', timeout: 30_000 },
    { waitUntil: 'domcontentloaded', timeout: 45_000 },
    { waitUntil: 'load', timeout: 60_000 },
];

/**
 * Crawls a URL and extracts page elements + a full-page screenshot.
 *
 * @param {string} url - The URL to crawl.
 * @returns {Promise<{
 *   success: boolean,
 *   data?: { url: string, timestamp: string, pages: Array },
 *   error?: string,
 *   errorCode?: string,
 *   retryable?: boolean
 * }>}
 */
export const crawlPage = async (url) => {
    // ── 1. Validate URL ──────────────────────────────────────────────────────
    const { valid, url: safeUrl, error: urlError } = validateUrl(url);
    if (!valid) {
        return { success: false, error: urlError, errorCode: 'INVALID_URL', retryable: false };
    }

    console.log(`[crawlPage] Starting crawl for: ${safeUrl}`);

    let page;
    let lastError;

    // ── 2. Attempt navigation with fallback strategies ───────────────────────
    for (let i = 0; i < NAV_STRATEGIES.length; i++) {
        const strategy = NAV_STRATEGIES[i];
        try {
            const browser = await getBrowserInstance();
            page = await browser.newPage();

            // Block heavy media resources to speed up crawl
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (['media', 'font'].includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            await page.setViewport({ width: 1280, height: 800 });

            // Set a realistic user-agent to avoid bot-blocking
            await page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            );

            console.log(`[crawlPage] Attempting navigation (strategy ${i + 1}/${NAV_STRATEGIES.length}: waitUntil=${strategy.waitUntil}, timeout=${strategy.timeout}ms)`);

            await page.goto(safeUrl, {
                waitUntil: strategy.waitUntil,
                timeout: strategy.timeout,
            });

            // If we reach here, navigation succeeded — break out of the retry loop
            break;

        } catch (navError) {
            lastError = navError;
            const classified = classifyError(navError);

            // Close the failed page so it doesn't leak
            if (page) { await page.close().catch(() => {}); page = null; }

            // If the browser itself crashed, reset it before next attempt
            if (classified.code === 'BROWSER_CRASHED') {
                await resetBrowserInstance();
            }

            // If the error is non-retryable (bad URL, SSL, etc.) bail immediately
            if (!classified.retryable) {
                console.error(`[crawlPage] Non-retryable error: ${classified.code} — ${classified.message}`);
                return { success: false, error: classified.message, errorCode: classified.code, retryable: false };
            }

            // If this was the last strategy, we've exhausted all retries
            if (i === NAV_STRATEGIES.length - 1) {
                console.error(`[crawlPage] All ${NAV_STRATEGIES.length} navigation strategies exhausted.`);
                return {
                    success: false,
                    error: `Failed to load the page after ${NAV_STRATEGIES.length} attempts. ${classified.message}`,
                    errorCode: classified.code,
                    retryable: false,
                };
            }

            console.warn(`[crawlPage] Strategy ${i + 1} failed (${classified.code}). Retrying with fallback...`);
        }
    }

    // ── 3. Extract page data ─────────────────────────────────────────────────
    try {
        const title = await page.title();

        const selectors = [
            'button', 'a', 'input', 'select', 'textarea', 'label',
            '[role="button"]', '[role="checkbox"]', '[role="dialog"]', '[role="alert"]',
            '.modal', '.banner', '.popup', '.overlay', '.cookie', '.consent',
            '[class*="close"]', '[class*="dismiss"]', '[class*="cancel"]',
            '[class*="subscribe"]', '[class*="newsletter"]',
            'form', '[class*="countdown"]', '[class*="timer"]',
            '[class*="price"]', '[class*="fee"]', '[class*="charge"]'
        ].join(', ');

        const elements = await page.$$eval(selectors, els => els.map(el => {
            const rect = el.getBoundingClientRect();
            const css = window.getComputedStyle(el);
            return {
                id: el.id || el.getAttribute('data-testid') || `el_${Math.random().toString(36).slice(2, 10)}`,
                tag: el.tagName.toLowerCase(),
                text: (el.textContent || '').trim().slice(0, 500),
                classes: [...el.classList],
                bounding_box: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
                computed_css: {
                    font_size: css.fontSize,
                    font_weight: css.fontWeight,
                    color: css.color,
                    background_color: css.backgroundColor,
                    opacity: css.opacity,
                    display: css.display,
                    visibility: css.visibility,
                    cursor: css.cursor,
                    z_index: css.zIndex,
                    position: css.position,
                    text_decoration: css.textDecoration,
                    border: css.border,
                    padding: css.padding,
                    margin: css.margin,
                    text_align: css.textAlign
                },
                aria: {
                    role: el.getAttribute('role'),
                    label: el.getAttribute('aria-label'),
                    hidden: el.getAttribute('aria-hidden'),
                    checked: el.getAttribute('aria-checked'),
                    expanded: el.getAttribute('aria-expanded'),
                    disabled: el.getAttribute('aria-disabled'),
                    required: el.getAttribute('aria-required')
                },
                is_interactive: ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName),
                is_visible: rect.width > 0 && rect.height > 0 && css.display !== 'none' && css.visibility !== 'hidden',
                element_type: el.tagName.toLowerCase(),
                href: el.href || null,
                input_type: el.type || null,
                default_checked: el.checked ?? null,
                placeholder: el.placeholder || null,
                children: []
            };
        }));

        // Save screenshot to disk + return as base64
        const screenshotsDir = path.resolve(process.cwd(), 'screenshots');
        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
        }

        const timestamp = Date.now();
        const safeUrlName = safeUrl.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
        const screenshotPath = path.join(screenshotsDir, `${safeUrlName}_${timestamp}.png`);

        const screenshotBuffer = await page.screenshot({ fullPage: true, timeout: 15_000 }).catch(() => null);

        let screenshotBase64 = '';
        if (screenshotBuffer) {
            fs.writeFileSync(screenshotPath, screenshotBuffer);
            screenshotBase64 = screenshotBuffer.toString('base64');
        } else {
            console.warn('[crawlPage] Screenshot capture failed — continuing without it.');
        }

        await page.close();

        const crawlData = {
            url: safeUrl,
            timestamp: new Date().toISOString(),
            pages: [
                {
                    page_id: `page_${timestamp}`,
                    url: safeUrl,
                    title,
                    screenshots: screenshotBase64
                        ? { full_page: `data:image/png;base64,${screenshotBase64}` }
                        : { full_page: null },
                    page_state: 'initial',
                    elements
                }
            ]
        };

        console.log(`[crawlPage] Done. Extracted ${elements.length} elements from "${title}".`);
        return { success: true, data: crawlData };

    } catch (extractError) {
        if (page) await page.close().catch(() => {});
        const classified = classifyError(extractError);
        console.error(`[crawlPage] Extraction error: ${classified.code} — ${extractError.message}`);
        return {
            success: false,
            error: `Page loaded but data extraction failed: ${classified.message}`,
            errorCode: classified.code,
            retryable: classified.retryable,
        };
    }
};

// ─── Tool 2: scanForDarkPatterns ──────────────────────────────────────────────
/**
 * Sends crawl data to the ML microservice for dark-pattern analysis.
 *
 * @param {object} crawlData - The output of crawlPage().data
 * @returns {Promise<{
 *   success: boolean,
 *   data?: object,
 *   error?: string,
 *   errorCode?: string
 * }>}
 */
export const scanForDarkPatterns = async (crawlData) => {
    try {
        if (!crawlData) {
            return { success: false, error: 'crawlData is required', errorCode: 'MISSING_DATA' };
        }

        console.log('[scanForDarkPatterns] Sending data to ML microservice...');

        let mlResponse;
        try {
            mlResponse = await fetch('http://127.0.0.1:8000/api/v1/scan', {
                method: 'POST',
                headers: {
                    'X-API-Key': 'ncs-dark-pattern-auditor-2026',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(crawlData),
                signal: AbortSignal.timeout(120_000), // 2 min timeout for ML processing
            });
        } catch (fetchErr) {
            if (fetchErr.name === 'TimeoutError' || fetchErr.name === 'AbortError') {
                return {
                    success: false,
                    error: 'The ML analysis service timed out. The page may have too many elements to process.',
                    errorCode: 'ML_TIMEOUT',
                };
            }

            // Node's native fetch wraps connection errors in various ways
            const errMsg = (fetchErr.message || '').toLowerCase();
            const causeMsg = (fetchErr.cause?.message || '').toLowerCase();
            const causeCode = fetchErr.cause?.code || '';

            if (causeCode === 'ECONNREFUSED'
                || errMsg.includes('econnrefused')
                || causeMsg.includes('econnrefused')
                || errMsg.includes('fetch failed')
            ) {
                return {
                    success: false,
                    error: 'The ML microservice is not running. Please start the ML server (uvicorn api:app) and try again.',
                    errorCode: 'ML_UNAVAILABLE',
                };
            }

            console.error('[scanForDarkPatterns] Unexpected fetch error:', fetchErr.name, fetchErr.message, fetchErr.cause);
            throw fetchErr; // re-throw unexpected errors to the outer catch
        }

        if (!mlResponse.ok) {
            const errText = await mlResponse.text().catch(() => 'Unknown error');
            return {
                success: false,
                error: `ML analysis failed (HTTP ${mlResponse.status}): ${errText.substring(0, 200)}`,
                errorCode: 'ML_ERROR',
            };
        }

        const scanResult = await mlResponse.json();
        console.log('[scanForDarkPatterns] Analysis received.');
        return { success: true, data: scanResult };

    } catch (error) {
        console.error('[scanForDarkPatterns] Error:', error.message);
        return {
            success: false,
            error: `ML scan failed: ${error.message}`,
            errorCode: 'ML_ERROR',
        };
    }
};

// ─── Tool 3: crawlAndScan (combined) ─────────────────────────────────────────
/**
 * Convenience tool: crawls a URL and immediately scans it for dark patterns.
 * Wraps crawlPage + scanForDarkPatterns into a single agent-callable step.
 *
 * @param {string} url - The URL to audit.
 * @returns {Promise<{
 *   success: boolean,
 *   crawl?: object,
 *   scan?: object,
 *   error?: string,
 *   errorCode?: string
 * }>}
 */
export const crawlAndScan = async (url) => {
    const crawlResult = await crawlPage(url);

    if (!crawlResult.success) {
        return {
            success: false,
            error: `Crawl failed: ${crawlResult.error}`,
            errorCode: crawlResult.errorCode || 'CRAWL_ERROR',
        };
    }

    const scanResult = await scanForDarkPatterns(crawlResult.data);
    if (!scanResult.success) {
        return {
            success: false,
            error: `Scan failed: ${scanResult.error}`,
            errorCode: scanResult.errorCode || 'ML_ERROR',
        };
    }

    return {
        success: true,
        scan: JSON.stringify(scanResult.data)
    };
};