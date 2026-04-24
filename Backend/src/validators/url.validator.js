import { body, validationResult } from "express-validator";

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalises a raw URL string submitted by the user:
 *  - Trims whitespace
 *  - Strips any accidental double-protocol (https://https://)
 *  - Ensures exactly one https:// prefix
 *
 * Returns the cleaned URL string.
 */
const normaliseUrl = (raw) => {
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  // Strip any leading protocol the user may have typed (http:// or https://)
  const stripped = trimmed.replace(/^https?:\/\//i, "");
  return `https://${stripped}`;
};

/**
 * Checks whether a string is a structurally valid URL with an
 * http or https scheme.
 */
const isValidHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

// ─── Blocked / obviously-invalid hostnames ────────────────────────────────────

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
]);

const isBlockedHostname = (value) => {
  try {
    const { hostname } = new URL(value);
    return BLOCKED_HOSTNAMES.has(hostname.toLowerCase());
  } catch {
    return false;
  }
};

// ─── Validator middleware array ────────────────────────────────────────────────

/**
 * validateCrawlUrl
 *
 * Express-validator chain for POST /api/crawl.
 * Must be used as a middleware array in the route definition,
 * followed by `validateRequest` (re-exported here for convenience).
 *
 * Usage in route:
 *   router.post('/crawl', validateCrawlUrl, crawlUrl);
 */
export const validateCrawlUrl = [
  body("url")
    // 1. Must exist and not be empty
    .exists({ checkFalsy: true })
    .withMessage("url is required")
    .bail()

    // 2. Must be a string
    .isString()
    .withMessage("url must be a string")
    .bail()

    // 3. Normalise: strip accidental double-protocol, ensure https://
    .customSanitizer(normaliseUrl)

    // 4. Must be a structurally valid http/https URL
    .custom((value) => {
      if (!isValidHttpUrl(value)) {
        throw new Error(
          "url must be a valid web address (e.g. https://example.com)"
        );
      }
      return true;
    })
    .bail()

    // 5. Reject localhost / loopback — nothing useful to audit there
    .custom((value) => {
      if (isBlockedHostname(value)) {
        throw new Error("url must point to a publicly accessible website");
      }
      return true;
    })
    .bail()

    // 6. Hostname must contain at least one dot (e.g. "example.com")
    .custom((value) => {
      try {
        const { hostname } = new URL(value);
        if (!hostname.includes(".")) {
          throw new Error("url must include a valid domain (e.g. example.com)");
        }
      } catch (e) {
        if (e.message.startsWith("url must")) throw e;
        throw new Error("url is not a valid web address");
      }
      return true;
    })
    .bail()

    // 7. Reasonable length guard (SSRF / log-injection protection)
    .isLength({ max: 2048 })
    .withMessage("url must not exceed 2048 characters"),

  // ─── Final error collector ───────────────────────────────────────────────────
  validateRequest,
];

// ─── Shared request finaliser (same as auth.validator.js) ─────────────────────

export function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  return res.status(400).json({
    status: "error",
    error: "Validation failed",
    errors: errors
      .array()
      .map((err) => ({ field: err.param ?? err.path, message: err.msg })),
  });
}
