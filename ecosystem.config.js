// PM2 process manifest for Hostinger VPS deployment.
// V3 Phase 3B — socialbharat-workers is enabled: it runs the BullMQ worker
// entrypoint at src/workers/index.ts via `tsx` for publish, metrics,
// token-refresh, and notification queues.
module.exports = {
  apps: [
    {
      name: "socialbharat-web",
      script: ".next/standalone/server.js",
      cwd: "/var/www/socialbharat",
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "127.0.0.1",
      },
      instances: 2,
      exec_mode: "cluster",
      max_memory_restart: "1G",
      error_file: "/var/log/pm2/socialbharat-error.log",
      out_file: "/var/log/pm2/socialbharat-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "socialbharat-workers",
      script: "node_modules/.bin/tsx",
      // --env-file is a Node 20+ flag; loads /var/www/socialbharat/.env into
      // process.env so src/lib/env.ts validation passes at worker boot.
      args: "--env-file=.env src/workers/index.ts",
      cwd: "/var/www/socialbharat",
      env_production: {
        NODE_ENV: "production",
      },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      error_file: "/var/log/pm2/workers-error.log",
      out_file: "/var/log/pm2/workers-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      kill_timeout: 30000,
    },
  ],
};
