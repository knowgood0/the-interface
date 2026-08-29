import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const FILES = {
  articles: 'articles.json',
  categories: 'categories.json',
  authors: 'authors.json',
  topics: 'topics.json',
  settings: 'settings.json',
};

// Simple in-memory write lock per file so concurrent admin edits
// don't clobber each other mid-write.
const locks = new Map();

async function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  let release;
  const next = new Promise((res) => (release = res));
  locks.set(key, prev.then(() => next));
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

async function readJSON(name) {
  const file = path.join(DATA_DIR, FILES[name]);
  const raw = await readFile(file, 'utf-8');
  return JSON.parse(raw);
}

async function writeJSON(name, data) {
  const file = path.join(DATA_DIR, FILES[name]);
  return withLock(name, async () => {
    await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  });
}

export const db = {
  articles: {
    all: () => readJSON('articles'),
    published: async () => {
      const all = await readJSON('articles');
      return all
        .filter((a) => a.status === 'published' && a.publishedAt)
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    },
    bySlug: async (slug) => {
      const all = await readJSON('articles');
      return all.find((a) => a.slug === slug) || null;
    },
    byId: async (id) => {
      const all = await readJSON('articles');
      return all.find((a) => a.id === id) || null;
    },
    byCategory: async (categorySlug) => {
      const published = await db.articles.published();
      return published.filter((a) => a.category === categorySlug);
    },
    byTag: async (tag) => {
      const published = await db.articles.published();
      return published.filter((a) => (a.tags || []).includes(tag));
    },
    related: async (article, limit = 4) => {
      const published = await db.articles.published();
      return published
        .filter((a) => a.id !== article.id && a.category === article.category)
        .slice(0, limit);
    },
    save: async (article) => {
      const all = await readJSON('articles');
      const idx = all.findIndex((a) => a.id === article.id);
      if (idx === -1) {
        all.push(article);
      } else {
        all[idx] = article;
      }
      await writeJSON('articles', all);
      return article;
    },
    remove: async (id) => {
      const all = await readJSON('articles');
      const filtered = all.filter((a) => a.id !== id);
      await writeJSON('articles', filtered);
    },
  },
  categories: {
    all: () => readJSON('categories'),
    bySlug: async (slug) => {
      const all = await readJSON('categories');
      return all.find((c) => c.slug === slug) || null;
    },
  },
  authors: {
    all: () => readJSON('authors'),
    bySlug: async (slug) => {
      const all = await readJSON('authors');
      return all.find((a) => a.slug === slug) || null;
    },
  },
  topics: {
    all: () => readJSON('topics'),
    save: async (topic) => {
      const all = await readJSON('topics');
      const idx = all.findIndex((t) => t.id === topic.id);
      if (idx === -1) all.push(topic);
      else all[idx] = topic;
      await writeJSON('topics', all);
      return topic;
    },
  },
  settings: {
    get: () => readJSON('settings'),
    save: (settings) => writeJSON('settings', settings),
  },
};
