const RateLimitBucket = require('../models/RateLimitBucket');

async function checkRateLimit(key, { max = 5, windowMs = 15 * 60 * 1000 } = {}) {
  const now = Date.now();
  const existing = await RateLimitBucket.findOne({ key }).lean();

  if (!existing || new Date(existing.resetAt).getTime() <= now) {
    const resetAt = new Date(now + windowMs);
    await RateLimitBucket.findOneAndUpdate(
      { key },
      { $set: { count: 1, resetAt } },
      { upsert: true, setDefaultsOnInsert: true }
    );
    return { allowed: true, retryAfterMs: 0 };
  }

  const updated = await RateLimitBucket.findOneAndUpdate(
    { key, resetAt: { $gt: new Date(now) } },
    { $inc: { count: 1 } },
    { new: true }
  );

  if (!updated) {
    return checkRateLimit(key, { max, windowMs });
  }

  if (updated.count > max) {
    return { allowed: false, retryAfterMs: new Date(updated.resetAt).getTime() - now };
  }

  return { allowed: true, retryAfterMs: 0 };
}

function createRateLimiter({ keyFn, max, windowMs, message }) {
  return async (req, res, next) => {
    try {
      const key = keyFn(req);
      const result = await checkRateLimit(key, { max, windowMs });

      if (!result.allowed) {
        const retryAfterSec = Math.ceil(result.retryAfterMs / 1000);
        res.setHeader('Retry-After', String(retryAfterSec));
        return res.status(429).json({
          message: message || `Too many requests. Try again in ${retryAfterSec} seconds.`,
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  checkRateLimit,
  createRateLimiter,
};
