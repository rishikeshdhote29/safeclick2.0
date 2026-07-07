const { validateProductionConfig } = require('./config/env');
validateProductionConfig();

const app = require('./app');
const connectDatabase = require('./config/db');
const { startRetentionJob } = require('./utils/retention');
const { isSmtpConfigured } = require('./utils/mail');

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDatabase();
  startRetentionJob(Number(process.env.RETENTION_JOB_INTERVAL_MS || 60 * 60 * 1000));
  const server = app.listen(PORT, () => {
    console.log(`SuRakshaFile backend running on port ${PORT}`);
    console.log(`Email OTP: ${isSmtpConfigured() ? 'enabled' : 'disabled (set GMAIL_USER + APP_PASSWORD in backend/.env)'}`);
  });
  return server;
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Failed to start backend:', error);
    process.exit(1);
  });
}

module.exports = { start };
