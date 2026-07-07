const express = require('express');

const AuthSession = require('../models/AuthSession');
const OtpChallenge = require('../models/OtpChallenge');
const { User, USER_ROLES } = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { createOtp, createSessionToken, hashValue } = require('../utils/security');
const { writeAuditLog } = require('../utils/audit');

const router = express.Router();

function normalizeIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

router.post('/request-otp', async (req, res, next) => {
  try {
    const role = String(req.body.role || '').trim().toLowerCase();
    const identifier = normalizeIdentifier(req.body.identifier);
    const displayName = String(req.body.displayName || '').trim();

    if (!USER_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Use victim, support, police, or admin.' });
    }
    if (!identifier) {
      return res.status(400).json({ message: 'Identifier is required' });
    }
    if (!displayName) {
      return res.status(400).json({ message: 'Display name is required' });
    }

    const user = await User.findOneAndUpdate(
      { role, identifier },
      { $set: { displayName } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const otp = createOtp();
    const challenge = await OtpChallenge.create({
      userId: user._id,
      otpHash: hashValue(otp),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await writeAuditLog({
      req,
      action: 'auth.request_otp',
      statusCode: 200,
      metadata: { role, identifier },
    });

    const response = {
      message: 'OTP generated. Verify within 5 minutes.',
      challengeId: challenge._id,
      expiresAt: challenge.expiresAt,
    };

    if (process.env.NODE_ENV !== 'production') {
      response.devOtp = otp;
    }

    return res.json(response);
  } catch (error) {
    return next(error);
  }
});

router.post('/verify-otp', async (req, res, next) => {
  try {
    const challengeId = String(req.body.challengeId || '').trim();
    const otp = String(req.body.otp || '').trim();
    if (!challengeId || !otp) {
      return res.status(400).json({ message: 'challengeId and otp are required' });
    }

    const challenge = await OtpChallenge.findById(challengeId);
    if (!challenge || challenge.consumedAt || new Date(challenge.expiresAt).getTime() <= Date.now()) {
      return res.status(400).json({ message: 'OTP challenge is invalid or expired' });
    }

    if (challenge.otpHash !== hashValue(otp)) {
      return res.status(400).json({ message: 'Incorrect OTP' });
    }

    challenge.consumedAt = new Date();
    await challenge.save();

    const user = await User.findById(challenge.userId).lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found for OTP challenge' });
    }

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await AuthSession.create({
      userId: user._id,
      tokenHash: hashValue(token),
      expiresAt,
    });

    const pseudoClientId = `user-${String(user._id)}`;

    await writeAuditLog({
      req,
      action: 'auth.verify_otp',
      statusCode: 200,
      metadata: { role: user.role, userId: String(user._id) },
    });

    return res.json({
      token,
      expiresAt,
      user: {
        id: String(user._id),
        role: user.role,
        identifier: user.identifier,
        displayName: user.displayName,
        clientId: pseudoClientId,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', requireAuth(), async (req, res, next) => {
  try {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
    if (token) {
      await AuthSession.deleteOne({ tokenHash: hashValue(token) });
    }

    await writeAuditLog({
      req,
      action: 'auth.logout',
      statusCode: 200,
      metadata: { userId: req.user.id, role: req.user.role },
    });

    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth(), async (req, res, next) => {
  try {
    await writeAuditLog({
      req,
      action: 'auth.me',
      statusCode: 200,
      metadata: { userId: req.user.id, role: req.user.role },
    });

    return res.json({
      user: {
        id: req.user.id,
        role: req.user.role,
        identifier: req.user.identifier,
        displayName: req.user.displayName,
        clientId: `user-${req.user.id}`,
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
