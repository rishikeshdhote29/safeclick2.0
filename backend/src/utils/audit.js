const AuditLog = require('../models/AuditLog');

function writeAuditLog({ req, action, statusCode, metadata = {} }) {
  return AuditLog.create({
    userId: req.user ? req.user.id : null,
    role: req.user ? req.user.role : 'anonymous',
    action,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    metadata,
  });
}

module.exports = {
  writeAuditLog,
};
