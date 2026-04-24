# GitHub Secrets — VPS Deployment

Add these in **GitHub → Settings → Secrets and variables → Actions**.

## Secrets (encrypted, required)

| Secret                  | Value                                                         |
| ----------------------- | ------------------------------------------------------------- |
| `VPS_HOST`              | Hostinger VPS IP address or hostname                          |
| `VPS_USER`              | Deploy user on the VPS (e.g. `deploy` or `root`)              |
| `VPS_SSH_KEY`           | Contents of private SSH key (`~/.ssh/id_rsa`) with VPS access |
| `SUPABASE_ACCESS_TOKEN` | Personal access token for `supabase db push --linked`         |

## Repository variables (plain, required)

| Variable                        | Value                       |
| ------------------------------- | --------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key           |

## Application env vars

All **runtime** application env vars (`RAZORPAY_*`, `META_APP_SECRET`,
`ENCRYPTION_KEY`, `CRON_SECRET`, `UPSTASH_REDIS_REST_*`, etc.) live in
`/var/www/socialbharat/.env` **on the VPS itself** — not in GitHub Actions.
The CI build uses `SKIP_ENV_VALIDATION=true` plus a minimal set of public
variables, and the SSH deploy step does not need them.
