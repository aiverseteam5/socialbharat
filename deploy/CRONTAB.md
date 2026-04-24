# VPS Crontab — Scheduled Jobs

Vercel Cron is gone. Scheduled endpoints are now driven by the VPS's
`crontab`, which hits each API route over localhost with the
`CRON_SECRET` bearer token. This mirrors what `vercel.json` used to do
and will be superseded by BullMQ repeatable jobs in V3 Phase 3B.

## Install

1. SSH into the VPS as the deploy user.
2. Read `CRON_SECRET` from `/var/www/socialbharat/.env`.
3. Run `crontab -e` and paste the entries below, substituting the real
   secret for `REPLACE_ME`.

```cron
# m  h  dom mon dow  command

# Publish queued posts — every minute
*  *  *   *   *    curl -fsS -H "Authorization: Bearer REPLACE_ME" http://127.0.0.1:3000/api/cron/publish > /var/log/pm2/cron-publish.log 2>&1

# Crawl mentions — every 15 minutes
*/15 *  *   *   *    curl -fsS -H "Authorization: Bearer REPLACE_ME" http://127.0.0.1:3000/api/cron/crawl-mentions > /var/log/pm2/cron-mentions.log 2>&1

# Collect metrics — daily at 02:00 IST
0  2  *   *   *    curl -fsS -H "Authorization: Bearer REPLACE_ME" http://127.0.0.1:3000/api/cron/collect-metrics > /var/log/pm2/cron-metrics.log 2>&1
```

## Verify

```bash
crontab -l                    # list installed entries
sudo grep CRON /var/log/syslog | tail -20   # confirm firing
tail -f /var/log/pm2/cron-publish.log       # watch output
```

## Security

- Endpoints require the `Authorization: Bearer ${CRON_SECRET}` header;
  unauthenticated calls are rejected with `401`.
- Curl hits `127.0.0.1:3000` — nginx never sees these requests, so no
  public TLS cert or rate-limit overhead is involved.
- Do **not** expose `CRON_SECRET` in any file committed to the repo.
