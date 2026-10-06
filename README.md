# Riverside Sales Dashboard - Cloudflare Worker

This package is built for Cloudflare Workers + Static Assets.

## Repository structure
- `public/` contains the TV dashboard.
- `src/index.js` provides `/api/dashboard`.
- `wrangler.jsonc` tells Cloudflare to serve `public/` as static assets and route `/api/*` through the Worker.

## Deploy
Upload the contents of this package to the root of the GitHub repository. The existing Cloudflare deploy command `npx wrangler deploy` can remain.

## Secret
In Cloudflare, add the secret `PIPEDRIVE_API_TOKEN` to the deployed Worker/environment. Do not commit the token to GitHub.

## Test
After deployment, visit `/api/dashboard`. A successful response is JSON containing `pipelines`, `target`, `company`, and `updatedAt`.

The dashboard refreshes the API every five minutes.
