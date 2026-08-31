const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GITHUB_API = 'https://api.github.com';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

const DEFAULT_FEEDS = [
  { url: 'https://openai.com/blog/rss.xml', category: 'ai-tools', sourceType: 'rss' },
  { url: 'https://www.anthropic.com/rss.xml', category: 'ai-tools', sourceType: 'rss' },
  { url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', category: 'industry', sourceType: 'rss' },
  { url: 'https://www.theverge.com/rss/index.xml', category: 'industry', sourceType: 'rss' },
];

const CATEGORY_FALLBACKS = ['ai-tools', 'explainers', 'guides', 'industry'];
const MAX_SOURCE_CHARS = 5000;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function cleanText(value = '') {
  return String(value)
    .replace(/<!CDATA\[([\s\S]*?)\]>/gi, '$1')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? cleanText(match[1]) : '';
}

function parseItems(xml) {
  const rssItems = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  return rssItems.map((item) => ({
    title: extractTag(item, 'title'),
    link: extractTag(item, 'link'),
    pubDate:
      extractTag(item, 'pubDate') ||
      extractTag(item, 'published') ||
      extractTag(item, 'updated'),
    description:
      extractTag(item, 'description') ||
      extractTag(item, 'summary') ||
      extractTag(item, 'content'),
  }));
}

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': 'TheInterfacePublisher/1.0' },
    });

    if (!res.ok) return [];

    const xml = await res.text();

    return parseItems(xml)
      .slice(0, 8)
      .map((item) => ({ ...item, feed }));
  } catch (error) {
    console.log(`Feed failed: ${feed.url}`, error.message);
    return [];
  }
}

function normalizeTitle(title) {
  return cleanText(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `article-${Date.now()}`;
}

function escapeJsonString(value) {
  return String(value || '').trim();
}

async function groqGenerate(env, prompt) {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.GROQ_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL || 'openai/gpt-oss-120b',
      temperature: 0.35,

      // Increased
