# worker-cleanup/

Separate Cloudflare Worker with a cron trigger (daily at 03:00 UTC).

**Purpose:** purge R2 objects and photo rows for reports that were never reviewed and are older than 90 days. Keeps the report row/pin — only images are deleted.

**Deploy:** `wrangler deploy` from this directory. Shares the same D1 database and R2 bucket as the main Pages app.

**Local test:**
```bash
wrangler dev --test-scheduled
# In another terminal:
curl "http://localhost:8787/__scheduled?cron=0+3+*+*+*"
```
