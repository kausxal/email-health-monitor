module.exports = {
  apps: [{
    name: 'email-health-monitor',
    script: 'index.js',
    cwd: __dirname + '/server',
    watch: false,
    max_memory_restart: '200M',
    env: {
      NODE_ENV: 'production',
    },
    error_file: __dirname + '/logs/error.log',
    out_file: __dirname + '/logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_restarts: 10,
    restart_delay: 5000,
  }]
}
