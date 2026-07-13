const express = require('express');
const Account = require('../models/account');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// O saldo nunca é armazenado — é sempre recomputado a partir do saldo inicial +
// transações da conta, pra nunca ficar dessincronizado. Até a Fase 2 (Transaction)
// não existe nada pra somar além do saldo inicial.
async function computeBalance(account) {
  return parseFloat(account.initialBalance);
}

router.get('/', async (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';

  const accounts = await Account.findAll({
    where: {
      userId: req.user.id,
      ...(includeArchived ? {} : { archivedAt: null })
    },
    order: [['createdAt', 'ASC']]
  });

  const withBalance = await Promise.all(
    accounts.map(async (account) => ({
      ...account.toJSON(),
      balance: await computeBalance(account)
    }))
  );

  res.json(withBalance);
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

  const { name, type, initialBalance } = req.body;
  await account.update({
    ...(name !== undefined ? { name } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(initialBalance !== undefined ? { initialBalance } : {})
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
