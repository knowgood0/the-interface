import { appendFile, readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, '..', 'data', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'pageviews.ndjson');

let ready = false;
async function ensureLog() {
  if (ready) return;
  await mkdir(LOG_DIR, { recursive: true });
  ready = true;
}

// Records one line per pageview as newline-delimited JSON. Cheap to append,
// cheap to tail, and trivially replaceable with a real analytics DB table
// later (schema below maps 1:1 to a Postgres table).
export async function recordPageview({ path: urlPath, articleSlug, referrer, userAgent }) {
  await ensureLog();
  const entry = {
    ts: new Date().toISOString(),
    path: urlPath,
    articleSlug: articleSlug || null,
    referrer: referrer || null,
    source: classifyReferrer(referrer),
    userAgent: userAgent || null,
  };
  await appendFile(LOG_FILE, JSON.stringify(entry) + '\n', 'utf-8');
}

function classifyReferrer(referrer) {
  if (!referrer) return 'direct';
  try {
    const host = new URL(referrer).hostname.replace('www.', '');
    if (/google\./.test(host)) return 'google';
    if (/bing\./.test(host)) return 'bing';
    if (/(t\.co|twitter|x\.com)/.test(host)) return 'social-x';
    if (/reddit\./.test(host)) return 'social-reddit';
    if (/facebook\./.test(host)) return 'social-facebook';
    return 'referral:' + host;
  } catch {
    return 'unknown';
  }
}

export async function readAllPageviews() {
  await ensureLog();
  try {
    const raw = await readFile(LOG_FILE, 'utf-8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function summarize() {
  const rows = await readAllPageviews();
  const byArticle = {};
  const bySource = {};
  const byDay = {};
  for (const row of rows) {
    if (row.articleSlug) byArticle[row.articleSlug] = (byArticle[row.articleSlug] || 0) + 1;
    bySource[row.source] = (bySource[row.source] || 0) + 1;
    const day = row.ts.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  }
  const topArticles = Object.entries(byArticle)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([slug, views]) => ({ slug, views }));
  return {
    totalPageviews: rows.length,
    topArticles,
    bySource,
    byDay,
  };
}
