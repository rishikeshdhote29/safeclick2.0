const path = require('path');

const backendRoot = path.resolve(__dirname, '..', '..');

function uploadsRoot() {
  return path.join(backendRoot, process.env.UPLOAD_DIR || 'uploads');
}

module.exports = {
  backendRoot,
  uploadsRoot,
};

