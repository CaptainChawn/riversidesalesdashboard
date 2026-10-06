# Riverside Sales Dashboard Worker v2

This version reduces Pipedrive API traffic by:
- using Pipedrive API v2
- requesting only Won deals
- requesting only deals updated since the start of the current month
- using a 500-deal page size
- filtering the returned set by won_time for the current month

Keep PIPEDRIVE_API_TOKEN as a Cloudflare runtime Secret. Do not put it in this repository.
