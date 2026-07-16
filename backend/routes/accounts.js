const express = require('express');
const Account = require('../models/account');
const authMiddleware = require('../middleware/auth');
const { computeBalance, computeBalances } = require('../services/balance');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';

  const accounts = await Account.findAll({
    where: {
      userId: req.user.id,
      ...(includeArchived ? {} : { archivedAt: null })
    },
    order: [['createdAt', 'ASC']]
  });

  res.json(await computeBalances(accounts));
});

router.post('/', async (req, res) => {
  const { name, type, initialBalance } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name é obrigatório' });
  }

  const account = await Account.create({
    userId: req.user.id,
    name,
    type,
    initialBalance: initialBalance || 0
  });

  res.status(201).json({ ...account.toJSON(), balance: await computeBalance(account) });
});

router.patch('/:id', async (req, res) => {
  const account = await Account.findOne({ where: { id: req.params.id, userId: req.user.id } });

  if (!account) {
    return res.status(404).json({ error: 'Conta não encontrada' });
  }

  const { name, type, initialBalance, archived } = req.body;

  await account.update({
    ...(name !== undefined ? { name } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(initialBalance !== undefined ? { initialBalance } : {}),
    // Sem isto arquivar era porta de mão única: o DELETE marcava archivedAt e
    // nada nunca limpava, então a conta sumia da interface para sempre — com o
    // histórico dela junto.
    ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {})
  });

  res.json({ ...account.toJSON(), balance: await computeBalance(account) });
});

router.delete('/:id', async (req, res) => {
  const account = await Account.findOne({ where: { id: req.params.id, userId: req.user.id } });

  if (!account) {
    return res.status(404).json({ error: 'Conta não encontrada' });
  }

  await account.update({ archivedAt: new Date() });
  res.sendStatus(204);
});

module.exports = router;
