/**
 * Disk-based cache for API responses.
 * Stores responses in web/scripts/.cache/ with SHA256 key and 24h TTL.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CACHE_DIR = path.resolve(__dirname, "../.cache");
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function cacheKey(url) {
  return crypto.createHash("sha256").update(url).digest("hex");
}

function getCached(url) {
  const key = cacheKey(url);
  const filepath = path.join(CACHE_DIR, `${key}.json`);

  if (!fs.existsSync(filepath)) return null;

  try {
    const stat = fs.statSync(filepath);
    if (Date.now() - stat.mtimeMs > DEFAULT_TTL_MS) {
      fs.unlinkSync(filepath);
      return null;
    }
    return JSON.parse(fs.readFileSync(filepath, "utf8"));
  } catch {
    return null;
  }
}

function setCache(url, data) {
  const key = cacheKey(url);
  const filepath = path.join(CACHE_DIR, `${key}.json`);
  try {
    fs.writeFileSync(filepath, JSON.stringify(data), "utf8");
  } catch (e) {
    console.warn(`[cache] Failed to write cache: ${e.message}`);
  }
}

function clearCache() {
  if (fs.existsSync(CACHE_DIR)) {
    const files = fs.readdirSync(CACHE_DIR);
    for (const f of files) {
      fs.unlinkSync(path.join(CACHE_DIR, f));
    }
  }
}

/**
 * Fetch with caching and retry.
 * @param {string} url
 * @param {object} options - { useCache: true, maxRetries: 3, delayMs: 200 }
 */
async function cachedFetch(url, options = {}) {
  const { useCache = true, maxRetries = 3, delayMs = 1000 } = options;

  if (useCache) {
    const cached = getCached(url);
    if (cached) return cached;
  }

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, attempt - 1)));
      }
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      // Always read as text first, then try JSON.parse.
      // Many Korean APIs (KOSIS, R-ONE) return JSON with text/html content-type.
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        // Not valid JSON - return as raw text
        data = { _raw: text, _isXml: true };
      }
      if (useCache) setCache(url, data);
      return data;
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries) {
        console.warn(`[fetch] Retry ${attempt + 1}/${maxRetries} for ${url.substring(0, 80)}... (${e.message})`);
      }
    }
  }
  throw lastError;
}

module.exports = { cachedFetch, getCached, setCache, clearCache };
