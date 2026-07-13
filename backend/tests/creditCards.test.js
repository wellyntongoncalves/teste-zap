const request = require('supertest');
const app = require('../server');
const sequelize = require('../config/database');

describe('Rotas de cartão de crédito', () => {
  let token;
  let accountId;
  let cardId;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    await request(app).post('/api/auth/register').send({
      name: 'Cartões Teste',
      email: 'cartoes@example.com',
      password: 'senha1234'
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'cartoes@example.com',
      password: 'senha1234'
    });

    token = loginRes.body.token;

    const accountsRes = await request(app).get('/api/accounts').set('Authorization', `Bearer ${token}`);
    accountId = accountsRes.body[0].id;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('rejeita acesso sem token', async () => {
    const res = await request(app).get('/api/credit-cards');
    expect(res.status).toBe(401);
  });

  test('cria um cartão de crédito', async () => {
    const res = await request(app)
      .post('/api/credit-cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nubank', limitAmount: 5000, closingDay: 10, dueDay: 17 });

    expect(res.status).toBe(201);
    cardId = res.body.id;
  });

  test('cria uma compra parcelada e agrupa nas faturas corretas', async () => {
    const createRes = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: 300,
        category: 'Compras',
        description: 'Notebook',
        accountId,
        creditCardId: cardId,
        installments: 3,
        occurredAt: '2026-03-05T12:00:00.000Z'
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toHaveLength(3);
    expect(createRes.body[0].installmentTotal).toBe(3);
    expect(createRes.body[0].amount).toBe('100.00');

    const invoicesRes = await request(app)
      .get(`/api/credit-cards/${cardId}/invoices`)
      .set('Authorization', `Bearer ${token}`);

    expect(invoicesRes.status).toBe(200);
    expect(invoicesRes.body).toHaveLength(3);
    expect(invoicesRes.body.reduce((sum, inv) => sum + inv.total, 0)).toBeCloseTo(300);
  });

  test('arquiva um cartão (soft delete)', async () => {
    const deleteRes = await request(app)
      .delete(`/api/credit-cards/${cardId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);

    const listRes = await request(app).get('/api/credit-cards').set('Authorization', `Bearer ${token}`);
    expect(listRes.body.find((c) => c.id === cardId)).toBeUndefined();
  });
});
