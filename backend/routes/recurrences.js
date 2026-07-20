const express = require('express');
const Recurrence = require('../models/recurrence');
const Transaction = require('../models/transaction');
const Account = require('../models/account');
const authMiddleware = require('../middleware/auth');
const { materializeRecurrences, nextDueDate, todayIso } = require('../services/recurrences');

const router = express.Router();
router.use(authMiddleware);

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// A regra sozinha não diz muito; o que interessa na tela é quando ela cobra de
// novo. `nextDue` é calculado, não guardado — assim nunca fica desatualizado.
function present(rule) {
  return {
    id: rule.id,
    accountId: rule.accountId,
    account: rule.account ? { id: rule.account.id, name: rule.account.name } : null,
    type: rule.type,
    amount: parseFloat(rule.amount),
    category: rule.category,
    description: rule.description,
    dayOfMonth: rule.dayOfMonth,
    startDate: rule.startDate,
    endDate: rule.endDate,
    active: rule.active,
    lastRunOn: rule.lastRunOn,
    nextDue: rule.active ? nextDueDate(rule) : null
  };
}

router.get('/', async (req, res) => {
  // Materializa antes de listar pra tela nunca mostrar uma cobrança "pendente"
  // que na verdade já virou lançamento.
  await materializeRecurrences(req.user);

  const rules = await Recurrence.findAll({
    where: { userId: req.user.id },
    include: [{ model: Account, as: 'account', attributes: ['id', 'name'] }],
    order: [['active', 'DESC'], ['dayOfMonth', 'ASC']]
  });

  res.json(rules.map(present));
});

router.post('/', async (req, res) => {
  const { accountId, type, amount, category, description, dayOfMonth, startDate, endDate } = req.body;

  if (!accountId || !amount || !description) {
    return res.status(400).json({ error: 'accountId, amount e description são obrigatórios' });
  }

  const day = parseInt(dayOfMonth, 10);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return res.status(400).json({ error: 'dayOfMonth deve ser um dia entre 1 e 31' });
  }

  const start = DATE_ONLY.test(String(startDate || '')) ? startDate : todayIso();
  if (endDate && (!DATE_ONLY.test(String(endDate)) || endDate < start)) {
    return res.status(400).json({ error: 'endDate deve ser uma data igual ou posterior a startDate' });
  }

  const account = await Account.findOne({ where: { id: accountId, userId: req.user.id } });
  if (!account) {
    return res.status(404).json({ error: 'Conta não encontrada' });
  }

  const rule = await Recurrence.create({
    userId: req.user.id,
    accountId,
    type: type === 'income' ? 'income' : 'expense',
    amount,
    category: Transaction.CATEGORIES.includes(category) ? category : 'Outros',
    description,
    dayOfMonth: day,
    startDate: start,
    endDate: endDate || null
  });

  // Uma conta fixa criada com início retroativo já nasce devendo lançamentos;
  // gerar na hora evita a sensação de "criei e não aconteceu nada".
  await materializeRecurrences(req.user);
  await rule.reload({ include: [{ model: Account, as: 'account', attributes: ['id', 'name'] }] });

  res.status(201).json(present(rule));
});

router.patch('/:id', async (req, res) => {
  const rule = await Recurrence.findOne({ where: { id: req.params.id, userId: req.user.id } });

  if (!rule) {
    return res.status(404).json({ error: 'Conta fixa não encontrada' });
  }

  const { amount, category, description, dayOfMonth, endDate, active } = req.body;

  if (dayOfMonth !== undefined) {
    const day = parseInt(dayOfMonth, 10);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      return res.status(400).json({ error: 'dayOfMonth deve ser um dia entre 1 e 31' });
    }
  }

  await rule.update({
    ...(amount !== undefined ? { amount } : {}),
    ...(category !== undefined
      ? { category: Transaction.CATEGORIES.includes(category) ? category : 'Outros' }
      : {}),
    ...(description !== undefined ? { description } : {}),
    ...(dayOfMonth !== undefined ? { dayOfMonth: parseInt(dayOfMonth, 10) } : {}),
    ...(endDate !== undefined ? { endDate: endDate || null } : {}),
    ...(active !== undefined ? { active: Boolean(active) } : {})
  });

  await rule.reload({ include: [{ model: Account, as: 'account', attributes: ['id', 'name'] }] });
  res.json(present(rule));
});

// Apagar a regra NÃO apaga os lançamentos que ela já gerou: eles aconteceram de
// verdade e sumir com eles reescreveria o histórico do usuário.
router.delete('/:id', async (req, res) => {
  const rule = await Recurrence.findOne({ where: { id: req.params.id, userId: req.user.id } });

  if (!rule) {
    return res.status(404).json({ error: 'Conta fixa não encontrada' });
  }

  await rule.destroy();
  res.json({ removed: 1 });
});

module.exports = router;
