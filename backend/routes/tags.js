const express = require('express');
const Tag = require('../models/tag');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const tags = await Tag.findAll({ where: { userId: req.user.id }, order: [['name', 'ASC']] });
  res.json(tags);
});

router.post('/', async (req, res) => {
  const { name, color } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name é obrigatório' });
  }

  const existing = await Tag.findOne({ where: { userId: req.user.id, name } });
  if (existing) {
    return res.status(409).json({ error: 'Já existe uma tag com esse nome' });
  }

  const tag = await Tag.create({ userId: req.user.id, name, color });
  res.status(201).json(tag);
});

router.delete('/:id', async (req, res) => {
  const tag = await Tag.findOne({ where: { id: req.params.id, userId: req.user.id } });

  if (!tag) {
    return res.status(404).json({ error: 'Tag não encontrada' });
  }

  await tag.destroy();
  res.sendStatus(204);
});

module.exports = router;
