import { layout } from './layout.js';
import { metaTags } from '../lib/seo.js';

// The Node server version does search server-side. The static build has no
// server to query, so this page ships a small vanilla-JS search that fetches
// /search-index.json (generated at build time) and filters client-side.
// Fine at hundreds of articles; if the catalog grows into the thousands,
// swap this for a hosted search service (Algolia, Pagefind) instead.
export function searchPage({ settings, categories }) {
  const head = metaTags({ settings, title: 'Search', description: `Search ${settings.siteName}`, path: '/search' });

  const content = `
  <div class="wrap listing-page">
    <header class="listing-header">
      <h1>Search</h1>
      <p class="listing-intro" id="search-status">Type to search articles.</p>
    </header>
    <div class="card-grid" id="search-results"></div>
  </div>
  <script>
    (function () {
      var params = new URLSearchParams(location.search);
      var input = document.createElement('input');
      input.type = 'search';
      input.placeholder = 'Search articles';
      input.setAttribute('aria-label', 'Search articles');
      input.value = params.get('q') || '';
      input.style.cssText = 'font-size:1rem;padding:10px 14px;border:1px solid #e6e8eb;border-radius:8px;width:100%;max-width:400px;margin-bottom:8px;';
      document.getElementById('search-status').before(input);

      var statusEl = document.getElementById('search-status');
      var resultsEl = document.getElementById('search-results');
      var indexPromise = fetch('/search-index.json').then(function (r) { return r.json(); });

      function render(query) {
        indexPromise.then(function (items) {
          var q = query.trim().toLowerCase();
          if (!q) {
            statusEl.textContent = 'Type to search articles.';
            resultsEl.innerHTML = '';
            return;
          }
          var results = items.filter(function (a) {
            return (
              a.title.toLowerCase().indexOf(q) !== -1 ||
              (a.dek || '').toLowerCase().indexOf(q) !== -1 ||
              (a.tags || []).some(function (t) { return t.toLowerCase().indexOf(q) !== -1; })
            );
          });
          statusEl.textContent = results.length + ' result' + (results.length === 1 ? '' : 's') + ' for "' + query + '"';
          resultsEl.innerHTML = results
            .map(function (a) {
              return '<article class="card"><div class="card-body">' +
                '<a class="card-category" href="/category/' + a.category + '">' + a.category + '</a>' +
                '<h3 class="card-title"><a href="/article/' + a.slug + '">' + a.title + '</a></h3>' +
                '<p class="card-dek">' + (a.dek || '') + '</p>' +
                '</div></article>';
            })
            .join('');
        });
      }

      input.addEventListener('input', function () { render(input.value); });
      if (input.value) render(input.value);
    })();
  </script>`;

  return layout({ settings, head, content, categories, bodyClass: 'page-search' });
}
