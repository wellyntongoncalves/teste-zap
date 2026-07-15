const request = require('supertest');
const app = require('../server');
const sequelize = require('../config/database');
const Account = require('../models/account');
const CreditCard = require('../models/creditCard');
const Transaction = require('../models/transaction');

describe('Saldo da conta', () => {
  let token;
  let userId;
  let conta;
  let poupanca;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Saldo', email: 'saldo@test.com', password: 'senha12345' });

    token = res.body.token;
    userId = res.body.user.id;

    conta = await Account.create({ userId, name: 'Corrente', type: 'corrente', initialBalance: 1000 });
    poupanca = await Account.create({ userId, name: 'Poupança', type: 'poupanca', initialBalance: 0 });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  async function balanceOf(accountId) {
    const res = await request(app).get('/api/accounts').set('Authorization', `Bearer ${token}`).expect(200);
    return res.body.find((a) => a.id === accountId).balance;
  }

  it('soma receita e subtrai despesa do saldo inicial', async () => {
    await Transaction.create({
      userId, accountId: conta.id, type: 'income', amount: 5000, category: 'Salário', occurredAt: new Date()
    });
    await Transaction.create({
      userId, accountId: conta.id, type: 'expense', amount: 250.5, category: 'Alimentação', occurredAt: new Date()
    });

    // 1000 + 5000 - 250,50
    expect(await balanceOf(conta.id)).toBe(5749.5);
  });

  it('transferência sai da origem e entra no destino', async () => {
    await Transaction.create({
      userId,
      accountId: conta.id,
      destinationAccountId: poupanca.id,
      type: 'transfer',
      amount: 700,
      category: 'Outros',
      occurredAt: new Date()
    });

    expect(await balanceOf(conta.id)).toBe(5049.5); // 5749,50 - 700
    expect(await balanceOf(poupanca.id)).toBe(700);
  });

  it('compra no cartão NÃO tira do saldo da conta (ela pertence à fatura)', async () => {
    const antes = await balanceOf(conta.id);

    const cartao = await CreditCard.create({
      userId, name: 'Cartão', limitAmount: 5000, closingDay: 10, dueDay: 17, paymentAccountId: conta.id
    });

    await Transaction.create({
      userId,
      accountId: conta.id,
      creditCardId: cartao.id,
      type: 'expense',
      amount: 999,
      category: 'Compras',
      occurredAt: new Date()
    });

    expect(await balanceOf(conta.id)).toBe(antes);
  });

  it('conta sem transação fica no saldo inicial', async () => {
    const nova = await Account.create({ userId, name: 'Vazia', type: 'carteira', initialBalance: 42.75 });
    expect(await balanceOf(nova.id)).toBe(42.75);
  });
});
