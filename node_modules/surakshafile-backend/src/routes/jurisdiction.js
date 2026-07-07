const express = require('express');
const getJurisdiction = require('../data/jurisdiction');

const router = express.Router();

router.get('/', (req, res) => {
  const { state = '', fraudType = 'Other' } = req.query;
  res.json(getJurisdiction(state, fraudType));
});

module.exports = router;

