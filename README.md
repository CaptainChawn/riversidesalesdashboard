# Riverside Arena V3.2: Weekly TOP SHOOTERS + FREEBIES

## IMPORTANT: One-time Cloudflare KV setup is required

This release **cannot be deployed as-is** until you replace the KV namespace ID placeholder in `wrangler.jsonc`. The placeholder is deliberate: a KV namespace must be created in your own Cloudflare account.

1. In Cloudflare dashboard, open **Workers & Pages > KV** (or **Storage & databases > KV**), create a namespace named `riverside-arena-stats`.
2. Copy the namespace ID. In `wrangler.jsonc`, replace `REPLACE_WITH_YOUR_KV_NAMESPACE_ID` with that exact ID.
3. In the Worker settings, add a **runtime secret** named `ARENA_ADMIN_KEY` containing a long random value (do not put the value in GitHub). Keep the existing `PIPEDRIVE_API_TOKEN` runtime secret.
4. Upload the package contents to the root of your existing GitHub repo, commit to `main`, and deploy via Cloudflare.
5. Verify `https://riversidesalesdashboard.sean-3aa.workers.dev/api/dashboard` includes `freebies` and `appointments.status`.
6. The scheduled Worker runs **Sundays at 12:00 UTC** (4 a.m. Pacific Standard Time / 5 a.m. Pacific Daylight Time). It calculates the previous Sunday–Saturday's completed In-Person Meetings. Until the first scheduled run, TOP SHOOTERS will display `AWAITING WEEKLY SNAPSHOT`.
7. To populate immediately, run a POST to `/api/admin/refresh-shooters` with request header `X-Arena-Admin-Key: <your secret>`. You can use PowerShell:

   ```powershell
   $headers = @{ 'X-Arena-Admin-Key' = 'YOUR_SECRET' }
   Invoke-RestMethod -Method Post -Uri 'https://riversidesalesdashboard.sean-3aa.workers.dev/api/admin/refresh-shooters' -Headers $headers
   ```

   Don't share or commit your admin key. The refresh endpoint is authenticated; the public dashboard does not expose the key.

## Logic

- **FREEBIES:** number of $0 Won deals in Service Pipeline in the current calendar month; no additional Pipedrive API calls. Never a horn or goal. Resets automatically each month. Previous-month Freebies are also shown in the historical panel.
- **TOP SHOOTERS:** only Pipedrive In-Person Meeting activities with `done=true` and completion date in the previous Sunday–Saturday week, grouped by assigned rep. Weekly calculation is written to KV, then read without activity API requests during regular refreshes.
- **Safety:** activity scan capped at 8 pages of 500; if incomplete, the saved snapshot is labelled `PARTIAL — ACTIVITY PAGE LIMIT`, not misrepresented as a final count. Pipedrive pagination and completion timestamp availability may require follow-up adjustment based on live API data.
- **Other features:** personalized horns (Layne ID `23013559`, Lee ID `23026407`), five test buttons, last-month stats, ranked divisions, and all five divisions counting toward $300K remain unchanged.
- The scheduled snapshot is **not retroactive**: if meetings are marked complete after the snapshot, use the protected manual refresh.

## Operational note

The weekly activity scan may still hit Cloudflare resource limits on very large Pipedrive accounts, even though it no longer runs every minute. If it fails, inspect Worker logs and consider a more efficient Pipedrive query or a paid Worker plan. No inaccurate weekly totals should be shown as final.
