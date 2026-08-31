// npm run build
// Builds a complete static site from data/*.json. No Node server is required at runtime.
// If an article is missing a real image, the build automatically finds a reusable
// Wikimedia Commons image, downloads it into dist, and uses its attribution.

import { mkdir, writeFile, cp, rm, readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { db } from '../lib/db.js';
import { buildSitemap, buildRss, buildRobotsTxt } from '../lib/seo.js';
import { homePage } from '../views/home.js';
import { articlePage } from '../views/article.js';
import { listingPage } from '../views/listing.js';
import { staticPage } from '../views/static.js';
import { searchPage } from '../views/search.js';
import {
  aboutHtml,
  contactHtml,
  editorialPolicyHtml,
  correctionsHtml,
  advertisingDisclosureHtml,
  privacyHtml,
  termsHtml,
} from '../data/static-content.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const FALLBACK_DOMAIN = 'https://the-interface.pages.dev';

function cleanText(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
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

function isPlaceholderImage(text = '') {
  return /placeholder|replace before launch/i.test(text);
}

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

function imageQueryFor(article) {
  const tags = Array.isArray(article.tags) ? article.tags.slice(0, 4).join(' ') : '';
  return cleanText(article.imageSearchQuery || `${article.title} ${tags}`).slice(0, 160);
}

async function searchCommons(query) {
  const url = new URL(COMMONS_API);
  url.searchParams.set('action', 'query');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', query);
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrlimit', '20');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata|mime|size|width|height');
  url.searchParams.set('iiurlwidth', '1600');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');

  const res = await fetch(url, { headers: { 'User-Agent': 'TheInterfaceStaticBuilder/1.0' } });
  if (!res.ok) throw new Error(`Wikimedia Commons search failed: ${res.status}`);
  const data = await res.json();
  const pages = Object.values(data.query?.pages || {});

  const candidates = pages.map((p) => {
    const info = p.imageinfo?.[0] || {};
    const meta = info.extmetadata || {};
    return {
      title: p.title,
      imageUrl: info.thumburl || info.url,
      pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
      mime: info.mime || '',
      size: Number(info.size || 0),
      width: Number(info.width || 0),
      height: Number(info.height || 0),
      license: cleanText(meta.LicenseShortName?.value || ''),
      author: cleanText(meta.Artist?.value || meta.Credit?.value || 'Wikimedia Commons contributor'),
      description: cleanText(meta.ImageDescription?.value || p.title.replace(/^File:/, '')),
    };
  }).filter((x) =>
    x.imageUrl &&
    x.width >= 1000 &&
    x.height >= 500 &&
    x.height / x.width >= 0.45 &&
    x.height / x.width <= 0.8 &&
    /CC BY|CC BY-SA|CC0|Public domain|PD/i.test(x.license)
  );

  return candidates[0] || null;
}

async function downloadCommonsImage(image) {
  const res = await fetch(image.imageUrl, { headers: { 'User-Agent': 'TheInterfaceStaticBuilder/1.0' } });
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Selected image is too large');
  const type = (res.headers.get('content-type') || image.mime || 'image/jpeg').split(';')[0].toLowerCase();
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  return { bytes, ext };
}

async function ensureArticleImages(articles) {
  const result = [];
  for (const article of articles) {
    const existingRel = article.featuredImage || '';
    const existingPath = path.join(ROOT, 'public', existingRel.replace(/^\//, ''));
    let useExisting = await exists(existingPath);
    if (useExisting && existingPath.toLowerCase().endsWith('.svg')) {
      const source = await readFile(existingPath, 'utf8').catch(() => '');
      useExisting = !isPlaceholderImage(source);
    }

    if (useExisting) {
      result.push({ ...article });
      continue;
    }

    const image = await searchCommons(imageQueryFor(article));
    if (!image) throw new Error(`No reusable image found for article: ${article.title}`);
    const downloaded = await downloadCommonsImage(image);
    const filename = `${article.slug || 'article'}-${Date.now().toString(36)}.${downloaded.ext}`;
    const distRel = `/images/articles/${filename}`;
    const distPath = path.join(DIST, distRel.replace(/^\//, ''));
    await mkdir(path.dirname(distPath), { recursive: true });
    await writeFile(distPath, downloaded.bytes);

    result.push({
      ...article,
      featuredImage: distRel,
      featuredImageAlt: article.featuredImageAlt && !isPlaceholderImage(article.featuredImageAlt)
        ? article.featuredImageAlt
        : image.description,
      imageCredit: `${image.author} — ${image.license}`,
      imageSourceUrl: image.pageUrl,
    });
    console.log(`  Image: ${article.title} <- ${image.title}`);
  }
  return result;
}

async function writeHtml(relPath, html) {
  const full = path.join(DIST, relPath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, html, 'utf8');
}

async function assertNoPlaceholders() {
  const forbidden = /REPLACE_WITH_REAL_NAME|REPLACE:|\[FILL IN|example\.com|Placeholder — replace before launch|Coming soon\./i;
  const files = [];
  async function walk(dir) {
    const { readdir } = await import('node:fs/promises');
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(html|xml|txt|json|js|css)$/.test(entry.name)) files.push(full);
    }
  }
  await walk(DIST);
  const bad = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8').catch(() => '');
    if (forbidden.test(text)) bad.push(path.relative(DIST, file));
  }
  if (bad.length) throw new Error(`Build contains placeholder content: ${bad.join(', ')}`);
}

async function build() {
  console.log('Building populated static site into /dist ...');
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const rawSettings = await db.settings.get();
  const settings = {
    ...rawSettings,
    domain: process.env.SITE_URL || rawSettings.domain || FALLBACK_DOMAIN,
  };
  const categories = await db.categories.all();
  const authors = await db.authors.all();
  const allArticles = await db.articles.all();
  const publishedRaw = await db.articles.published();

  if (!settings.domain || /example\.com/i.test(settings.domain)) {
    settings.domain = FALLBACK_DOMAIN;
  }

  const published = await ensureArticleImages(publishedRaw);

  await cp(path.join(ROOT, 'public'), DIST, { recursive: true });
  // ensureArticleImages writes generated images before public is copied, so copy the generated images again.
  for (const article of published) {
    const src = path.join(DIST, article.featuredImage.replace(/^\//, ''));
    if (!(await exists(src))) throw new Error(`Missing generated image for ${article.title}`);
  }
  await rm(path.join(DIST, 'css', 'admin.css'), { force: true });
  // The source repo historically contained placeholder article SVGs. They are
  // never shipped; every published article receives a real reusable image above.
  const articleImageDir = path.join(DIST, 'images', 'articles');
  for (const name of ['ai-pricing.svg','chatbot-memory.svg','ai-agents.svg','reduce-mistakes.svg','small-team-ai.svg','writing-tools.svg']) {
    await rm(path.join(articleImageDir, name), { force: true });
  }

  await writeHtml('index.html', homePage({ settings, categories, articles: published }));
  for (const article of published) {
    const category = categories.find((c) => c.slug === article.category);
    const author = authors.find((a) => a.slug === article.author);
    const related = published.filter((a) => a.id !== article.id && a.category === article.category).slice(0, 4);
    await writeHtml(`article/${article.slug}.html`, articlePage({ settings, article, category, author, related, categories }));
  }
  for (const category of categories) {
    const articles = published.filter((a) => a.category === category.slug);
    await writeHtml(`category/${category.slug}.html`, listingPage({
      settings, title: category.name, description: category.description,
      path: `/category/${category.slug}`, articles, categories,
      categoryMeta: category, intro: category.description,
    }));
  }
  const allTags = [...new Set(published.flatMap((a) => a.tags || []))];
  for (const tag of allTags) {
    const articles = published.filter((a) => (a.tags || []).includes(tag));
    await writeHtml(`tag/${encodeURIComponent(tag)}.html`, listingPage({
      settings, title: `#${tag}`, description: `Articles tagged ${tag}`,
      path: `/tag/${tag}`, articles, categories,
    }));
  }
  for (const author of authors) {
    const articles = published.filter((a) => a.author === author.slug);
    await writeHtml(`author/${author.slug}.html`, listingPage({
      settings, title: author.name, description: author.bio,
      path: `/author/${author.slug}`, articles, categories, intro: author.bio,
    }));
  }

  await writeHtml('search.html', searchPage({ settings, categories }));
  await writeFile(path.join(DIST, 'search-index.json'), JSON.stringify(published.map((a) => ({
    title: a.title, dek: a.dek, slug: a.slug, category: a.category, tags: a.tags || [],
  }))), 'utf8');

  const staticPages = {
    'about.html': ['About', aboutHtml({ siteName: settings.siteName })],
    'contact.html': ['Contact', contactHtml({ siteName: settings.siteName })],
    'editorial-policy.html': ['Editorial Policy', editorialPolicyHtml({ siteName: settings.siteName })],
    'corrections.html': ['Corrections Policy', correctionsHtml({ siteName: settings.siteName })],
    'advertising-disclosure.html': ['Advertising Disclosure', advertisingDisclosureHtml({ siteName: settings.siteName })],
    'privacy.html': ['Privacy Policy', privacyHtml({ siteName: settings.siteName, domain: settings.domain })],
    'terms.html': ['Terms of Service', termsHtml({ siteName: settings.siteName })],
  };
  for (const [file, [title, html]] of Object.entries(staticPages)) {
    await writeHtml(file, staticPage({ settings, title, path: '/' + file.replace('.html', ''), html, categories }));
  }
  await writeHtml('404.html', staticPage({
    settings, title: '404 — Page Not Found', path: '/404',
    html: '<p>That page does not exist. Try the <a href="/">homepage</a> or <a href="/search">search</a>.</p>', categories,
  }));

  await writeFile(path.join(DIST, 'sitemap.xml'), buildSitemap({ settings, articles: published, categories }), 'utf8');
  await writeFile(path.join(DIST, 'rss.xml'), buildRss({ settings, articles: published }), 'utf8');
  await writeFile(path.join(DIST, 'robots.txt'), buildRobotsTxt(settings), 'utf8');

  await assertNoPlaceholders();
  const draftCount = allArticles.length - publishedRaw.length;
  console.log(`Build complete: ${published.length} published articles, ${categories.length} categories, ${allTags.length} tags.`);
  if (draftCount > 0) console.log(`${draftCount} draft article(s) remain in data but were not published.`);
  console.log(`Output: ${DIST}`);
}

build().catch((err) => {
  console.error('\nBUILD FAILED:', err.message);
  process.exit(1);
});
