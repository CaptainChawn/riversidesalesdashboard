# Riverside Sales Dashboard

A TV-first, hockey-scoreboard-style sales dashboard for Riverside Energy Systems.

## Current V1

This first version uses demo data so the visual design can be tested on the office TV before connecting Pipedrive.

Dashboard definitions planned for live data:
- Pipeline: `Residential V2.0`
- Deal status: `Won`
- Monthly target: `$300,000 CAD`
- Metrics: monthly won sales, won deals, average deal, pace to target, salesperson leaderboard, YTD residential won sales

## Files

- `index.html` — dashboard structure
- `styles.css` — TV/scoreboard visual design
- `app.js` — demo data and dashboard calculations

## Preview locally

Double-click `index.html` and it will open in your browser. Press F11 for fullscreen.

## Cloudflare Pages

Upload these files to the root of the GitHub repository. Then connect the repository to Cloudflare Pages.

Suggested settings for this static version:
- Production branch: `main`
- Build command: `exit 0`
- Build output directory: `.`

## Security

Never add the Pipedrive API token to `app.js`, GitHub, or any browser-visible file. The live integration will use a server-side Cloudflare secret.
