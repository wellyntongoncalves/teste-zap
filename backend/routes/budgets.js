const express = require('express');
const { Op, fn, col } = require('sequelize');
const Budget = require('../models/budget');
const Transaction = require('../models/transaction');
const Tag = require('../models/tag');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const budgets = await Budget.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'ASC']] });
  res.json(budgets);
});

router.post('/', async (req, res) => {
  const { category, tagId, amount, recurring, month, year } = req.body;

  if (!amount) {
    return res.status(400).json({ error: 'amount é obrigatório' });
  }

  if ((category == null) === (tagId == null)) {
    return res.status(400).json({ error: 'Informe exatamente um entre category e tagId' });
  }

  try {
    const budget = await Budget.create({
      userId: req.user.id,
      category,
      tagId,
      amount,
      recurring: recurring !== false,
      month,
      year
    });

    res.status(201).json(budget);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const budget = await Budget.findOne({ where: { id: req.params.id, userId: req.user.id } });

  if (!budget) {
    return res.status(404).json({ error: 'Orçamento não encontrado' });
  }

  await budget.destroy();
  res.sendStatus(204);
});

router.get('/status', async (req, res) => {
  const now = new Date();
  const month = req.query.month ? parseInt(req.query.month, 10) : now.getMonth() + 1;
  const year = req.query.year ? parseInt(req.query.year, 10) : now.getFullYear();

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const budgets = await Budget.findAll({
    where: {
      userId: req.user.id,
      [Op.or]: [{ recurring: true }, { recurring: false, month, year }]
    },
    include: [{ model: Tag, attributes: ['id', 'name', 'color'] }]
  });

  const status = await Promise.all(
    budgets.map(async (budget) => {
      let spent = 0;

      if (budget.category) {
        const rows = await Transaction.findAll({
          attributes: [[fn('SUM', col('amount')), 'total']],
          where: {
            userId: req.user.id,
            type: 'expense',
            category: budget.category,
            occurredAt: { [Op.gte]: start, [Op.lt]: end }
          },
          raw: true
        });
        spent = parseFloat(rows[0]?.total) || 0;
      } else if (budget.tagId) {
        const transactions = await Transaction.findAll({
          where: {
            userId: req.user.id,
            type: 'expense',
            occurredAt: { [Op.gte]: start, [Op.lt]: end }
          },
          include: [{ model: Tag, where: { id: budget.tagId }, attributes: [] }]
        });
        spent = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
      }

      return {
        id: budget.id,
        category: budget.category,
        tag: budget.Tag || null,
        amount: parseFloat(budget.amount),
        spent,
        remaining: parseFloat(budget.amount) - spent
      };
    })
  );

  res.json(status);
});

module.exports = router;
