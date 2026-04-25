# VPS Crontab — Scheduled Jobs

Vercel Cron is gone. Scheduled endpoints are driven by the VPS's
`crontab`, which hits each API route over localhost with the
`CRON_SECRET` bearer token.

V3 Phase 3B — every cron endpoint now **enqueues** a BullMQ job instead
of running work synchronously. The `socialbharat-workers` PM2 process
picks the jobs up and executes them against the platform APIs.

## Install

1. SSH into the VPS as the deploy user.
2. Read `CRON_SECRET` from `/var/www/socialbharat/.env`.
3. Run `crontab -e` and paste the entries below, substituting the real
   secret for `REPLACE_ME`. Or: `crontab deploy/crontab`.

```cron
# m  h  dom mon dow  command

# Enqueue publish sweep — every minute
*  *  *   *   *    curl -fsS -X POST -H "Authorization: Bearer REPLACE_ME" http://127.0.0.1:3000/api/cron/publish > /var/log/pm2/cron-publish.log 2>&1

# Crawl mentions — every 15 minutes (unchanged)
*/15 *  *   *   *    curl -fsS -H "Authorization: Bearer REPLACE_ME" http://127.0.0.1:3000/api/cron/crawl-mentions > /var/log/pm2/cron-mentions.log 2>&1

# Enqueue metrics sweep — every 6 hours
0  */6  *   *   *    curl -fsS -X POST -H "Authorization: Bearer REPLACE_ME" http://127.0.0.1:3000/api/cron/collect-metrics > /var/log/pm2/cron-metrics.log 2>&1

# Enqueue token refresh sweep — daily at 01:00 IST
0  1  *   *   *    curl -fsS -X POST -H "Authorization: Bearer REPLACE_ME" http://127.0.0.1:3000/api/cron/token-refresh > /var/log/pm2/cron-token-refresh.log 2>&1

# V3 Phase 4A — Agentic AI fan-out
# Weekly content plan — Monday 05:00 IST (23:30 UTC Sunday)
30 23 *   *   0    curl -fsS -X POST -H "Authorization: Bearer REPLACE_ME" http://127.0.0.1:3000/api/cron/agent-weekly > /var/log/pm2/cron-agent-weekly.log 2>&1

# Inbox classification + drafts — daily at 09:00 IST (03:30 UTC)
30 3  *   *   *    curl -fsS -X POST -H "Authorization: Bearer REPLACE_ME" http://127.0.0.1:3000/api/cron/agent-inbox > /var/log/pm2/cron-agent-inbox.log 2>&1
```

IST↔UTC note: IST = UTC+05:30. The weekly job fires Monday 05:00 IST which
in UTC is 23:30 Sunday (`dow = 0`). The inbox job fires 09:00 IST = 03:30 UTC.
If you'd rather reason in IST, `TZ=Asia/Kolkata crontab -e` switches the
whole crontab's timezone — but the rest of this file stays UTC-based to
match the VPS system clock.

Note: cron routes accept both GET and POST; POST is the canonical verb
post-3B and matches Adaptation 4 of the 3B prompt.

## Verify

```bash
crontab -l                                       # list installed entries
sudo grep CRON /var/log/syslog | tail -20        # confirm firing
tail -f /var/log/pm2/cron-publish.log            # watch enqueue output
pm2 logs socialbharat-workers --lines 50         # confirm worker picks it up
```

## Security

- Endpoints require the `Authorization: Bearer ${CRON_SECRET}` header;
  unauthenticated calls are rejected with `401`.
- Curl hits `127.0.0.1:3000` — nginx never sees these requests, so no
  public TLS cert or rate-limit overhead is involved.
- Do **not** expose `CRON_SECRET` in any file committed to the repo.
