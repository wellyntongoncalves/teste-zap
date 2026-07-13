const express = require('express');
const { Op } = require('sequelize');
const Goal = require('../models/goal');
const Transaction = require('../models/transaction');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';

  const goals = await Goal.findAll({
    where: {
      userId: req.user.id,
      ...(includeArchived ? {} : { status: { [Op.ne]: 'archived' } })
    },
    order: [['createdAt', 'ASC']]
  });

  res.json(goals);
});

router.post('/', async (req, res) => {
  const { name, targetAmount, targetDate, linkedAccountId } = req.body;

  if (!name || !targetAmount) {
    return res.status(400).json({ error: 'name e targetAmount são obrigatórios' });
  }

  const goal = await Goal.create({
    userId: req.user.id,
    name,
    targetAmount,
    targetDate,
    linkedAccountId
  });

  res.status(201).json(goal);
});

router.patch('/:id', async (req, res) => {
  const goal = await Goal.findOne({ where: { id: req.params.id, userId: req.user.id } });

  if (!goal) {
    return res.status(404).json({ error: 'Meta não encontrada' });
  }

  const { name, targetAmount, targetDate, linkedAccountId, status } = req.body;
  await goal.update({
    ...(name !== undefined ? { name } : {}),
    ...(targetAmount !== undefined ? { targetAmount } : {}),
    ...(targetDate !== undefined ? { targetDate } : {}),
    ...(linkedAccountId !== undefined ? { linkedAccountId } : {}),
    ...(status !== undefined ? { status } : {})
  });

  res.json(goal);
});

router.delete('/:id', async (req, res) => {
  const goal = await Goal.findOne({ where: { id: req.params.id, userId: req.user.id } });

  if (!goal) {
    return res.status(404).json({ error: 'Meta não encontrada' });
  }

  await goal.update({ status: 'archived' });
  res.sendStatus(204);
});

router.post('/:id/contributions', async (req, res) => {
  const goal = await Goal.findOne({ where: { id: req.params.id, userId: req.user.id } });

  if (!goal) {
    return res.status(404).json({ error: 'Meta não encontrada' });
  }

  const { amount, fromAccountId } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'amount deve ser maior que zero' });
  }

  const newAmount = parseFloat(goal.currentAmount) + parseFloat(amount);
  const status = newAmount >= parseFloat(goal.targetAmount) ? 'completed' : goal.status;

  await goal.update({ currentAmount: newAmount, status });

  if (fromAccountId && goal.linkedAccountId) {
    await Transaction.create({
      userId: req.user.id,
      accountId: fromAccountId,
      destinationAccountId: goal.linkedAccountId,
      type: 'transfer',
      amount,
      category: 'Outros',
      description: `Contribuição para meta "${goal.name}"`,
      source: 'dashboard'
    });
  }

  res.json(goal);
});

module.exports = router;
