const express = require('express');
const { Op } = require('sequelize');
const Recurrence = require('../models/recurrence');
const RecurrenceDismissal = require('../models/recurrenceDismissal');
const Transaction = require('../models/transaction');
const Account = require('../models/account');
const authMiddleware = require('../middleware/auth');
const { materializeRecurrences, nextDueDate, todayIso } = require('../services/recurrences');
const { detectRecurring, normalize } = require('../services/insights');

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

// --- Sugestões: "isso parece fixo, quer cadastrar?" ---
//
// O detector (services/insights.js) já enxerga padrões no histórico. Aqui esse
// palpite vira uma oferta: o que se repete há 3+ meses e ainda NÃO tem regra
// cadastrada nem foi dispensado antes.

// Mesma chave do agrupamento do detector, pra casar palpite com regra existente.
function signatureOf(type, label, category) {
  return `${type}::${normalize(label) || normalize(category)}`;
}

async function pendingSuggestions(userId) {
  const [detected, rules, dismissals] = await Promise.all([
    detectRecurring(userId),
    Recurrence.findAll({ where: { userId } }),
    RecurrenceDismissal.findAll({ where: { userId } })
  ]);

  // Já cadastrado (mesmo pausado) não volta como sugestão: o usuário já decidiu.
  const known = new Set(rules.map((r) => signatureOf(r.type, r.description, r.category)));
  const dismissed = new Set(dismissals.map((d) => d.signature));

  return detected
    .map((item) => ({ ...item, signature: signatureOf(item.type, item.label, item.category) }))
    .filter((item) => !known.has(item.signature) && !dismissed.has(item.signature));
}

router.get('/suggestions', async (req, res) => {
  res.json(await pendingSuggestions(req.user.id));
});

router.post('/suggestions/dismiss', async (req, res) => {
  const { signature } = req.body;

  if (!signature) {
    return res.status(400).json({ error: 'signature é obrigatória' });
  }

  // findOrCreate: dispensar duas vezes não pode virar erro de unicidade.
  await RecurrenceDismissal.findOrCreate({ where: { userId: req.user.id, signature } });
  res.json({ dismissed: signature });
});

router.post('/suggestions/accept', async (req, res) => {
  const { signature } = req.body;
  const suggestions = await pendingSuggestions(req.user.id);
  const match = suggestions.find((s) => s.signature === signature);

  if (!match) {
    return res.status(404).json({ error: 'Sugestão não encontrada' });
  }

  const account =
    (match.accountId && await Account.findOne({ where: { id: match.accountId, userId: req.user.id } })) ||
    await Account.findOne({ where: { userId: req.user.id }, order: [['createdAt', 'ASC']] });

  if (!account) {
    return res.status(400).json({ error: 'Cadastre uma conta antes de criar uma conta fixa' });
  }

  // A cobrança deste mês pode já estar lançada (foi ela que gerou o palpite).
  // Nesse caso a regra começa mês que vem, senão o app duplicaria o lançamento.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const thisMonth = await Transaction.findAll({
    where: { userId: req.user.id, type: match.type, occurredAt: { [Op.gte]: monthStart, [Op.lt]: monthEnd } }
  });
  const alreadyCharged = thisMonth.some(
    (t) => signatureOf(t.type, t.description, t.category) === signature
  );

  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startDate = alreadyCharged
    ? `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`
    : todayIso();

  const rule = await Recurrence.create({
    userId: req.user.id,
    accountId: account.id,
    type: match.type,
    amount: match.typicalAmount,
    category: Transaction.CATEGORIES.includes(match.category) ? match.category : 'Outros',
    description: match.label,
    dayOfMonth: Math.min(Math.max(match.typicalDay, 1), 31),
    startDate
  });

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
