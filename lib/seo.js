// Central place for anything that touches structured data, meta tags,
// sitemap.xml, or rss.xml — keeping this in one file means the SEO surface
// area is auditable in one read rather than scattered across templates.

export function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function metaTags({ settings, title, description, path, image, imageAlt, type = 'website', publishedTime, modifiedTime, author }) {
  const url = `${settings.domain}${path}`;
  const fullTitle = title ? `${title} | ${settings.siteName}` : settings.siteName;
  const desc = description || settings.description;
  const img = image ? `${settings.domain}${image}` : `${settings.domain}/images/og-default.svg`;

  const tags = [
    `<title>${escapeXml(fullTitle)}</title>`,
    `<meta name="description" content="${escapeXml(desc)}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta name="robots" content="index, follow, max-image-preview:large">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:site_name" content="${escapeXml(settings.siteName)}">`,
    `<meta property="og:title" content="${escapeXml(fullTitle)}">`,
    `<meta property="og:description" content="${escapeXml(desc)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:image:width" content="1600">`,
    `<meta property="og:image:height" content="900">`,
    imageAlt ? `<meta property="og:image:alt" content="${escapeXml(imageAlt)}">` : '',
    `<meta name="twitter:card" content="summary_large_image">`,
    settings.twitterHandle ? `<meta name="twitter:site" content="${escapeXml(settings.twitterHandle)}">` : '',
    `<meta name="twitter:title" content="${escapeXml(fullTitle)}">`,
    `<meta name="twitter:description" content="${escapeXml(desc)}">`,
    `<meta name="twitter:image" content="${img}">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    publishedTime ? `<meta property="article:published_time" content="${publishedTime}">` : '',
    modifiedTime ? `<meta property="article:modified_time" content="${modifiedTime}">` : '',
    author ? `<meta name="author" content="${escapeXml(author)}">` : '',
  ];
  return tags.filter(Boolean).join('\n    ');
}

export function articleJsonLd({ settings, article, author, url, imageUrl }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.dek,
    image: [imageUrl],
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    author: {
      '@type': 'Person',
      name: author?.name || settings.siteName,
      url: author ? `${settings.domain}/author/${author.slug}` : undefined,
    },
    publisher: {
      '@type': 'Organization',
      name: settings.siteName,
      logo: {
        '@type': 'ImageObject',
        url: `${settings.domain}/images/logo.svg`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

export function breadcrumbJsonLd(crumbs) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

export function organizationJsonLd(settings) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: settings.siteName,
    url: settings.domain,
    logo: `${settings.domain}/images/logo.svg`,
    sameAs: settings.twitterHandle ? [`https://x.com/${settings.twitterHandle.replace('@', '')}`] : [],
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

export function buildSitemap({ settings, articles, categories }) {
  const urls = [
    { loc: settings.domain + '/', priority: '1.0' },
    { loc: settings.domain + '/about', priority: '0.3' },
    { loc: settings.domain + '/contact', priority: '0.3' },
    ...categories.map((c) => ({ loc: `${settings.domain}/category/${c.slug}`, priority: '0.6' })),
    ...articles.map((a) => ({
      loc: `${settings.domain}/article/${a.slug}`,
      lastmod: (a.updatedAt || a.publishedAt || '').slice(0, 10),
      priority: '0.8',
    })),
  ];
  const body = urls
    .map(
      (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <priority>${u.priority}</priority>
  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
}

export function buildRss({ settings, articles }) {
  const items = articles
    .slice(0, 30)
    .map(
      (a) => `  <item>
    <title>${escapeXml(a.title)}</title>
    <link>${settings.domain}/article/${a.slug}</link>
    <guid>${settings.domain}/article/${a.slug}</guid>
    <pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>
    <description>${escapeXml(a.dek || '')}</description>
  </item>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${escapeXml(settings.siteName)}</title>
  <link>${settings.domain}</link>
  <description>${escapeXml(settings.description)}</description>
${items}
</channel>
</rss>`;
}

export function buildRobotsTxt(settings) {
  return `User-agent: *
Allow: /
Disallow: /admin

Sitemap: ${settings.domain}/sitemap.xml
`;
}
