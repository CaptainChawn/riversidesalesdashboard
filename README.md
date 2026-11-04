# Riverside Arena V3.3 | TOP SHOOTERS date-filtered scan

## Changes
- Fetches Pipedrive **done=true** activities with **updated_since** set to the day before the reporting week, instead of scanning all historic activities. This uses officially supported Pipedrive v2 parameters.
- Checks the **In-Person Meeting** type and **actual marked-as-done completion date** in America/Vancouver, not due date.
- Includes all activity owners, including Design and Engineering.
- Paginates at most 16 pages (8,000 records). Reports PARTIAL if the limit is hit, or if matching activities have no completion timestamp.
- Persists weekly snapshots in the existing Cloudflare KV binding `ARENA_STATS`.
- Fixes stale `companyDeals` DOM reference so dashboard does not crash.
- Preserves horns, FREEBIES, last month, and divisions.
- Includes existing KV namespace ID and Sunday 12:00 UTC scheduled trigger.

## Deployment
1. Upload all extracted files to the ROOT of `CaptainChawn/riversidesalesdashboard` on GitHub and commit to main. Do not upload the containing folder itself.
2. Keep Cloudflare runtime secrets `PIPEDRIVE_API_TOKEN` and `ARENA_ADMIN_KEY` and KV binding `ARENA_STATS`.
3. Wait for Cloudflare deployment, hard-refresh the Arena page (Ctrl+Shift+R).
4. Existing KV snapshot remains until refreshed. To update immediately, open the Arena site, F12 > Console, and run:

```js
(async()=>{
 const key=prompt('Enter ARENA_ADMIN_KEY');if(!key)return;
 const r=await fetch('/api/admin/refresh-shooters',{method:'POST',headers:{'X-Arena-Admin-Key':key}});
 const result=await r.json();console.log('TOP SHOOTERS:',result);
})();
```

5. Check `status`, `complete`, `examined`, `teamShots`, `leaders`. **READY** means the bounded updated-since query was fully paginated. Compare the counts to Pipedrive Insights.
6. If PARTIAL persists, report `examined`, `pages`, `missingCompletionTime` and `status`. Do not increase limits blindly.

## Notes
- Pipedrive v2 GET activities does not accept `type`; filtering is performed after the date-limited request.
- Updates made *after* the weekly snapshot require manual refresh to be reflected. Weekly cron runs Sunday at 12:00 UTC (5 AM PST / 4 AM PDT).
- A weekly snapshot captures data visible at the time it runs, not future retroactive changes.
- No live Pipedrive credentials are included.
