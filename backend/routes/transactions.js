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

// Relatórios exportados são pra um usuário brasileiro: rótulos em português e
// valores/datas no formato de cá, não o "expense"/"75.5"/ISO cru do banco.
const TYPE_LABELS_PT = { income: 'Receita', expense: 'Despesa', transfer: 'Transferência' };
const SOURCE_LABELS_PT = { dashboard: 'App', whatsapp: 'WhatsApp' };
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
// Fixo em UTC: occurredAt de lançamento com data escolhida é gravado à meia-noite
// UTC, então formatar em UTC devolve a data que o usuário digitou — e o relatório
// fica igual rodando no dev (fuso local) ou no Vercel (UTC).
const dayMonthYear = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const monthYear = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const formatBRL = (value) => brl.format(Number(value) || 0);
const formatDatePt = (date) => dayMonthYear.format(new Date(date));

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

router.patch('/:id', async (req, res) => {
  const transaction = await Transaction.findOne({ where: { id: req.params.id, userId: req.user.id } });

  if (!transaction) {
    return res.status(404).json({ error: 'Transação não encontrada' });
  }

  const { amount, category, description, occurredAt, type, accountId, destinationAccountId, tags } = req.body;

  if (type === 'transfer' && !(destinationAccountId || transaction.destinationAccountId)) {
    return res.status(400).json({ error: 'destinationAccountId é obrigatório para transferências' });
  }

  // Mesma proteção do POST: category é um ENUM no banco, e um valor fora da
  // lista derrubaria a query em vez de virar um 400.
  const safeCategory =
    category !== undefined
      ? (Transaction.CATEGORIES.includes(category) ? category : 'Outros')
      : undefined;

  await transaction.update({
    ...(amount !== undefined ? { amount } : {}),
    ...(safeCategory !== undefined ? { category: safeCategory } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(occurredAt !== undefined ? { occurredAt } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(accountId !== undefined ? { accountId } : {}),
    // Só transferência tem destino; trocar o tipo pra outra coisa precisa limpá-lo.
    ...(type !== undefined && type !== 'transfer' ? { destinationAccountId: null } : {}),
    ...(destinationAccountId !== undefined ? { destinationAccountId } : {})
  });

  if (Array.isArray(tags)) {
    await transaction.setTags(tags);
  }

  const updated = await Transaction.findOne({
    where: { id: transaction.id },
    include: [{ model: Tag, attributes: ['id', 'name', 'color'], through: { attributes: [] } }]
  });

  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const transaction = await Transaction.findOne({ where: { id: req.params.id, userId: req.user.id } });

  if (!transaction) {
    return res.status(404).json({ error: 'Transação não encontrada' });
  }

  // Apagar uma parcela solta de uma compra parcelada deixa o restante órfão e
  // o total não bate mais. Por isso "?scope=group" apaga a compra inteira.
  if (req.query.scope === 'group' && transaction.installmentGroupId) {
    const removed = await Transaction.destroy({
      where: { userId: req.user.id, installmentGroupId: transaction.installmentGroupId }
    });
    return res.json({ removed });
  }

  await transaction.destroy();
  res.json({ removed: 1 });
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

  // Contagem real do mês (todos os tipos). A Home mostrava o tamanho da lista de
  // recentes (cortada em 6), então "50 lançamentos" aparecia como "6".
  const count = await Transaction.count({ where: baseWhere });

  res.json({
    total: totalExpense,
    byCategory,
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    count
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

  const rows = transactions.map((t) => ({
    Data: formatDatePt(t.occurredAt),
    Tipo: TYPE_LABELS_PT[t.type] || t.type,
    // Vírgula decimal e sem símbolo: o Excel pt-BR lê como número.
    Valor: (Number(t.amount) || 0).toFixed(2).replace('.', ','),
    Categoria: t.category,
    'Descrição': t.description || '',
    Origem: SOURCE_LABELS_PT[t.source] || t.source || ''
  }));

  // ; como separador e BOM: é o que o Excel brasileiro espera — sem isso os
  // acentos saem quebrados e o valor com vírgula cairia na coluna errada.
  const parser = new Parser({
    fields: ['Data', 'Tipo', 'Valor', 'Categoria', 'Descrição', 'Origem'],
    delimiter: ';',
    withBOM: true
  });
  const csv = parser.parse(rows);

  res.header('Content-Type', 'text/csv; charset=utf-8');
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

  doc.fontSize(18).fillColor('#111').text('Relatório de Transações', { align: 'center' });
  // Mês/ano a partir do início do período, em UTC, pra não escorregar de mês em
  // fusos a leste. capitalize: "julho de 2026" -> "Julho de 2026".
  const periodStart = new Date(Date.UTC(start.getFullYear(), start.getMonth(), 1));
  const periodo = monthYear.format(periodStart).replace(/^\w/, (c) => c.toUpperCase());
  doc.fontSize(11).fillColor('#666').text(periodo, { align: 'center' });
  doc.moveDown();
  doc.fillColor('#111');

  if (transactions.length === 0) {
    doc.fontSize(12).fillColor('#666').text('Nenhuma transação no período.', { align: 'center' });
    doc.end();
    return;
  }

  let totalExpense = 0;
  let totalIncome = 0;
  transactions.forEach((transaction) => {
    const amount = parseFloat(transaction.amount);
    if (transaction.type === 'expense') totalExpense += amount;
    if (transaction.type === 'income') totalIncome += amount;

    const tipo = TYPE_LABELS_PT[transaction.type] || transaction.type;
    doc.fontSize(11).fillColor('#111').text(
      `${formatDatePt(transaction.occurredAt)}   ·   ${tipo}   ·   ${formatBRL(amount)}   ·   ${transaction.category}   ·   ${transaction.description || ''}`
    );
  });

  doc.moveDown();
  doc.fontSize(13).fillColor('#111');
  doc.text(`Total de receitas: ${formatBRL(totalIncome)}`, { align: 'right' });
  doc.text(`Total de despesas: ${formatBRL(totalExpense)}`, { align: 'right' });
  doc.text(`Saldo do período: ${formatBRL(totalIncome - totalExpense)}`, { align: 'right' });

  doc.end();
});

module.exports = router;
