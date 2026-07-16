const express = require('express');
const authMiddleware = require('../middleware/auth');
const { buildInsights } = require('../services/insights');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  res.json(await buildInsights(req.user.id));
});

module.exports = router;
