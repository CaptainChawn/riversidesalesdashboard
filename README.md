# Riverside Arena V3: personal horns + previous-month scoreboard

## Installation
Upload the **contents** of this ZIP to the root of your existing GitHub repository, replacing matching files. Commit to `main` and allow Cloudflare Workers to deploy. Keep the existing `PIPEDRIVE_API_TOKEN` runtime secret.

## What's new
- Lee McKinnon: Boston horn, matched by confirmed Pipedrive owner ID `23026407` (and name fallback).
- Steve Moe: Columbus Blue Jackets horn, matched by Pipedrive owner name. Once Steve's owner ID is known, it can be added to `PERSONAL_HORNS_BY_ID` in `public/app.js`.
- Layne Clarke: Vancouver Canucks horn. Other sales reps fall back to their division horn.
- Service and Consulting keep Chesapeake and Edmonton horns.
- Five dedicated TEST buttons: Layne, Lee, Steve, Service, Consulting. TEST uses example data and never changes Pipedrive.
- All five divisions contribute to the $300,000 monthly company target.
- Division standings are sorted by current-month points on every refresh (more frequently than the requested twice daily).
- Previous calendar month's score, qualifying goals and target percentage shown in a compact summary. Last-month API fetch is cached in Cloudflare's per-location cache for 12 hours, with an error fallback.
- $0 Service deals do not trigger a celebration and are excluded from the GOALS count.
- Existing audio files and horn rules preserved; milestone audio not included.
- Static JS/CSS cache-busting query version applied.

## Known limitation
TOP SHOOTERS remains temporarily disabled because the previous historical activity scan triggered Cloudflare 1102 resource errors. This build deliberately does not restore the unbounded activity scan. It needs a separate bounded/weekly persistent snapshot implementation.

## Validation
1. Open `/api/dashboard` and verify `lastMonth` has sales and goals and that `recentWins` has owner names.
2. Open the dashboard and click ENABLE HORNS, then each of the five TEST buttons.
3. Confirm Lee's Boston horn and Steve's Columbus horn and the personalized GOAL screen.
4. Confirm division rankings and that the TEAM SCORE equals ALL DIVISIONS.
5. Existing wins will not replay because of the stored seen-win IDs. Use test buttons to verify horns.
6. If Cloudflare Error 1102 returns, inspect Worker logs for CPU/subrequest limits.

## Layne horn fix (Nov 3)
Pipedrive returns ownerId `23013559` and ownerName `Layne`. Match by ID to Vancouver Canucks horn; add `layne` name fallback. Refresh TV browser after deploy. Old wins do not replay automatically.
