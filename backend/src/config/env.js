const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const backendRoot = path.resolve(__dirname, '..', '..');
const projectRoot = path.resolve(backendRoot, '..');

const envFiles = [
  path.join(projectRoot, '.env'),
  path.join(backendRoot, '.env'),
];

for (const envPath of envFiles) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function validateProductionConfig() {
  if (isProduction() && !String(process.env.SECURITY_SECRET || '').trim()) {
    throw new Error('SECURITY_SECRET must be set in production');
  }
}

module.exports = {
  backendRoot,
  projectRoot,
  isProduction,
  validateProductionConfig,
};
