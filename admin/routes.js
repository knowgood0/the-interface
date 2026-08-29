import crypto from 'node:crypto';
import { db } from '../lib/db.js';
import { summarize } from '../lib/analytics.js';
import { adminLayout } from './views.js';

// --- Auth ---
// Single admin user, password from env var (never hardcoded, never stored
// in the JSON data files). Sessions are an in-memory token store, which is
// fine for a single long-running Node process (Render, a VPS, Railway) but
// will NOT survive across invocations on a serverless platform (Vercel
// functions, Cloudflare Workers) — see README "Deployment" section.
const sessions = new Map(); // token -> expiry timestamp
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const match = raw.split(';').map((s) => s.trim()).find((s) => s.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

function isAuthed(req) {
  const token = getCookie(req, 'admin_session');
  if (!token) return false;
  const expiry = sessions.get(token);
  if (!expiry || expiry < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function createSession(res) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  res.setHeader('Set-Cookie', `admin_session=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; SameSite=Lax`);
}

function destroySession(req, res) {
  const token = getCookie(req, 'admin_session');
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', 'admin_session=; HttpOnly; Path=/; Max-Age=0');
}

function checkPassword(candidate) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false; // refuse to auth if no password is configured
  const a = Buffer.from(candidate || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function send(res, status, body, contentType = 'text/html; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function parseFormBody(raw) {
  const params = new URLSearchParams(raw);
  return Object.fromEntries(params.entries());
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function handleAdminRequest(req, res, { url, parseBody }) {
  const p = url.pathname;

  if (!process.env.ADMIN_PASSWORD) {
    return send(
      res,
      500,
      `<h1>Admin disabled</h1><p>Set the ADMIN_PASSWORD environment variable to enable the admin panel. See README.md.</p>`
    );
  }

  // --- Login / logout ---
  if (p === '/admin/login' && req.method === 'GET') {
    return send(res, 200, adminLayout({ title: 'Log in', authed: false, body: loginForm() }));
  }
  if (p === '/admin/login' && req.method === 'POST') {
    const raw = await parseBody(req);
    const { password } = parseFormBody(raw);
    if (checkPassword(password)) {
      createSession(res);
      return redirect(res, '/admin');
    }
    return send(res, 401, adminLayout({ title: 'Log in', authed: false, body: loginForm('Incorrect password.') }));
  }
  if (p === '/admin/logout') {
    destroySession(req, res);
    return redirect(res, '/admin/login');
  }

  if (!isAuthed(req)) {
    return redirect(res, '/admin/login');
  }

  // --- Dashboard ---
  if (p === '/admin' || p === '/admin/') {
    const articles = await db.articles.all();
    const topics = await db.topics.all();
    const stats = await summarize();
    return send(res, 200, adminLayout({ title: 'Dashboard', authed: true, body: dashboardBody(articles, topics, stats) }));
  }

  // --- Articles list ---
  if (p === '/admin/articles' && req.method === 'GET') {
    const articles = await db.articles.all();
    return send(res, 200, adminLayout({ title: 'Articles', authed: true, body: articlesListBody(articles) }));
  }

  // --- New article form ---
  if (p === '/admin/articles/new' && req.method === 'GET') {
    const categories = await db.categories.all();
    const authors = await db.authors.all();
    return send(res, 200, adminLayout({ title: 'New Article', authed: true, body: articleFormBody(null, categories, authors) }));
  }

  // --- Edit article form ---
  const editMatch = p.match(/^\/admin\/articles\/([^/]+)\/edit$/);
  if (editMatch && req.method === 'GET') {
    const article = await db.articles.byId(editMatch[1]);
    if (!article) return send(res, 404, adminLayout({ title: 'Not found', authed: true, body: '<p>Article not found.</p>' }));
    const categories = await db.categories.all();
    const authors = await db.authors.all();
    return send(res, 200, adminLayout({ title: 'Edit Article', authed: true, body: articleFormBody(article, categories, authors) }));
  }

  // --- Save article (create or update) ---
  if (p === '/admin/articles/save' && req.method === 'POST') {
    const raw = await parseBody(req);
    const f = parseFormBody(raw);
    const existing = f.id ? await db.articles.byId(f.id) : null;
    const now = new Date().toISOString();
    const article = {
      id: f.id || crypto.randomUUID(),
      slug: f.slug ? slugify(f.slug) : slugify(f.title),
      title: f.title,
      dek: f.dek,
      category: f.category,
      tags: (f.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      author: f.author,
      status: f.status,
      articleType: f.articleType || 'article',
      publishedAt: f.status === 'published' ? existing?.publishedAt || now : existing?.publishedAt || null,
      updatedAt: now,
      featuredImage: f.featuredImage || '/images/og-default.jpg',
      featuredImageAlt: f.featuredImageAlt || '',
      sources: existing?.sources || [],
      body: (f.body || '').split('\n\n').map((s) => s.trim()).filter(Boolean),
    };
    await db.articles.save(article);
    return redirect(res, '/admin/articles');
  }

  // --- Delete article ---
  const deleteMatch = p.match(/^\/admin\/articles\/([^/]+)\/delete$/);
  if (deleteMatch && req.method === 'POST') {
    await db.articles.remove(deleteMatch[1]);
    return redirect(res, '/admin/articles');
  }

  // --- Topic discovery dashboard ---
  if (p === '/admin/topics' && req.method === 'GET') {
    const topics = await db.topics.all();
    return send(res, 200, adminLayout({ title: 'Topic Ideas', authed: true, body: topicsBody(topics) }));
  }
  const topicStatusMatch = p.match(/^\/admin\/topics\/([^/]+)\/status$/);
  if (topicStatusMatch && req.method === 'POST') {
    const raw = await parseBody(req);
    const { status } = parseFormBody(raw);
    const topics = await db.topics.all();
    const topic = topics.find((t) => t.id === topicStatusMatch[1]);
    if (topic) {
      topic.status = status;
      await db.topics.save(topic);
    }
    return redirect(res, '/admin/topics');
  }

  // --- Analytics ---
  if (p === '/admin/analytics' && req.method === 'GET') {
    const stats = await summarize();
    return send(res, 200, adminLayout({ title: 'Analytics', authed: true, body: analyticsBody(stats) }));
  }

  // --- Settings ---
  if (p === '/admin/settings' && req.method === 'GET') {
    const settings = await db.settings.get();
    return send(res, 200, adminLayout({ title: 'Settings', authed: true, body: settingsBody(settings) }));
  }
  if (p === '/admin/settings/save' && req.method === 'POST') {
    const raw = await parseBody(req);
    const f = parseFormBody(raw);
    const settings = await db.settings.get();
    Object.assign(settings, {
      siteName: f.siteName,
      tagline: f.tagline,
      description: f.description,
      domain: f.domain,
      twitterHandle: f.twitterHandle,
      adsenseClientId: f.adsenseClientId,
      adsensePublisherEnabled: f.adsensePublisherEnabled === 'on',
      newsletterProvider: f.newsletterProvider,
      newsletterEndpoint: f.newsletterEndpoint,
    });
    await db.settings.save(settings);
    return redirect(res, '/admin/settings');
  }

  return send(res, 404, adminLayout({ title: 'Not found', authed: true, body: '<p>Unknown admin page.</p>' }));
}

// ---------- HTML fragments ----------

function loginForm(error) {
  return `<div class="admin-login">
    <h1>Admin Login</h1>
    ${error ? `<p class="error">${error}</p>` : ''}
    <form method="post" action="/admin/login">
      <label>Password<input type="password" name="password" required autofocus></label>
      <button type="submit">Log in</button>
    </form>
  </div>`;
}

function dashboardBody(articles, topics, stats) {
  const published = articles.filter((a) => a.status === 'published').length;
  const drafts = articles.filter((a) => a.status === 'draft').length;
  const ideas = topics.filter((t) => t.status === 'idea').length;
  return `<h1>Dashboard</h1>
  <div class="stat-grid">
    <div class="stat"><strong>${published}</strong><span>Published</span></div>
    <div class="stat"><strong>${drafts}</strong><span>Drafts</span></div>
    <div class="stat"><strong>${ideas}</strong><span>Open topic ideas</span></div>
    <div class="stat"><strong>${stats.totalPageviews}</strong><span>Total pageviews (logged)</span></div>
  </div>
  <p>
    <a class="btn" href="/admin/articles/new">+ New Article</a>
    <a class="btn btn-secondary" href="/admin/topics">Review Topic Ideas</a>
    <a class="btn btn-secondary" href="/admin/analytics">View Analytics</a>
  </p>`;
}

function articlesListBody(articles) {
  const sorted = [...articles].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return `<h1>Articles</h1>
  <p><a class="btn" href="/admin/articles/new">+ New Article</a></p>
  <table class="admin-table">
    <thead><tr><th>Title</th><th>Status</th><th>Category</th><th>Updated</th><th></th></tr></thead>
    <tbody>
      ${sorted
        .map(
          (a) => `<tr>
        <td>${a.title}</td>
        <td><span class="badge badge-${a.status}">${a.status}</span></td>
        <td>${a.category}</td>
        <td>${(a.updatedAt || '').slice(0, 10)}</td>
        <td>
          <a href="/admin/articles/${a.id}/edit">Edit</a>
          <form method="post" action="/admin/articles/${a.id}/delete" style="display:inline" onsubmit="return confirm('Delete this article?')">
            <button type="submit" class="link-btn">Delete</button>
          </form>
        </td>
      </tr>`
        )
        .join('')}
    </tbody>
  </table>`;
}

function articleFormBody(article, categories, authors) {
  const a = article || {
    id: '',
    title: '',
    slug: '',
    dek: '',
    category: categories[0]?.slug || '',
    tags: [],
    author: authors[0]?.slug || '',
    status: 'draft',
    articleType: 'article',
    featuredImage: '',
    featuredImageAlt: '',
    body: [],
  };
  return `<h1>${article ? 'Edit' : 'New'} Article</h1>
  <form method="post" action="/admin/articles/save" class="admin-form">
    <input type="hidden" name="id" value="${a.id}">
    <label>Title<input type="text" name="title" value="${escapeHtml(a.title)}" required></label>
    <label>Slug (leave blank to auto-generate from title)<input type="text" name="slug" value="${escapeHtml(a.slug)}"></label>
    <label>Dek / subheading<input type="text" name="dek" value="${escapeHtml(a.dek)}"></label>
    <label>Category
      <select name="category">
        ${categories.map((c) => `<option value="${c.slug}" ${c.slug === a.category ? 'selected' : ''}>${c.name}</option>`).join('')}
      </select>
    </label>
    <label>Author
      <select name="author">
        ${authors.map((au) => `<option value="${au.slug}" ${au.slug === a.author ? 'selected' : ''}>${au.name}</option>`).join('')}
      </select>
    </label>
    <label>Tags (comma-separated)<input type="text" name="tags" value="${escapeHtml((a.tags || []).join(', '))}"></label>
    <label>Article type
      <select name="articleType">
        ${['article', 'explainer', 'guide', 'comparison', 'analysis'].map((t) => `<option value="${t}" ${t === a.articleType ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
    </label>
    <label>Status
      <select name="status">
        <option value="draft" ${a.status === 'draft' ? 'selected' : ''}>Draft</option>
        <option value="published" ${a.status === 'published' ? 'selected' : ''}>Published</option>
      </select>
    </label>
    <label>Featured image path (e.g. /images/articles/my-image.jpg — must be 1200px+ wide)<input type="text" name="featuredImage" value="${escapeHtml(a.featuredImage)}"></label>
    <label>Featured image alt text<input type="text" name="featuredImageAlt" value="${escapeHtml(a.featuredImageAlt)}"></label>
    <label>Body (separate paragraphs with a blank line)
      <textarea name="body" rows="16">${escapeHtml((a.body || []).join('\n\n'))}</textarea>
    </label>
    <button type="submit" class="btn">Save</button>
  </form>`;
}

function topicsBody(topics) {
  const sorted = [...topics].sort((a, b) => b.priorityScore - a.priorityScore);
  return `<h1>Topic Ideas</h1>
  <p>Populated by the topic discovery script (<code>npm run discover</code>) plus anything added manually. Nothing here publishes automatically — review and turn an idea into a draft via "New Article."</p>
  <table class="admin-table">
    <thead><tr><th>Topic</th><th>Category</th><th>Priority</th><th>Type</th><th>Status</th><th></th></tr></thead>
    <tbody>
      ${sorted
        .map(
          (t) => `<tr>
        <td><strong>${t.suggestedTitle}</strong><br><small>${t.topic}</small></td>
        <td>${t.category}</td>
        <td>${t.priorityScore}</td>
        <td>${t.evergreenOrTrending}</td>
        <td>${t.status}</td>
        <td>
          <form method="post" action="/admin/topics/${t.id}/status" style="display:inline">
            <select name="status" onchange="this.form.submit()">
              ${['idea', 'in-progress', 'published', 'rejected'].map((s) => `<option value="${s}" ${s === t.status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </form>
        </td>
      </tr>`
        )
        .join('')}
    </tbody>
  </table>`;
}

function analyticsBody(stats) {
  const sourceRows = Object.entries(stats.bySource)
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => `<tr><td>${source}</td><td>${count}</td></tr>`)
    .join('');
  const articleRows = stats.topArticles.map((a) => `<tr><td>${a.slug}</td><td>${a.views}</td></tr>`).join('');
  return `<h1>Analytics</h1>
  <p>Total logged pageviews: <strong>${stats.totalPageviews}</strong></p>
  <p><small>This is first-party pageview logging built into the server (see <code>lib/analytics.js</code>). It's enough to see what's working early on; connect Google Search Console and GA4 once there's real traffic for deeper query- and revenue-level data.</small></p>
  <div class="two-col">
    <div>
      <h2>Top Articles</h2>
      <table class="admin-table"><thead><tr><th>Slug</th><th>Views</th></tr></thead><tbody>${articleRows || '<tr><td colspan=2>No data yet.</td></tr>'}</tbody></table>
    </div>
    <div>
      <h2>Traffic Sources</h2>
      <table class="admin-table"><thead><tr><th>Source</th><th>Views</th></tr></thead><tbody>${sourceRows || '<tr><td colspan=2>No data yet.</td></tr>'}</tbody></table>
    </div>
  </div>`;
}

function settingsBody(settings) {
  return `<h1>Settings</h1>
  <form method="post" action="/admin/settings/save" class="admin-form">
    <label>Site name<input type="text" name="siteName" value="${escapeHtml(settings.siteName)}"></label>
    <label>Tagline<input type="text" name="tagline" value="${escapeHtml(settings.tagline)}"></label>
    <label>Description<input type="text" name="description" value="${escapeHtml(settings.description)}"></label>
    <label>Domain (with https://, no trailing slash)<input type="text" name="domain" value="${escapeHtml(settings.domain)}"></label>
    <label>Twitter/X handle<input type="text" name="twitterHandle" value="${escapeHtml(settings.twitterHandle)}"></label>
    <label>AdSense Publisher/Client ID (e.g. ca-pub-XXXXXXXXXX)<input type="text" name="adsenseClientId" value="${escapeHtml(settings.adsenseClientId)}"></label>
    <label><input type="checkbox" name="adsensePublisherEnabled" ${settings.adsensePublisherEnabled ? 'checked' : ''}> AdSense enabled (only turn on after account approval)</label>
    <label>Newsletter provider (e.g. ConvertKit, Buttondown)<input type="text" name="newsletterProvider" value="${escapeHtml(settings.newsletterProvider)}"></label>
    <label>Newsletter API endpoint<input type="text" name="newsletterEndpoint" value="${escapeHtml(settings.newsletterEndpoint)}"></label>
    <button type="submit" class="btn">Save</button>
  </form>`;
}

function escapeHtml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
