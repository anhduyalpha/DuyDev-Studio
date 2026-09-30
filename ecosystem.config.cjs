/**
 * PM2 Ecosystem Configuration for DuyDev Studio (DS)
 * Usage: pm2 start ecosystem.config.cjs
 */

module.exports = {
  apps: [
    {
      name: 'dd-studio',
      script: './dist/app.js',
      cwd: './server',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0'
      },
      error_file: '../logs/error.log',
      out_file: '../logs/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
