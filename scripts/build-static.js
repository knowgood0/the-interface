// Run with: npm run build
//
// Generates a fully static version of the site into /dist — every article,
// category, tag, author, and legal page pre-rendered to a plain .html file,
// plus sitemap.xml, rss.xml, robots.txt, and a search index for
// client-side search. The output has zero server dependency: drag the
// /dist folder into Cloudflare Pages (or any static host) and it works.
//
// The admin panel and its live editing are NOT part of this build — they
// still require `node server.js` running somewhere. The intended workflow:
// edit content (via the admin panel locally, or by hand-editing the JSON
// files in /data), then run `npm run build`, then redeploy /dist.

import { mkdir, writeFile, cp, rm } from 'node:fs/promises';
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

async function writeHtml(relPath, html) {
  const full = path.join(DIST, relPath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, html, 'utf-8');
}

async function build() {
  console.log('Building static site into /dist ...');

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const settings = await db.settings.get();
  const categories = await db.categories.all();
  const authors = await db.authors.all();
  const allArticles = await db.articles.all();
  const published = await db.articles.published();

  if (settings.domain.includes('example.com')) {
    console.warn(
      '\n  WARNING: data/settings.json still has the placeholder domain (example.com).\n' +
        '  Every canonical URL, sitemap entry, and Open Graph tag in this build will\n' +
        '  point at example.com. Set the real domain before deploying.\n'
    );
  }

  // ---- Homepage ----
  await writeHtml('index.html', homePage({ settings, categories, articles: published }));

  // ---- Articles ----
  for (const article of published) {
    const category = categories.find((c) => c.slug === article.category);
    const author = authors.find((a) => a.slug === article.author);
    const related = published.filter((a) => a.id !== article.id && a.category === article.category).slice(0, 4);
    const html = articlePage({ settings, article, category, author, related, categories });
    await writeHtml(`article/${article.slug}.html`, html);
  }

  // ---- Categories ----
  for (const category of categories) {
    const articles = published.filter((a) => a.category === category.slug);
    const html = listingPage({
      settings,
      title: category.name,
      description: category.description,
      path: `/category/${category.slug}`,
      articles,
      categories,
      categoryMeta: category,
      intro: category.description,
    });
    await writeHtml(`category/${category.slug}.html`, html);
  }

  // ---- Tags ----
  const allTags = [...new Set(published.flatMap((a) => a.tags || []))];
  for (const tag of allTags) {
    const articles = published.filter((a) => (a.tags || []).includes(tag));
    const html = listingPage({
      settings,
      title: `#${tag}`,
      description: `Articles tagged ${tag}`,
      path: `/tag/${tag}`,
      articles,
      categories,
    });
    await writeHtml(`tag/${encodeURIComponent(tag)}.html`, html);
  }

  // ---- Authors ----
  for (const author of authors) {
    const articles = published.filter((a) => a.author === author.slug);
    const html = listingPage({
      settings,
      title: author.name,
      description: author.bio,
      path: `/author/${author.slug}`,
      articles,
      categories,
      intro: author.bio,
    });
    await writeHtml(`author/${author.slug}.html`, html);
  }

  // ---- Search (client-side) ----
  await writeHtml('search.html', searchPage({ settings, categories }));
  const searchIndex = published.map((a) => ({
    title: a.title,
    dek: a.dek,
    slug: a.slug,
    category: a.category,
    tags: a.tags || [],
  }));
  await writeFile(path.join(DIST, 'search-index.json'), JSON.stringify(searchIndex), 'utf-8');

  // ---- Static / legal pages ----
  const staticPages = {
    'about.html': ['About', aboutHtml({ siteName: settings.siteName })],
    'contact.html': ['Contact', contactHtml()],
    'editorial-policy.html': ['Editorial Policy', editorialPolicyHtml({ siteName: settings.siteName })],
    'corrections.html': ['Corrections Policy', correctionsHtml({ siteName: settings.siteName })],
    'advertising-disclosure.html': ['Advertising Disclosure', advertisingDisclosureHtml({ siteName: settings.siteName })],
    'privacy.html': ['Privacy Policy', privacyHtml({ siteName: settings.siteName, domain: settings.domain })],
    'terms.html': ['Terms of Service', termsHtml({ siteName: settings.siteName })],
  };
  for (const [file, [title, html]] of Object.entries(staticPages)) {
    await writeHtml(file, staticPage({ settings, title, path: '/' + file.replace('.html', ''), html, categories }));
  }

  // ---- 404 (Cloudflare Pages serves this automatically for unmatched routes) ----
  await writeHtml(
    '404.html',
    staticPage({
      settings,
      title: '404 — Page Not Found',
      path: '/404',
      html: `<p>That page doesn't exist. Try the <a href="/">homepage</a> or use <a href="/search">search</a>.</p>`,
      categories,
    })
  );

  // ---- sitemap.xml / rss.xml / robots.txt ----
  await writeFile(path.join(DIST, 'sitemap.xml'), buildSitemap({ settings, articles: published, categories }), 'utf-8');
  await writeFile(path.join(DIST, 'rss.xml'), buildRss({ settings, articles: published }), 'utf-8');
  await writeFile(path.join(DIST, 'robots.txt'), buildRobotsTxt(settings), 'utf-8');

  // ---- static assets (css/js/images) ----
  await cp(path.join(ROOT, 'public'), DIST, { recursive: true });
  // admin.css is only needed by the admin panel, which isn't part of the
  // static export — drop it so it doesn't ship to production for nothing.
  await rm(path.join(DIST, 'css', 'admin.css'), { force: true });

  const draftCount = allArticles.length - published.length;
  console.log(`\nBuild complete: ${published.length} article(s), ${categories.length} categories, ${allTags.length} tags.`);
  if (draftCount > 0) {
    console.log(`(${draftCount} draft article(s) were skipped — they won't appear until published in the admin panel.)`);
  }
  console.log(`Output: ${DIST}`);
  console.log('Deploy: drag the /dist folder into Cloudflare Pages, or run `npx wrangler pages deploy dist`.');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
