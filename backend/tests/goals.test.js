const request = require('supertest');
const app = require('../server');
const sequelize = require('../config/database');

describe('Rotas de metas', () => {
  let token;
  let accountId;
  let goalId;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    await request(app).post('/api/auth/register').send({
      name: 'Metas Teste',
      email: 'metas@example.com',
      password: 'senha1234'
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'metas@example.com',
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
    const res = await request(app).get('/api/goals');
    expect(res.status).toBe(401);
  });

  test('cria uma meta', async () => {
    const res = await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Viagem', targetAmount: 1000, linkedAccountId: accountId });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('active');
    expect(res.body.currentAmount).toBe('0.00');
    goalId = res.body.id;
  });

  test('adiciona uma contribuição parcial e mantém status ativo', async () => {
    const res = await request(app)
      .post(`/api/goals/${goalId}/contributions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 400 });

    expect(res.status).toBe(200);
    expect(parseFloat(res.body.currentAmount)).toBe(400);
    expect(res.body.status).toBe('active');
  });

  test('contribuição com fromAccountId cria uma transferência', async () => {
    const secondAccountRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Corrente', type: 'corrente', initialBalance: 1000 });

    await request(app)
      .post(`/api/goals/${goalId}/contributions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100, fromAccountId: secondAccountRes.body.id });

    const transactionsRes = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${token}`);

    const transfer = transactionsRes.body.find((t) => t.type === 'transfer');
    expect(transfer).toBeDefined();
    expect(transfer.destinationAccountId).toBe(accountId);
  });

  test('contribuição que atinge o alvo marca a meta como completed', async () => {
    const res = await request(app)
      .post(`/api/goals/${goalId}/contributions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 600 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });

  test('arquivar remove da listagem padrão', async () => {
    const deleteRes = await request(app)
      .delete(`/api/goals/${goalId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);

    const listRes = await request(app).get('/api/goals').set('Authorization', `Bearer ${token}`);
    expect(listRes.body.find((g) => g.id === goalId)).toBeUndefined();
  });
});
