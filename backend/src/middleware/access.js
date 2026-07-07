const ROLES = {
  VICTIM: 'victim',
  SUPPORT: 'support',
  POLICE: 'police',
  ADMIN: 'admin',
};

const VALID_ROLES = Object.values(ROLES);

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

function getRole(req) {
  if (req.user && req.user.role) {
    return normalizeRole(req.user.role);
  }

  return normalizeRole(req.headers['x-user-role'] || req.query.role || (req.body && req.body.role));
}

function getClientId(req) {
  return String(req.headers['x-client-id'] || req.query.clientId || (req.body && req.body.clientId) || '').trim();
}

function isComplaintOwner(complaint, clientId) {
  return complaint && clientId && String(complaint.clientId) === clientId;
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    const role = getRole(req);
    if (!role) {
      return res.status(400).json({ message: 'User role is required' });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid user role' });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ message: 'Access denied for this role' });
    }

    req.userRole = role;
    return next();
  };
}

module.exports = {
  ROLES,
  getClientId,
  isComplaintOwner,
  requireRole,
};
