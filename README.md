# Riverside Sales Dashboard

TV-first hockey-scoreboard-style team dashboard for Riverside Energy Systems.

## V1.2 scoreboard rules
The main $300,000 monthly target is measured using:
- Residential V2.0
- First Nations

The pipeline scoreboard separately displays:
- Residential V2.0
- First Nations
- Service Pipeline
- Consulting

`TOTAL COMPANY WON` includes all four pipelines.

Top `WON DEALS` and `AVG DEAL` use only Residential V2.0 + First Nations, so they remain consistent with the $300,000 target.

## Planned Pipedrive integration
A Cloudflare server-side function will retrieve Won deals and aggregate them by pipeline and won date. The browser will receive only scoreboard totals. The Pipedrive API token must be stored as a Cloudflare secret and never committed to GitHub.

Current numbers are demo data.
