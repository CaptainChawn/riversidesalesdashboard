# Riverside Arena: personalized goal celebrations

## Deploy
Upload the **contents** of this package to the root of the existing GitHub repository and commit to `main`. Cloudflare Workers will deploy normally. Keep the existing Cloudflare runtime secret `PIPEDRIVE_API_TOKEN` in place.

## New behavior
- GOoooooAL! / Deal owner / $ amount / pipeline, shown for ~20 seconds.
- Lee McKinnon's Won deals use the included Boston recording (owner name resolved from Pipedrive).
- All other deals retain their existing pipeline horn.
- Service Pipeline wins worth $0 do not celebrate, even if owned by Lee.
- TEST HORN simulates Lee's celebration, without changing Pipedrive.
- All existing won-deal de-duplication and 60-second refresh behavior is retained.

## Performance safeguard
The historical Pipedrive activity scan remains **temporarily disabled**, as in the emergency hotfix, to avoid recurrence of Cloudflare 1102. TOP SHOOTERS will display unavailable until we implement bounded/cached activity reporting. This package does **not** restore the expensive scan.

## Validation
1. Open `/api/dashboard` and confirm `recentWins` entries now contain `ownerId` and `ownerName`.
2. If Lee's ownerName is blank or unexpected, the system falls back to the pipeline horn. The deal-owner ID field may require adjustment to match your Pipedrive response.
3. Click ENABLE HORNS and TEST HORN on the office TV.
4. Verify an actual new Won deal after deployment. Existing Won deals will not replay on reload.
