# Riverside Arena V2

## Included
- Red analog-style LED arena layout and hockey terminology, no dollar signs on the TV.
- Revenue is still computed as CAD points: Residential V2.0, First Nations and Commercial count toward 300,000; Service and Consulting are company-only.
- Goal horns: Columbus for target pipelines; Edmonton for Consulting; Chesapeake for Service if amount > 0.
- Top Shooters: previous complete Sunday-Saturday week, custom activity type `In-Person Meeting`, filtered on `add_time`, grouped by assigned activity owner. Results are marked for verification against Pipedrive Insights.
- TV refreshes every 60 seconds. Existing Cloudflare runtime secret `PIPEDRIVE_API_TOKEN` remains in place. No token is stored in source.

## Rollout and verification
1. Extract ZIP into GitHub repository root; replace files and commit main. Check Cloudflare deployment green.
2. Open `/api/dashboard` and inspect `appointments.status`, `appointments.complete`, `appointments.leaders` and `appointments.teamShots`. If the report is incomplete, the TV will show an explicit warning rather than a misleading leaderboard.
3. Compare to Pipedrive Insights for the SAME previous-week window. Example screenshot supplied by user: Layne 12, Lee McKinnon 4, Steve Moe 1 for October 4-10, 2026. Note that this report's week may be Sunday-Saturday, while this implementation uses Sunday-Saturday to match the supplied screenshot; confirm week settings before rollout.
4. On TV click ENABLE HORNS, then TEST HORN (Consulting audio). Test an actual newly Won deal in each pipeline. $0 Service wins must remain silent.

## Known constraints
- Activity v2 API sorts by add_time descending and pages until previous week is covered (up to 6000 activities). If the volume exceeds the guardrail, the leaderboard displays CHECK DATA VOLUME instead of inaccurate figures.
- This reports activity creation time, not due date or completion time. Pipedrive Insights may use a different start-of-week or timezone setting. Validate before relying on it.
- Browser localStorage remembers wins; no replay of historical deals on first load. The TV must stay awake and allow sound after user activation.
- The goal horn MP3s are supplied by the user. Confirm rights to host recordings publicly on Cloudflare.
- The first deployment should be considered a validation release until appointment counts match Pipedrive Insights.
