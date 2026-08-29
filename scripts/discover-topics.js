// Run with: npm run discover
//
// Pulls recent items from a configurable list of RSS feeds, scores them
// heuristically, and writes new entries into data/topics.json for human
// review in the admin panel at /admin/topics. Nothing here publishes
// anything automatically — it only ever proposes ideas.
//
// Uses only Node's built-in fetch (Node 18+); no XML parsing library
// dependency — RSS is simple enough to pull apart with regex for the
// handful of fields we need (title, link, pubDate, description).

import { db } from '../lib/db.js';
import crypto from 'node:crypto';

// Edit this list to match your beat. Public, legitimate RSS feeds only —
// see README "Topic Discovery" section for how to extend this with
// Google Trends / Reddit / YouTube sources, which need API keys.
const FEEDS = [
  { url: 'https://openai.com/blog/rss.xml', category: 'ai-tools', sourceType: 'rss' },
  { url: 'https://www.anthropic.com/rss.xml', category: 'ai-tools', sourceType: 'rss' },
  { url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', category: 'industry', sourceType: 'rss' },
  { url: 'https://www.theverge.com/rss/index.xml', category: 'industry', sourceType: 'rss' },
];

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!match) return '';
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function parseItems(xml) {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  return items.map((item) => ({
    title: extractTag(item, 'title'),
    link: extractTag(item, 'link'),
    pubDate: extractTag(item, 'pubDate'),
    description: extractTag(item, 'description'),
  }));
}

function scoreItem(item) {
  // Cheap recency + specificity heuristic. Replace with real search-volume
  // data (Google Trends API, Search Console) once available — this is a
  // starting point, not a real ranking model.
  let score = 50;
  const ageHours = item.pubDate ? (Date.now() - new Date(item.pubDate)) / 36e5 : 999;
  if (ageHours < 24) score += 25;
  else if (ageHours < 72) score += 10;
  if (item.title.length > 30 && item.title.length < 90) score += 10;
  return Math.min(99, score);
}

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, { headers: { 'User-Agent': 'TheInterfaceTopicBot/0.1' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseItems(xml).slice(0, 8).map((item) => ({ ...item, feed }));
  } catch (err) {
    console.error(`Failed to fetch ${feed.url}: ${err.message}`);
    return [];
  }
}

async function main() {
  const existing = await db.topics.all();
  const existingLinks = new Set(existing.map((t) => t.sources?.[0]?.url).filter(Boolean));

  const results = await Promise.all(FEEDS.map(fetchFeed));
  const allItems = results.flat();

  let added = 0;
  for (const item of allItems) {
    if (!item.title || !item.link) continue;
    if (existingLinks.has(item.link)) continue;

    const topic = {
      id: crypto.randomUUID(),
      topic: item.title,
      category: item.feed.category,
      whyTrending: `Recently published by ${new URL(item.feed.url).hostname}`,
      searchOpportunity: 'unknown — verify manually',
      competition: 'unknown — verify manually',
      suggestedTitle: item.title,
      suggestedType: 'analysis',
      relatedKeywords: [],
      sourceType: item.feed.sourceType,
      sources: [{ name: new URL(item.feed.url).hostname, url: item.link }],
      evergreenOrTrending: 'trending',
      priorityScore: scoreItem(item),
      status: 'idea',
      discoveredAt: new Date().toISOString(),
    };
    await db.topics.save(topic);
    added++;
  }

  console.log(`Topic discovery complete. ${added} new idea(s) added to /admin/topics.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
