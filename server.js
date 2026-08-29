import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';

import { db } from './lib/db.js';
import { recordPageview } from './lib/analytics.js';
import { buildSitemap, buildRss, buildRobotsTxt } from './lib/seo.js';
import { homePage } from './views/home.js';
import { articlePage } from './views/article.js';
import { listingPage } from './views/listing.js';
import { staticPage } from './views/static.js';
import {
  aboutHtml,
  contactHtml,
  editorialPolicyHtml,
  correctionsHtml,
  advertisingDisclosureHtml,
  privacyHtml,
  termsHtml,
} from './data/static-content.js';
import { handleAdminRequest } from './admin/routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// ---- tiny static file server for /public ----
const MIME = {
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

async function serveStatic(req, res, urlPath) {
  const filePath = path.join(__dirname, 'public', urlPath);
  if (!filePath.startsWith(path.join(__dirname, 'public'))) return false;
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.css' || ext === '.js' ? 'public, max-age=3600' : 'public, max-age=86400',
    });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

function notFound(res, settings, categories) {
  const html = staticPage({
    settings,
    title: '404 — Page Not Found',
    path: '/404',
    html: `<p>That page doesn't exist. Try the <a href="/">homepage</a> or use search.</p>`,
    categories,
  });
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function send(res, status, body, contentType = 'text/html; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const p = url.pathname;

    // Static assets
    if (p.startsWith('/css/') || p.startsWith('/js/') || p.startsWith('/images/')) {
      const served = await serveStatic(req, res, p);
      if (served) return;
      return send(res, 404, 'Not found');
    }

    // Admin panel — fully separate router
    if (p.startsWith('/admin')) {
      return handleAdminRequest(req, res, { url, parseBody });
    }

    const settings = await db.settings.get();
    const categories = await db.categories.all();

    // robots.txt / sitemap.xml / rss.xml
    if (p === '/robots.txt') {
      return send(res, 200, buildRobotsTxt(settings), 'text/plain');
    }
    if (p === '/sitemap.xml') {
      const articles = await db.articles.published();
      return send(res, 200, buildSitemap({ settings, articles, categories }), 'application/xml');
    }
    if (p === '/rss.xml') {
      const articles = await db.articles.published();
      return send(res, 200, buildRss({ settings, articles }), 'application/xml');
    }

    // Homepage
    if (p === '/') {
      const articles = await db.articles.published();
      await recordPageview({ path: p, referrer: req.headers.referer, userAgent: req.headers['user-agent'] });
      return send(res, 200, homePage({ settings, categories, articles }));
    }

    // Article page
    if (p.startsWith('/article/')) {
      const slug = p.replace('/article/', '');
      const article = await db.articles.bySlug(slug);
      if (!article || article.status !== 'published') return notFound(res, settings, categories);
      const category = await db.categories.bySlug(article.category);
      const author = await db.authors.bySlug(article.author);
      const related = await db.articles.related(article);
      await recordPageview({ path: p, articleSlug: slug, referrer: req.headers.referer, userAgent: req.headers['user-agent'] });
      return send(res, 200, articlePage({ settings, article, category, author, related, categories }));
    }

    // Category page
    if (p.startsWith('/category/')) {
      const slug = p.replace('/category/', '');
      const category = await db.categories.bySlug(slug);
      if (!category) return notFound(res, settings, categories);
      const articles = await db.articles.byCategory(slug);
      return send(
        res,
        200,
        listingPage({
          settings,
          title: category.name,
          description: category.description,
          path: p,
          articles,
          categories,
          categoryMeta: category,
          intro: category.description,
        })
      );
    }

    // Tag page
    if (p.startsWith('/tag/')) {
      const tag = decodeURIComponent(p.replace('/tag/', ''));
      const articles = await db.articles.byTag(tag);
      return send(
        res,
        200,
        listingPage({ settings, title: `#${tag}`, description: `Articles tagged ${tag}`, path: p, articles, categories })
      );
    }

    // Author page
    if (p.startsWith('/author/')) {
      const slug = p.replace('/author/', '');
      const author = await db.authors.bySlug(slug);
      if (!author) return notFound(res, settings, categories);
      const all = await db.articles.published();
      const articles = all.filter((a) => a.author === slug);
      return send(
        res,
        200,
        listingPage({
          settings,
          title: author.name,
          description: author.bio,
          path: p,
          articles,
          categories,
          intro: `${author.bio}`,
        })
      );
    }

    // Search
    if (p === '/search') {
      const q = (url.searchParams.get('q') || '').toLowerCase().trim();
      const all = await db.articles.published();
      const articles = q
        ? all.filter(
            (a) =>
              a.title.toLowerCase().includes(q) ||
              (a.dek || '').toLowerCase().includes(q) ||
              (a.tags || []).some((t) => t.toLowerCase().includes(q))
          )
        : [];
      return send(
        res,
        200,
        listingPage({
          settings,
          title: q ? `Search: "${q}"` : 'Search',
          description: `Search results for ${q}`,
          path: p,
          articles,
          categories,
          intro: q ? `${articles.length} result${articles.length === 1 ? '' : 's'} for "${q}"` : 'Enter a search term above.',
        })
      );
    }

    // Newsletter signup (stub — wires to a real ESP once one is configured)
    if (p === '/newsletter' && req.method === 'POST') {
      await parseBody(req);
      // settings.newsletterEndpoint, when set, is where this should forward to.
      res.writeHead(302, { Location: '/?subscribed=1' });
      return res.end();
    }

    // Static/legal pages
    const staticPages = {
      '/about': ['About', aboutHtml({ siteName: settings.siteName })],
      '/contact': ['Contact', contactHtml()],
      '/editorial-policy': ['Editorial Policy', editorialPolicyHtml({ siteName: settings.siteName })],
      '/corrections': ['Corrections Policy', correctionsHtml({ siteName: settings.siteName })],
      '/advertising-disclosure': ['Advertising Disclosure', advertisingDisclosureHtml({ siteName: settings.siteName })],
      '/privacy': ['Privacy Policy', privacyHtml({ siteName: settings.siteName, domain: settings.domain })],
      '/terms': ['Terms of Service', termsHtml({ siteName: settings.siteName })],
    };
    if (staticPages[p]) {
      const [title, html] = staticPages[p];
      return send(res, 200, staticPage({ settings, title, path: p, html, categories }));
    }

    return notFound(res, settings, categories);
  } catch (err) {
    console.error(err);
    send(res, 500, `<h1>500 — Something broke</h1><pre>${process.env.NODE_ENV === 'development' ? err.stack : ''}</pre>`);
  }
});

server.listen(PORT, () => {
  console.log(`The Interface running at http://localhost:${PORT}`);
});
