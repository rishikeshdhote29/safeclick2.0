const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envFiles = [
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, '..', '..', '.env'),
];

envFiles.forEach((envPath) => {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
});

const app = require('./app');
const connectDatabase = require('./config/db');

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDatabase();
  const server = app.listen(PORT, () => {
    console.log(`SuRakshaFile backend running on port ${PORT}`);
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
