# Riverside Sales HQ V4

Adds an on-screen GOAL celebration for **new Won deals in Residential V2.0, First Nations and Commercial only**.

## How it works
- The dashboard polls `/api/dashboard` every 60 seconds.
- The Worker returns aggregate totals plus up to 100 recent Won deal IDs and amounts from only the three target pipelines.
- On the first visit, the browser records a baseline and does not celebrate historical deals.
- Subsequently, newly observed Won deal IDs trigger an 8-second full-screen GOAL animation, with an original synthesized arena horn if enabled.
- Seen IDs are saved in browser localStorage to prevent repeats after refresh.
- The TV operator must press **ENABLE GOAL HORNS** once to unlock browser audio. Press **TEST** to try it without changing Pipedrive.
- The Worker never returns customer names or addresses. The API token stays in Cloudflare runtime Secrets.
- This is polling, not a webhook. Typical delay: up to 60 seconds while dashboard remains open.

## Important limits
- If the TV is closed or asleep for more than 15 minutes after a win, it may skip that celebration, but sales totals will still update.
- If browser localStorage is cleared, the next load establishes a new baseline.
- Some built-in smart-TV browsers block audio after inactivity. Test on the actual TV before relying on sound.
- The bundled horn is an original synthesized sound, **not** a Columbus or other NHL team's recording. A properly licensed recording can be integrated later.
- The current `wonTime` recency check interprets Pipedrive's timestamp as local time in the TV browser; keep the TV time zone set to Pacific Time.
- A webhook plus durable event storage would be the robust future upgrade.

## Deploy
Upload all files to the repository root, commit to `main`, wait for Cloudflare build success.
Do not commit the Pipedrive token; keep `PIPEDRIVE_API_TOKEN` in Worker runtime Secrets.

## Columbus goal horn audio
- User-provided `public/columbus-goal-horn.mp3` plays for the full 20-second celebration.
- Click ENABLE GOAL HORNS, then TEST on the TV. Some smart TV browsers do not allow unattended playback even after interaction.
- Make sure you have the necessary rights to host/play the recording on your publicly reachable dashboard. Anyone who knows the public MP3 URL may be able to access it.
