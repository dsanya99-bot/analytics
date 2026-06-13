// PM2 конфигурация для прод-запуска на VPS.
//   pm2 start ecosystem.config.js
//   pm2 logs analytics-reports
module.exports = {
  apps: [{
    name: 'analytics-reports',
    script: 'src/server.js',
    // SQLite (better-sqlite3): один процесс на запись. Для пары пользователей — fork, instances:1.
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '256M',
    env: {
      NODE_ENV: 'production',
      PORT: 4100,
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    kill_timeout: 8000,
    restart_delay: 3000,
    max_restarts: 10,
    min_uptime: '10s',
  }],
};
