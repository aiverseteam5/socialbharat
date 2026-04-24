#!/bin/bash
# First-time VPS provisioning for SocialBharat on Hostinger.
# Idempotent enough to re-run; skips already-installed packages.
set -e

# Node.js 22 (matches CI / deploy.yml)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm pinned to v9 to match CI's pnpm/action-setup@v3 (version: 9)
# PM2 for process management, tsx for TypeScript worker execution (3B)
sudo npm install -g pnpm@9 pm2 tsx

# Self-hosted Redis (used by BullMQ in 3B; Upstash REST remains for rate-limiting)
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# App + log directories
sudo mkdir -p /var/www/socialbharat
sudo mkdir -p /var/log/pm2
sudo chown -R "$USER:$USER" /var/www/socialbharat /var/log/pm2

# Nginx
sudo apt-get install -y nginx
sudo systemctl enable nginx

# Certbot for Let's Encrypt SSL
sudo apt-get install -y certbot python3-certbot-nginx

cat <<EOF

━━━ Next steps (run manually once DNS points to this VPS) ━━━

  1. Provision SSL:
       sudo certbot --nginx -d socialbharat.tynkai.com

  2. Install nginx site config:
       sudo cp /var/www/socialbharat/deploy/nginx.conf \\
               /etc/nginx/sites-available/socialbharat
       sudo ln -s /etc/nginx/sites-available/socialbharat \\
                  /etc/nginx/sites-enabled/
       sudo nginx -t && sudo systemctl reload nginx

  3. Clone and build the app:
       cd /var/www/socialbharat
       git clone https://github.com/aiverseteam5/socialbharat .
       cp .env.example .env
       # Fill in /var/www/socialbharat/.env with production values
       pnpm install --frozen-lockfile
       pnpm build
       pm2 start ecosystem.config.js --env production
       pm2 save
       pm2 startup  # follow printed sudo instruction

  4. Install scheduled cron entries (replaces Vercel Cron):
       see deploy/CRONTAB.md

EOF
