const express = require('express');
const CreditCard = require('../models/creditCard');
const Transaction = require('../models/transaction');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Uma compra feita após o fechamento do mês cai na fatura que fecha no mês seguinte.
function invoicePeriod(date, closingDay) {
  const d = new Date(date);
  let year = d.getFullYear();
  let month = d.getMonth();

  if (d.getDate() > closingDay) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

router.get('/', async (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';

  const cards = await CreditCard.findAll({
    where: {
      userId: req.user.id,
      ...(includeArchived ? {} : { archivedAt: null })
    },
    order: [['createdAt', 'ASC']]
  });

  res.json(cards);
});

router.post('/', async (req, res) => {
  const { name, limitAmount, closingDay, dueDay, paymentAccountId } = req.body;

  if (!name || !limitAmount || !closingDay || !dueDay) {
    return res.status(400).json({ error: 'name, limitAmount, closingDay e dueDay são obrigatórios' });
  }

  const card = await CreditCard.create({
    userId: req.user.id,
    name,
    limitAmount,
    closingDay,
    dueDay,
    paymentAccountId
  });

  res.status(201).json(card);
});

router.patch('/:id', async (req, res) => {
  const card = await CreditCard.findOne({ where: { id: req.params.id, userId: req.user.id } });

  if (!card) {
    return res.status(404).json({ error: 'Cartão não encontrado' });
  }

  const { name, limitAmount, closingDay, dueDay, paymentAccountId, archived } = req.body;

  await card.update({
    ...(name !== undefined ? { name } : {}),
    ...(limitAmount !== undefined ? { limitAmount } : {}),
    ...(closingDay !== undefined ? { closingDay } : {}),
    ...(dueDay !== undefined ? { dueDay } : {}),
    ...(paymentAccountId !== undefined ? { paymentAccountId } : {}),
    // Mesma correção das contas: sem isto, arquivar o cartão era irreversível e
    // as faturas dele ficavam inalcançáveis.
    ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {})
  });

  res.json(card);
});

router.delete('/:id', async (req, res) => {
  const card = await CreditCard.findOne({ where: { id: req.params.id, userId: req.user.id } });

  if (!card) {
    return res.status(404).json({ error: 'Cartão não encontrado' });
  }

  await card.update({ archivedAt: new Date() });
  res.sendStatus(204);
});

router.get('/:id/invoices', async (req, res) => {
  const card = await CreditCard.findOne({ where: { id: req.params.id, userId: req.user.id } });

  if (!card) {
    return res.status(404).json({ error: 'Cartão não encontrado' });
  }

  const transactions = await Transaction.findAll({
    where: { creditCardId: card.id, userId: req.user.id },
    order: [['occurredAt', 'ASC']]
  });

  const invoicesByPeriod = new Map();

  for (const transaction of transactions) {
    const period = invoicePeriod(transaction.occurredAt, card.closingDay);
    if (!invoicesByPeriod.has(period)) {
      invoicesByPeriod.set(period, { period, total: 0, transactions: [] });
    }
    const invoice = invoicesByPeriod.get(period);
    invoice.total += parseFloat(transaction.amount);
    invoice.transactions.push(transaction);
  }

  const invoices = Array.from(invoicesByPeriod.values()).sort((a, b) => a.period.localeCompare(b.period));

  res.json(invoices);
});

module.exports = router;
