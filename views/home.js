import { layout } from './layout.js';
import { articleCard, adSlot } from './components.js';
import { metaTags } from '../lib/seo.js';

export function homePage({ settings, categories, articles }) {
  const [featured, ...rest] = articles;
  const catMap = Object.fromEntries(categories.map((c) => [c.slug, c]));

  const head = metaTags({ settings, title: null, description: settings.description, path: '/' });

  const content = `
  <div class="wrap">
    <section class="hero">
      ${featured ? articleCard(featured, catMap[featured.category], { featured: true }) : '<p>No articles published yet.</p>'}
    </section>

    ${adSlot('home-top')}

    <section class="grid-section">
      <h2 class="section-title">Latest</h2>
      <div class="card-grid">
        ${rest.slice(0, 8).map((a) => articleCard(a, catMap[a.category])).join('')}
      </div>
    </section>

    ${adSlot('home-mid')}

    <section class="category-rows">
      ${categories
        .map((cat) => {
          const inCat = articles.filter((a) => a.category === cat.slug).slice(0, 3);
          if (!inCat.length) return '';
          return `<div class="category-row">
            <h2 class="section-title"><a href="/category/${cat.slug}" style="--cat-color:${cat.color}">${cat.name} &rarr;</a></h2>
            <div class="card-grid card-grid--3">
              ${inCat.map((a) => articleCard(a, cat)).join('')}
            </div>
          </div>`;
        })
        .join('')}
    </section>
  </div>`;

  return layout({ settings, head, content, categories, bodyClass: 'page-home' });
}
