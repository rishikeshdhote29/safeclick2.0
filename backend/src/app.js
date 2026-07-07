const express = require('express');
const cors = require('cors');

const complaintsRouter = require('./routes/complaints');
const evidenceRouter = require('./routes/evidence');
const jurisdictionRouter = require('./routes/jurisdiction');
const authRouter = require('./routes/auth');
const auditRouter = require('./routes/audit');

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  return next();
});

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'SuRakshaFile API' });
});

app.use('/api/auth', authRouter);
app.use('/api/complaints', complaintsRouter);
app.use('/api/evidence', evidenceRouter);
app.use('/api/jurisdiction', jurisdictionRouter);
app.use('/api/audit', auditRouter);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({
    message: error.message || 'Internal server error',
  });
});

module.exports = app;
