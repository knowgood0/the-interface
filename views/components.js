export function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function articleCard(article, category, { featured = false } = {}) {
  return `<article class="card ${featured ? 'card--featured' : ''}">
    <a class="card-image-link" href="/article/${article.slug}">
      <img src="${article.featuredImage}" alt="${escapeAttr(article.featuredImageAlt || '')}" loading="lazy" width="1600" height="900">
    </a>
    <div class="card-body">
      ${category ? `<a class="card-category" href="/category/${category.slug}" style="--cat-color:${category.color}">${category.name}</a>` : ''}
      <h3 class="card-title"><a href="/article/${article.slug}">${article.title}</a></h3>
      <p class="card-dek">${article.dek || ''}</p>
      <p class="card-meta">${formatDate(article.publishedAt)}</p>
    </div>
  </article>`;
}

export function adSlot(id, { format = 'auto' } = {}) {
  // Placeholder slot. Once an AdSense account is approved, this renders the
  // real <ins class="adsbygoogle"> unit; until then it renders nothing
  // visible so the layout never ships with a fake/broken ad box.
  return `<div class="ad-slot" data-ad-slot="${id}" data-ad-format="${format}" aria-hidden="true"></div>`;
}

export function escapeAttr(str = '') {
  return String(str).replace(/"/g, '&quot;');
}

export function escapeHtml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
