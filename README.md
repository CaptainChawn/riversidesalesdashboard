# Riverside Sales Dashboard - Live Pipedrive Version

## What it does
The dashboard reads Won deals from these Pipedrive pipelines:
- Residential V2.0
- First Nations
- Service Pipeline
- Consulting

The $300,000 target, Won Deals, Average Deal, and Pace to Target use Residential V2.0 + First Nations only.

The Pipeline Scoreboard and Total Company Won display all four pipelines.

## Cloudflare setup
1. Upload all files/folders in this package to the root of the GitHub repository.
2. In Cloudflare Pages, open the project.
3. Add an encrypted secret named exactly:
   `PIPEDRIVE_API_TOKEN`
4. Paste the Pipedrive API token as the value. Never commit it to GitHub.
5. Redeploy the project.

The dashboard refreshes automatically every 5 minutes.

## Important
The Pipedrive token stays server-side in the Cloudflare Pages Function. The browser only receives aggregated scoreboard totals.
