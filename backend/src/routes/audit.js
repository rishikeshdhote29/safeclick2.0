const express = require('express');

const AuditLog = require('../models/AuditLog');
const { requireAuth } = require('../middleware/auth');
const { ROLES, requireRole } = require('../middleware/access');

const router = express.Router();

router.use(requireAuth());
router.use(requireRole([ROLES.ADMIN]));

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 100), 500);
    const logs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json(logs);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
