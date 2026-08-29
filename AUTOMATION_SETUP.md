# The Interface — Hand-Holding Setup Guide

This is the setup for the new automated publishing version.

You only need two services for the automation:

- GitHub — stores the project and receives each new article/image commit.
- Cloudflare — hosts the public site and runs the scheduled publisher Worker.

Groq supplies the article-writing AI. Wikimedia Commons supplies reusable article images.

## Part 1 — Put the project on GitHub

1. Go to GitHub and create a **new repository**.
2. Give it a simple name such as `the-interface`.
3. If GitHub asks whether to add a README, `.gitignore`, or license, leave those boxes **unchecked**. This ZIP already contains those files.
4. Create the repository.
5. Upload the **contents of this ZIP**, not the ZIP file itself.
6. Make sure `package.json`, `server.js`, `data/`, `public/`, `views/`, `scripts/`, and `automation/` are visible at the top level of the repository.

If GitHub's web uploader will not accept the whole folder structure cleanly on your phone, use GitHub Desktop on a computer or Git from Termux. Do not create another nested `the-interface/the-interface/` folder.

## Part 2 — Create your Groq API key

1. Open the Groq Console.
2. Create/sign into your account.
3. Open the API Keys area.
4. Create a new API key.
5. Copy it somewhere temporarily.

**Do not put this key in GitHub and do not put it into this ZIP.** We will add it to Cloudflare as a secret.

The Worker uses the normal Groq chat-completions API with `openai/gpt-oss-120b`. Groq currently lists 1,000 requests/day and 200,000 tokens/day on the Free plan for this model, which is comfortably above a four-articles-per-day target. Limits and model availability can change, so the Groq account limits page is the final authority. Groq's API is OpenAI-compatible, but this project calls the endpoint directly so no npm package is required.

## Part 3 — Create a GitHub token for the publisher

The Cloudflare Worker needs permission to commit generated articles and images to the repository.

1. In GitHub, open **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Create a new token.
3. Give it a recognizable name such as `the-interface-publisher`.
4. Set the resource owner to your GitHub account.
5. Under repository access, choose **Only select repositories** and select your `the-interface` repository.
6. Under repository permissions, give the token:
   - **Contents: Read and write**
7. Create the token.
8. Copy the token somewhere temporarily.

Do not put this token in GitHub. It will also become a Cloudflare Worker secret.

## Part 4 — Connect GitHub to Cloudflare Pages

The public website should be the static `dist` build generated from the repository.

1. Sign in to Cloudflare.
2. Open **Workers & Pages**.
3. Create a Pages project using the GitHub repository.
4. Choose your `the-interface` repository.
5. Set the production branch to `main`.
6. For the build command, use:

   `npm run build`

7. Set the output directory to:

   `dist`

8. Save/deploy the project.

The first deployment should produce the existing site.

### Important

The current `data/settings.json` still contains `https://example.com` as the domain placeholder. Before treating the site as live, change that value to your real domain and commit the change. The domain is used for canonical URLs, sitemap URLs, RSS, and Open Graph metadata.

## Part 5 — Create the Cloudflare publisher Worker

The Worker is the file:

`automation/worker.js`

and its configuration is:

`automation/wrangler.toml`

The simplest reliable deployment method is Wrangler.

On a computer or in Termux:

```bash
cd automation
npx wrangler@latest login
npx wrangler@latest deploy
```

Follow the Cloudflare login prompt. When deployment finishes, Cloudflare will show the Worker URL.

If you prefer the Cloudflare dashboard, create a Worker under **Workers & Pages**, paste/upload the contents of `automation/worker.js`, and then configure the Cron Trigger and variables/secrets described below.

## Part 6 — Add Worker variables

In the Worker settings, add these variables:

`GITHUB_OWNER`

Value: your GitHub username or organization name.

`GITHUB_REPO`

Value: the exact repository name, for example `the-interface`.

`GITHUB_BRANCH`

Value: `main`.

`DAILY_ARTICLE_LIMIT`

Value: `4`.

You can lower this to `1` while testing.

## Part 7 — Add Worker secrets

In the Worker settings, add these as **Secrets**, not ordinary variables:

`GROQ_API_KEY`

Value: the Groq API key you created in Part 2.

`GITHUB_TOKEN`

Value: the fine-grained GitHub token you created in Part 3.

Optional:

`RUN_SECRET`

Value: create any long random password you want. This protects the manual `/run` endpoint. The scheduled trigger does not need it.

## Part 8 — Cron schedule

The included `automation/wrangler.toml` schedules the Worker four times per UTC day:

- 03:00 UTC
- 09:00 UTC
- 15:00 UTC
- 21:00 UTC

The Worker itself also checks the number of articles published that UTC day and refuses to exceed `DAILY_ARTICLE_LIMIT`.

For the first test, you can set `DAILY_ARTICLE_LIMIT` to `1`.

## Part 9 — Test before letting it run automatically

After the Worker is deployed, open its `/health` URL in a browser. You should see JSON similar to:

```json
{
  "ok": true,
  "service": "the-interface-publisher"
}
```

Then manually trigger one article.

If you configured `RUN_SECRET`, send a POST request to:

`https://YOUR-WORKER-URL/run`

with this header:

`x-run-secret: YOUR_RUN_SECRET`

If you do not have a convenient way to send a POST request from your phone, temporarily rely on the next scheduled run instead. **Do not remove the secret just to make testing easier.**

## Part 10 — What should happen when a run succeeds

The Worker should:

1. Read the current articles from GitHub.
2. Pull current items from the configured RSS feeds.
3. Select a topic that is not already published.
4. Ask Groq to write the article.
5. Ask Groq to provide a useful image-search query.
6. Search Wikimedia Commons.
7. Accept only a suitable reusable-license image.
8. Download the image.
9. Add the article to `data/articles.json`.
10. Add the image under `public/images/articles/`.
11. Commit all of those changes to GitHub in one commit.
12. Cloudflare Pages detects the GitHub commit and rebuilds `dist`.
13. The new article appears on the live site.

## Part 11 — If it does not publish

Check these in order:

### Error: missing GROQ_API_KEY

The Worker secret was not added correctly.

### Error: missing GITHUB_TOKEN

The Worker secret was not added correctly, or the token does not have Contents read/write permission for the repository.

### GitHub 401/403

Regenerate the fine-grained GitHub token and make sure the correct repository is selected and **Contents → Read and write** is enabled.

### No reusable Wikimedia image found

The topic did not produce a suitable Commons image. The Worker will refuse to publish rather than use an image with unclear licensing. A later version can add another image provider as a fallback.

### The GitHub commit appears but the website did not change

Open the Cloudflare Pages deployment history. The new commit should have triggered a build. If the build failed, open its log and check the first error.

### The article was generated but the Cloudflare site still shows the old site

Wait for the Pages deployment to finish, then hard-refresh the site. If you are using a custom domain, also allow a little time for the deployment/cache to settle.

## Part 12 — Before public launch

Do these manually before we start publishing several articles per day:

1. Replace `example.com` in `data/settings.json` with the real domain.
2. Replace the placeholder author name/bio in `data/authors.json` with the real author information you want displayed.
3. Fill the `[FILL IN]` legal/contact fields in `data/static-content.js`.
4. Replace the six demo article images if you want the original seed articles to look production-ready.
5. Decide what name/bio should appear on automatically generated articles. The Worker currently uses `founding-editor`.

## What is intentionally NOT in this version

- No automatic affiliate-product insertion yet.
- No utility/tool pages yet.
- No AI-generated images.
- No Groq web-search/Compound calls on every article. The current version uses the existing RSS feeds for fresh source material and Wikimedia Commons for licensed images, which keeps the first version simpler and reduces API cost.

Those can be added later without throwing away this architecture.
