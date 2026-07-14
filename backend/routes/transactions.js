const express = require('express');
const crypto = require('crypto');
const { Op, fn, col } = require('sequelize');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const Transaction = require('../models/transaction');
const Tag = require('../models/tag');
const authMiddleware = require('../middleware/auth');
const { appendTransactionNote } = require('../services/obsidian');

const router = express.Router();
router.use(authMiddleware);

function monthRange(month, year) {
  const now = new Date();
  const y = year ? parseInt(year, 10) : now.getFullYear();
  const m = month ? parseInt(month, 10) - 1 : now.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 1);
  return { start, end };
}

router.get('/', async (req, res) => {
  const { month, year, type, accountId } = req.query;
  const { start, end } = monthRange(month, year);

  const transactions = await Transaction.findAll({
    where: {
      userId: req.user.id,
      occurredAt: { [Op.gte]: start, [Op.lt]: end },
      ...(type ? { type } : {}),
      ...(accountId ? { accountId } : {})
    },
    include: [{ model: Tag, attributes: ['id', 'name', 'color'], through: { attributes: [] } }],
    order: [['occurredAt', 'DESC']]
  });

  res.json(transactions);
});

router.post('/', async (req, res) => {
  const {
    amount, category, description, occurredAt, accountId, destinationAccountId, type,
    tags, creditCardId, installments
  } = req.body;

  if (!amount || !category || !accountId) {
    return res.status(400).json({ error: 'amount, category e accountId são obrigatórios' });
  }

  // A coluna `category` é um ENUM fixo no banco; categorias fora da lista
  // (ex: vindas do WhatsApp) caem em "Outros" em vez de quebrar a inserção.
  const safeCategory = Transaction.CATEGORIES.includes(category) ? category : 'Outros';

  if (type === 'transfer' && !destinationAccountId) {
    return res.status(400).json({ error: 'destinationAccountId é obrigatório para transferências' });
  }

  const installmentTotal = creditCardId && installments > 1 ? installments : null;
  const installmentGroupId = installmentTotal ? crypto.randomUUID() : null;
  const baseDate = occurredAt ? new Date(occurredAt) : new Date();
  const installmentAmount = installmentTotal ? amount / installmentTotal : amount;

  const createdTransactions = [];
  const count = installmentTotal || 1;

  for (let i = 0; i < count; i += 1) {
    const installmentDate = new Date(baseDate);
    installmentDate.setMonth(installmentDate.getMonth() + i);

    const transaction = await Transaction.create({
      userId: req.user.id,
      accountId,
      destinationAccountId: type === 'transfer' ? destinationAccountId : null,
      type: type || 'expense',
      amount: installmentAmount,
      category: safeCategory,
      description,
      source: 'dashboard',
      occurredAt: installmentDate,
      creditCardId: creditCardId || null,
      installmentGroupId,
      installmentNumber: installmentTotal ? i + 1 : null,
      installmentTotal
    });

    if (Array.isArray(tags) && tags.length > 0) {
      await transaction.setTags(tags);
    }

    createdTransactions.push(transaction);
  }

  await appendTransactionNote(req.user, createdTransactions[0]);

  res.status(201).json(installmentTotal ? createdTransactions : createdTransactions[0]);
});

router.get('/summary', async (req, res) => {
  const { month, year } = req.query;
  const { start, end } = monthRange(month, year);

  const baseWhere = {
    userId: req.user.id,
    occurredAt: { [Op.gte]: start, [Op.lt]: end }
  };

  const categoryRows = await Transaction.findAll({
    attributes: ['category', [fn('SUM', col('amount')), 'total']],
    where: { ...baseWhere, type: 'expense' },
    group: ['category']
  });

  const byCategory = categoryRows.map((row) => ({
    category: row.category,
    total: parseFloat(row.get('total'))
  }));

  const totalExpense = byCategory.reduce((sum, row) => sum + row.total, 0);

  const incomeRows = await Transaction.findAll({
    attributes: [[fn('SUM', col('amount')), 'total']],
    where: { ...baseWhere, type: 'income' },
    raw: true
  });

  const totalIncome = parseFloat(incomeRows[0]?.total) || 0;

  res.json({
    total: totalExpense,
    byCategory,
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense
  });
});

router.get('/export/csv', async (req, res) => {
  const { month, year } = req.query;
  const { start, end } = monthRange(month, year);

  const transactions = await Transaction.findAll({
    where: {
      userId: req.user.id,
      occurredAt: { [Op.gte]: start, [Op.lt]: end }
    },
    order: [['occurredAt', 'DESC']],
    raw: true
  });

  const parser = new Parser({ fields: ['occurredAt', 'type', 'amount', 'category', 'description', 'source'] });
  const csv = parser.parse(transactions);

  res.header('Content-Type', 'text/csv');
  res.attachment('transacoes.csv');
  res.send(csv);
});

router.get('/export/pdf', async (req, res) => {
  const { month, year } = req.query;
  const { start, end } = monthRange(month, year);

  const transactions = await Transaction.findAll({
    where: {
      userId: req.user.id,
      occurredAt: { [Op.gte]: start, [Op.lt]: end }
    },
    order: [['occurredAt', 'DESC']]
  });

  const doc = new PDFDocument({ margin: 40 });
  res.header('Content-Type', 'application/pdf');
  res.attachment('relatorio-transacoes.pdf');
  doc.pipe(res);

  doc.fontSize(18).text('Relatório de Transações', { align: 'center' });
  doc.moveDown();

  let totalExpense = 0;
  let totalIncome = 0;
  transactions.forEach((transaction) => {
    const amount = parseFloat(transaction.amount);
    if (transaction.type === 'expense') totalExpense += amount;
    if (transaction.type === 'income') totalIncome += amount;

    doc.fontSize(11).text(
      `${transaction.occurredAt.toISOString().slice(0, 10)}  |  [${transaction.type}]  |  R$ ${transaction.amount}  |  ${transaction.category}  |  ${transaction.description || ''}`
    );
  });

  doc.moveDown();
  doc.fontSize(13).text(`Total de receitas: R$ ${totalIncome.toFixed(2)}`, { align: 'right' });
  doc.fontSize(13).text(`Total de despesas: R$ ${totalExpense.toFixed(2)}`, { align: 'right' });

  doc.end();
});

module.exports = router;
