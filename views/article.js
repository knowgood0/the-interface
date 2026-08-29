import { layout } from './layout.js';
import { articleCard, adSlot, formatDate, escapeAttr, escapeHtml } from './components.js';
import { metaTags, articleJsonLd, breadcrumbJsonLd } from '../lib/seo.js';

export function articlePage({ settings, article, category, author, related, categories }) {
  const url = `${settings.domain}/article/${article.slug}`;
  const imageUrl = `${settings.domain}${article.featuredImage}`;

  const head = `${metaTags({
    settings,
    title: article.title,
    description: article.dek,
    path: `/article/${article.slug}`,
    image: article.featuredImage,
    imageAlt: article.featuredImageAlt,
    type: 'article',
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    author: author?.name,
  })}
    ${articleJsonLd({ settings, article, author, url, imageUrl })}
    ${breadcrumbJsonLd([
      { name: 'Home', url: settings.domain },
      { name: category?.name || article.category, url: `${settings.domain}/category/${article.category}` },
      { name: article.title, url },
    ])}`;

  const bodyHtml = (article.body || [])
    .map((para, i) => {
      const graf = `<p>${escapeHtml(para)}</p>`;
      // Inject a mid-article ad after the second paragraph, once, without
      // breaking up short articles.
      if (i === 1 && article.body.length > 3) {
        return `${graf}\n${adSlot('article-inline')}`;
      }
      return graf;
    })
    .join('\n');

  const content = `
  <article class="wrap article-wrap">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Home</a> &rsaquo;
      <a href="/category/${article.category}">${category?.name || article.category}</a> &rsaquo;
      <span>${article.title}</span>
    </nav>

    <header class="article-header">
      ${category ? `<a class="card-category" href="/category/${category.slug}" style="--cat-color:${category.color}">${category.name}</a>` : ''}
      <h1>${escapeHtml(article.title)}</h1>
      <p class="dek">${escapeHtml(article.dek || '')}</p>
      <div class="byline">
        ${author ? `<a href="/author/${author.slug}">${author.name}</a>` : ''}
        <time datetime="${article.publishedAt}">${formatDate(article.publishedAt)}</time>
        ${article.updatedAt && article.updatedAt !== article.publishedAt ? `<span class="updated">Updated ${formatDate(article.updatedAt)}</span>` : ''}
      </div>
    </header>

    <img class="article-hero-image" src="${article.featuredImage}" alt="${escapeAttr(article.featuredImageAlt || '')}" width="1600" height="900" loading="eager">
    ${
      article.imageCredit && article.imageSourceUrl
        ? `<p class="image-credit">Image: <a href="${escapeAttr(article.imageSourceUrl)}" rel="nofollow noopener" target="_blank">${escapeHtml(article.imageCredit)}</a></p>`
        : ''
    }

    <div class="article-body">
      ${bodyHtml}
    </div>

    ${
      article.sources && article.sources.length
        ? `<aside class="sources"><h2>Sources</h2><ul>${article.sources.map((s) => `<li><a href="${s.url}">${s.name}</a></li>`).join('')}</ul></aside>`
        : ''
    }

    <div class="share-row" aria-label="Share this article">
      <a href="https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(article.title)}" rel="noopener" target="_blank">Share on X</a>
      <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}" rel="noopener" target="_blank">Share on LinkedIn</a>
    </div>

    ${
      author
        ? `<aside class="author-box">
        <img src="${author.avatar}" alt="" width="64" height="64">
        <div>
          <strong>${author.name}</strong>
          <p>${author.bio}</p>
        </div>
      </aside>`
        : ''
    }
  </article>

  ${adSlot('article-bottom')}

  ${
    related && related.length
      ? `<section class="wrap related-section">
      <h2 class="section-title">Related</h2>
      <div class="card-grid card-grid--3">
        ${related.map((a) => articleCard(a, category)).join('')}
      </div>
    </section>`
      : ''
  }`;

  return layout({ settings, head, content, categories, bodyClass: 'page-article' });
}
