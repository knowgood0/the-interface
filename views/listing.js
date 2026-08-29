import { layout } from './layout.js';
import { articleCard, adSlot } from './components.js';
import { metaTags, breadcrumbJsonLd } from '../lib/seo.js';

export function listingPage({ settings, title, description, path, articles, categories, categoryMeta, intro }) {
  const catMap = Object.fromEntries(categories.map((c) => [c.slug, c]));
  const head = `${metaTags({ settings, title, description, path })}
    ${breadcrumbJsonLd([
      { name: 'Home', url: settings.domain },
      { name: title, url: `${settings.domain}${path}` },
    ])}`;

  const content = `
  <div class="wrap listing-page">
    <header class="listing-header" ${categoryMeta ? `style="--cat-color:${categoryMeta.color}"` : ''}>
      <h1>${title}</h1>
      ${intro ? `<p class="listing-intro">${intro}</p>` : ''}
    </header>

    ${adSlot('listing-top')}

    <div class="card-grid">
      ${articles.length ? articles.map((a) => articleCard(a, catMap[a.category])).join('') : '<p>No articles here yet.</p>'}
    </div>
  </div>`;

  return layout({ settings, head, content, categories, bodyClass: 'page-listing' });
}
