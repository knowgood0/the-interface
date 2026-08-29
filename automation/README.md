# The Interface — Automated Publishing

This folder contains the Cloudflare Worker that can generate and publish articles automatically.

## What it does

On its schedule, the Worker:

1. Reads the current article/topic data from the GitHub repository.
2. Pulls fresh RSS items from the configured technology feeds.
3. Selects a topic that has not already been covered.
4. Sends the topic and source material to Groq for a structured article draft.
5. Searches Wikimedia Commons for a commercially reusable image matching the article.
6. Downloads the image and records its attribution/license.
7. Adds the article to `data/articles.json` as published.
8. Commits the article and image to GitHub in one commit.
9. The connected Cloudflare Pages project rebuilds from that commit.

The Worker does **not** contain an API key. Store `GROQ_API_KEY` and `GITHUB_TOKEN` as Cloudflare Worker secrets.

## Secrets

- `GROQ_API_KEY` — Groq API key.
- `GITHUB_TOKEN` — GitHub token with permission to read/write repository contents.

## Variables

- `GITHUB_OWNER` — GitHub account/org name.
- `GITHUB_REPO` — repository name.
- `GITHUB_BRANCH` — branch to update (default `main`).
- `DAILY_ARTICLE_LIMIT` — maximum automated articles published per UTC day (default `4`).

## Manual test

After deployment, send an authenticated request to `/run` with the `RUN_SECRET` header if you configure one. The default scheduled trigger is four times per day, but the Worker also exposes `/health` for a simple status check.

For safety, the Worker refuses to publish more than the daily limit, refuses duplicate slugs/titles, and will not publish if it cannot obtain a suitable reusable image.
