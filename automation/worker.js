const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GITHUB_API = 'https://api.github.com';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

const DEFAULT_FEEDS = [
  { url: 'https://openai.com/blog/rss.xml', category: 'ai-tools', sourceType: 'rss' },
  { url: 'https://www.anthropic.com/rss.xml', category: 'ai-tools', sourceType: 'rss' },
  { url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', category: 'industry', sourceType: 'rss' },
  { url: 'https://www.theverge.com/rss/index.xml', category: 'industry', sourceType: 'rss' },
];

const CATEGORY_FALLBACKS = ['ai-tools', 'explainers', 'guides', 'industry'];
const MAX_SOURCE_CHARS = 5000;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function cleanText(value = '') {
  return String(value)
    .replace(/<!CDATA\[([\s\S]*?)\]>/gi, '$1')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(xml, tag) {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  );
  return match ? cleanText(match[1]) : '';
}

function parseItems(xml) {
  const rssItems = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  return rssItems.map((item) => ({
    title: extractTag(item, 'title'),
    link: extractTag(item, 'link'),
    pubDate:
      extractTag(item, 'pubDate') ||
      extractTag(item, 'published') ||
      extractTag(item, 'updated'),
    description:
      extractTag(item, 'description') ||
      extractTag(item, 'summary') ||
      extractTag(item, 'content'),
  }));
}

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: {
        'User-Agent': 'TheInterfacePublisher/1.0',
      },
    });

    if (!res.ok) return [];

    const xml = await res.text();

    return parseItems(xml)
      .slice(0, 8)
      .map((item) => ({
        ...item,
        feed,
      }));
  } catch (error) {
    console.log(
      `Feed failed: ${feed.url}`,
      error.message
    );

    return [];
  }
}

function normalizeTitle(title) {
  return cleanText(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `article-${Date.now()}`;
}

function escapeJsonString(value) {
  return String(value || '').trim();
}

async function groqGenerate(env, prompt) {
  const response = await fetch(GROQ_URL, {
    method: 'POST',

    headers: {
      authorization: `Bearer ${env.GROQ_API_KEY}`,
      'content-type': 'application/json',
    },

    body: JSON.stringify({
      model:
        env.GROQ_MODEL ||
        'openai/gpt-oss-120b',

      temperature: 0.35,

      /*
       * The previous failure happened because Groq
       * reached the completion limit before closing
       * the JSON object.
       */
      max_completion_tokens: 6000,

      response_format: {
        type: 'json_object',
      },

      messages: [
        {
          role: 'system',

          content:
            'You are the editorial AI for The Interface, a practical AI and technology publication. Write original, useful journalism in plain English. Do not copy source wording. Do not invent facts, quotes, statistics, product capabilities, prices, dates, or claims. Use only the supplied source material and stable general knowledge. If a claim is unsupported, omit it. Return valid JSON only. You MUST finish the entire JSON object, including all closing brackets and braces, before stopping.',
        },

        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      `Groq HTTP ${response.status}: ${raw.slice(0, 500)}`
    );
  }

  const data = JSON.parse(raw);

  const content =
    data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(
      'Groq returned no message content'
    );
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Groq returned invalid JSON: ${content.slice(0, 1000)}`
    );
  }
}

async function getRepoFile(env, path) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const branch =
    env.GITHUB_BRANCH || 'main';

  const url =
    `${GITHUB_API}/repos/` +
    `${encodeURIComponent(owner)}/` +
    `${encodeURIComponent(repo)}/contents/${path}` +
    `?ref=${encodeURIComponent(branch)}`;

  const res = await fetch(url, {
    headers: githubHeaders(env),
  });

  if (!res.ok) {
    throw new Error(
      `GitHub read ${path} failed: ${res.status} ${await res.text()}`
    );
  }

  const data = await res.json();

  const text = base64Decode(
    data.content.replace(/\s/g, '')
  );

  return {
    text,
    sha: data.sha,
  };
}

function githubHeaders(env) {
  return {
    authorization:
      `Bearer ${env.GITHUB_TOKEN}`,

    accept:
      'application/vnd.github+json',

    'x-github-api-version':
      '2022-11-28',

    'user-agent':
      'TheInterfacePublisher/1.0',
  };
}

function base64Decode(value) {
  const binary = atob(value);

  const bytes =
    Uint8Array.from(
      binary,
      (c) => c.charCodeAt(0)
    );

  return new TextDecoder().decode(bytes);
}

function base64EncodeBytes(bytes) {
  let binary = '';

  const chunk = 0x8000;

  for (
    let i = 0;
    i < bytes.length;
    i += chunk
  ) {
    binary += String.fromCharCode(
      ...bytes.subarray(
        i,
        i + chunk
      )
    );
  }

  return btoa(binary);
}

function base64EncodeText(text) {
  return base64EncodeBytes(
    new TextEncoder().encode(text)
  );
}

async function githubJson(
  path,
  init,
  env
) {
  const res = await fetch(
    `${GITHUB_API}${path}`,
    {
      ...init,

      headers: {
        ...githubHeaders(env),
        ...(init?.headers || {}),
      },
    }
  );

  const text = await res.text();

  if (!res.ok) {
    throw new Error(
      `GitHub API ${res.status}: ${text.slice(0, 1000)}`
    );
  }

  return text
    ? JSON.parse(text)
    : null;
}

async function getBranchState(env) {
  const owner =
    env.GITHUB_OWNER;

  const repo =
    env.GITHUB_REPO;

  const branch =
    env.GITHUB_BRANCH || 'main';

  const ref =
    await githubJson(
      `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
      {
        method: 'GET',
      },
      env
    );

  const commit =
    await githubJson(
      `/repos/${owner}/${repo}/git/commits/${ref.object.sha}`,
      {
        method: 'GET',
      },
      env
    );

  return {
    refSha: ref.object.sha,
    commitSha: commit.sha,
    treeSha: commit.tree.sha,
  };
}

async function createBlob(
  env,
  bytes
) {
  return githubJson(
    `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/blobs`,
    {
      method: 'POST',

      headers: {
        'content-type':
          'application/json',
      },

      body: JSON.stringify({
        content:
          base64EncodeBytes(bytes),

        encoding: 'base64',
      }),
    },
    env
  );
}

async function commitFiles(
  env,
  files,
  message
) {
  const owner =
    env.GITHUB_OWNER;

  const repo =
    env.GITHUB_REPO;

  const branch =
    env.GITHUB_BRANCH || 'main';

  const state =
    await getBranchState(env);

  const treeEntries = [];

  for (const file of files) {
    let blobSha;

    if (file.kind === 'text') {
      const blob =
        await githubJson(
          `/repos/${owner}/${repo}/git/blobs`,
          {
            method: 'POST',

            headers: {
              'content-type':
                'application/json',
            },

            body: JSON.stringify({
              content:
                base64EncodeText(
                  file.content
                ),

              encoding: 'base64',
            }),
          },
          env
        );

      blobSha = blob.sha;
    } else {
      const blob =
        await createBlob(
          env,
          file.bytes
        );

      blobSha = blob.sha;
    }

    treeEntries.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blobSha,
    });
  }

  const tree =
    await githubJson(
      `/repos/${owner}/${repo}/git/trees`,
      {
        method: 'POST',

        headers: {
          'content-type':
            'application/json',
        },

        body: JSON.stringify({
          base_tree:
            state.treeSha,

          tree:
            treeEntries,
        }),
      },
      env
    );

  const commit =
    await githubJson(
      `/repos/${owner}/${repo}/git/commits`,
      {
        method: 'POST',

        headers: {
          'content-type':
            'application/json',
        },

        body: JSON.stringify({
          message,
          tree: tree.sha,
          parents: [
            state.commitSha,
          ],
        }),
      },
      env
    );

  const refPath =
    `/repos/${owner}/${repo}/git/refs/heads/` +
    encodeURIComponent(branch);

  await githubJson(
    refPath,
    {
      method: 'PATCH',

      headers: {
        'content-type':
          'application/json',
      },

      body: JSON.stringify({
        sha: commit.sha,
        force: false,
      }),
    },
    env
  );

  return commit;
}

async function searchCommons(
  query
) {
  const url =
    new URL(COMMONS_API);

  url.searchParams.set(
    'action',
    'query'
  );

  url.searchParams.set(
    'generator',
    'search'
  );

  url.searchParams.set(
    'gsrsearch',
    query
  );

  url.searchParams.set(
    'gsrnamespace',
    '6'
  );

  url.searchParams.set(
    'gsrlimit',
    '12'
  );

  url.searchParams.set(
    'prop',
