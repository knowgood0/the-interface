import { organizationJsonLd } from '../lib/seo.js';

export function layout({ settings, head, bodyClass = '', content, categories = [] }) {
  const newsletter = settings.newsletterEndpoint
    ? `<form class="newsletter-form" action="${settings.newsletterEndpoint}" method="post">
        <label for="nl-email">Get the weekly roundup</label>
        <input id="nl-email" type="email" name="email" placeholder="you@email.com" required>
        <button type="submit">Subscribe</button>
      </form>`
    : `<div class="newsletter-form">
        <label>Stay current</label>
        <p style="font-size:0.82rem;color:#8a8f98;margin:0;"><a href="/rss.xml">Follow the RSS feed</a> for new articles.</p>
      </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
    ${head}
  <link rel="stylesheet" href="/css/style.css">
  <link rel="alternate" type="application/rss+xml" title="${settings.siteName} RSS" href="/rss.xml">
  ${organizationJsonLd(settings)}
</head>
<body class="${bodyClass}">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="wrap header-inner">
      <a href="/" class="brand">${settings.siteName}</a>
      <nav class="main-nav" aria-label="Primary">
        ${categories.map((c) => `<a href="/category/${c.slug}">${c.name}</a>`).join('')}
      </nav>
      <form class="search-form" action="/search" method="get" role="search">
        <input type="search" name="q" placeholder="Search" aria-label="Search articles">
      </form>
    </div>
  </header>
  <main id="main">${content}</main>
  <footer class="site-footer">
    <div class="wrap footer-inner">
      <div class="footer-brand">
        <strong>${settings.siteName}</strong>
        <p>${settings.tagline}</p>
      </div>
      <nav class="footer-nav" aria-label="Footer">
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
        <a href="/editorial-policy">Editorial Policy</a>
        <a href="/corrections">Corrections</a>
        <a href="/advertising-disclosure">Advertising Disclosure</a>
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms</a>
        <a href="/rss.xml">RSS</a>
      </nav>
      ${newsletter}
      <p class="copyright">&copy; ${new Date().getFullYear()} ${settings.siteName}. All rights reserved.</p>
    </div>
  </footer>
  <script src="/js/main.js" defer></script>
</body>
</html>`;
}
