const AuthSession = require('../models/AuthSession');
const { User } = require('../models/User');
const { hashValue } = require('../utils/security');

function parseBearerToken(req) {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return '';
  }
  return authHeader.slice(7).trim();
}

function requireAuth() {
  return async (req, res, next) => {
    try {
      const token = parseBearerToken(req);
      if (!token) {
        return res.status(401).json({ message: 'Authentication token is required' });
      }

      const tokenHash = hashValue(token);
      const session = await AuthSession.findOne({ tokenHash }).lean();
      if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
        return res.status(401).json({ message: 'Session is invalid or expired' });
      }

      const user = await User.findById(session.userId).lean();
      if (!user) {
        return res.status(401).json({ message: 'Session user was not found' });
      }

      req.user = {
        id: String(user._id),
        role: user.role,
        identifier: user.identifier,
        displayName: user.displayName,
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  requireAuth,
};
