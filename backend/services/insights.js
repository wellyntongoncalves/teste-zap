const { Op } = require('sequelize');
const Transaction = require('../models/transaction');
const Account = require('../models/account');
const { computeBalance } = require('./balance');

// Quantos meses olhamos pra trás pra decidir se algo é recorrente.
const LOOKBACK_MONTHS = 6;
// Em quantos meses distintos a cobrança precisa aparecer. Dois seria ruído
// (duas idas ao mercado no mesmo padrão viram "assinatura"); três já mostra hábito.
const MIN_OCCURRENCES = 3;
// Assinatura reajusta, conta de luz varia. Uma faixa fechada demais perderia
// justamente as contas variáveis, que são as que interessam projetar.
const AMOUNT_TOLERANCE = 0.25;

// "Netflix 12/2025" e "NETFLIX" são a mesma coisa; o que varia é ruído.
function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\d+/g, '')
    .replace(/[^a-z\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Agrupa por "assinatura": mesma descrição normalizada (ou, sem descrição, a
// própria categoria) + mesmo tipo.
function groupKey(transaction) {
  const label = normalize(transaction.description) || normalize(transaction.category);
  return `${transaction.type}::${label}`;
}

function isRecurring(group) {
  const months = new Set(group.map((t) => monthKey(t.occurredAt)));
  if (months.size < MIN_OCCURRENCES) return false;

  // Vale a mediana, não a média: um mês atípico não deve definir o padrão.
  const amounts = group.map((t) => parseFloat(t.amount));
  const typical = median(amounts);
  if (typical <= 0) return false;

  const withinRange = amounts.filter((a) => Math.abs(a - typical) / typical <= AMOUNT_TOLERANCE);
  return withinRange.length >= MIN_OCCURRENCES;
}

function describeGroup(group) {
  const amounts = group.map((t) => parseFloat(t.amount));
  const typical = median(amounts);
  const days = group.map((t) => new Date(t.occurredAt).getDate());
  const last = group.reduce((a, b) => (new Date(a.occurredAt) > new Date(b.occurredAt) ? a : b));

  return {
    label: last.description || last.category,
    category: last.category,
    type: last.type,
    accountId: last.accountId,
    typicalAmount: Math.round(typical * 100) / 100,
    typicalDay: Math.round(median(days)),
    occurrences: new Set(group.map((t) => monthKey(t.occurredAt))).size,
    lastSeen: last.occurredAt
  };
}

async function detectRecurring(userId, now = new Date()) {
  const since = new Date(now.getFullYear(), now.getMonth() - LOOKBACK_MONTHS, 1);

  const transactions = await Transaction.findAll({
    where: {
      userId,
      type: { [Op.in]: ['income', 'expense'] },
      occurredAt: { [Op.gte]: since }
    },
    order: [['occurredAt', 'ASC']]
  });

  const groups = new Map();
  for (const transaction of transactions) {
    const key = groupKey(transaction);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(transaction);
  }

  return Array.from(groups.values())
    .filter(isRecurring)
    .map(describeGroup)
    .sort((a, b) => b.typicalAmount - a.typicalAmount);
}

// Projeta o fim do mês: saldo de hoje, mais o que costuma entrar e menos o que
// costuma sair no resto do mês. Só conta recorrentes que ainda não caíram —
// se a assinatura já foi debitada, ela já está no saldo.
async function projectMonthEnd(userId, recurring, now = new Date()) {
  const accounts = await Account.findAll({ where: { userId, archivedAt: null } });
  const balances = await Promise.all(accounts.map((a) => computeBalance(a)));
  const currentBalance = balances.reduce((sum, b) => sum + b, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const today = now.getDate();

  const alreadyThisMonth = await Transaction.findAll({
    where: {
      userId,
      type: { [Op.in]: ['income', 'expense'] },
      occurredAt: { [Op.gte]: monthStart, [Op.lte]: monthEnd }
    }
  });
  const seen = new Set(alreadyThisMonth.map((t) => groupKey(t)));

  const upcoming = recurring.filter((item) => {
    const key = `${item.type}::${normalize(item.label) || normalize(item.category)}`;
    return !seen.has(key) && item.typicalDay >= today;
  });

  const expectedIncome = upcoming
    .filter((i) => i.type === 'income')
    .reduce((sum, i) => sum + i.typicalAmount, 0);
  const expectedExpense = upcoming
    .filter((i) => i.type === 'expense')
    .reduce((sum, i) => sum + i.typicalAmount, 0);

  const round = (v) => Math.round(v * 100) / 100;

  return {
    currentBalance: round(currentBalance),
    expectedIncome: round(expectedIncome),
    expectedExpense: round(expectedExpense),
    projected: round(currentBalance + expectedIncome - expectedExpense),
    upcoming,
    daysLeft: monthEnd.getDate() - today
  };
}

async function buildInsights(userId, now = new Date()) {
  const recurring = await detectRecurring(userId, now);
  const projection = await projectMonthEnd(userId, recurring, now);

  return {
    recurring,
    monthlyRecurringCost: Math.round(
      recurring.filter((r) => r.type === 'expense').reduce((sum, r) => sum + r.typicalAmount, 0) * 100
    ) / 100,
    projection
  };
}

module.exports = { buildInsights, detectRecurring, projectMonthEnd, normalize };
