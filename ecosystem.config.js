// PM2 process manifest for Hostinger VPS deployment.
// `socialbharat-workers` is intentionally commented out — it will be
// enabled in V3 Phase 3B when src/workers/index.ts (BullMQ entry) lands.
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
    // {
    //   name: "socialbharat-workers",
    //   script: "src/workers/index.ts",
    //   interpreter: "tsx",
    //   cwd: "/var/www/socialbharat",
    //   env_production: { NODE_ENV: "production" },
    //   instances: 1,
    //   exec_mode: "fork",
    //   max_memory_restart: "512M",
    //   error_file: "/var/log/pm2/workers-error.log",
    //   out_file: "/var/log/pm2/workers-out.log",
    // },
  ],
};
