# Riverside Arena V2 · Modern Jumbotron

## Deployment
Extract the ZIP, upload its contents (not the enclosing folder) into the existing GitHub repository, and commit to `main`. Cloudflare Workers Builds deploys with `npx wrangler deploy`. Keep `PIPEDRIVE_API_TOKEN` as a Cloudflare Worker **runtime secret**. Never place the token in GitHub.

## What changed
- Modern white-on-charcoal scoreboard, green accents, no NHL logos, no red text.
- TEAM SCORE and TO WIN, ROAD TO VICTORY, GOALS, PTS / GOAL, DIVISION STANDINGS, TOP SHOOTERS.
- Previous Sunday–Saturday completed In-Person Meeting activities only. The code filters for done=1 and uses marked_as_done_time (with completion timestamp fallbacks), NOT creation or due date. Grouped by assigned activity owner.
- Incomplete activity pagination displays an error instead of presenting a misleading leaderboard.
- Columbus for Residential, First Nations and Commercial; Edmonton for Consulting; Chesapeake for Service with amount > $0 only. Horn files included.

## Validation required before full rollout
Open `/api/dashboard` and inspect `appointments` after deployment. Compare the leaderboard with a Pipedrive Insights report filtered to **Type = In-Person Meeting**, **Status = Done**, **Marked as done time = previous week**, grouped by **Assigned to user**. If the API's completion timestamp isn't returned by your account, the leaderboard will be empty. This cannot be fully validated without live Riverside API access. Verify especially the Pipedrive API field names and pagination, and adjust if your account uses different completion fields. 

## Horns
On the TV, click ENABLE HORNS once after opening the dashboard. TEST HORN plays the Consulting test sequence. No NHL team logos are used.

## Important data semantics
The TEAM SCORE and target only include Residential V2.0, First Nations and Commercial. All five pipelines appear in standings and company totals. Service $0 wins are excluded from celebrations. Dashboard refreshes every 60 seconds.
