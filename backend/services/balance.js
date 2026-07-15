const { Op, fn, col } = require('sequelize');
const Transaction = require('../models/transaction');

// O saldo nunca é armazenado — é sempre recomputado a partir do saldo inicial +
// transações, pra nunca ficar dessincronizado.
//
// Compras no cartão ficam de fora: elas pertencem à fatura (agrupadas por
// creditCardId em GET /credit-cards/:id/invoices) e só tocam a conta quando a
// fatura é paga — que é um lançamento próprio, na paymentAccountId do cartão.
async function sumOf(where) {
  const rows = await Transaction.findAll({
    attributes: [[fn('SUM', col('amount')), 'total']],
    where,
    raw: true
  });
  return parseFloat(rows[0]?.total) || 0;
}

async function computeBalance(account) {
  const onThisAccount = { userId: account.userId, accountId: account.id, creditCardId: null };

  const [income, expense, transferredOut, transferredIn] = await Promise.all([
    sumOf({ ...onThisAccount, type: 'income' }),
    sumOf({ ...onThisAccount, type: 'expense' }),
    // Transferência sai da conta de origem (accountId) e entra na de destino.
    sumOf({ userId: account.userId, accountId: account.id, type: 'transfer' }),
    sumOf({ userId: account.userId, destinationAccountId: account.id, type: 'transfer' })
  ]);

  const balance = parseFloat(account.initialBalance) + income - expense - transferredOut + transferredIn;

  // DECIMAL(10,2) no banco: arredonda pra não vazar ruído de ponto flutuante
  // (ex: 0.1 + 0.2) no valor que o usuário lê.
  return Math.round(balance * 100) / 100;
}

async function computeBalances(accounts) {
  return Promise.all(
    accounts.map(async (account) => ({ ...account.toJSON(), balance: await computeBalance(account) }))
  );
}

module.exports = { computeBalance, computeBalances };
