import { layout } from './layout.js';
import { metaTags } from '../lib/seo.js';

export function staticPage({ settings, title, path, html, categories }) {
  const head = metaTags({ settings, title, description: `${title} — ${settings.siteName}`, path });
  const content = `<div class="wrap static-page">
    <h1>${title}</h1>
    ${html}
  </div>`;
  return layout({ settings, head, content, categories, bodyClass: 'page-static' });
}
