const request = require('supertest');
const app = require('../server');
const sequelize = require('../config/database');

describe('Rotas de orçamentos', () => {
  let token;
  let accountId;
  let tagId;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    await request(app).post('/api/auth/register').send({
      name: 'Orçamentos Teste',
      email: 'orcamentos@example.com',
      password: 'senha1234'
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'orcamentos@example.com',
      password: 'senha1234'
    });

    token = loginRes.body.token;

    const accountsRes = await request(app).get('/api/accounts').set('Authorization', `Bearer ${token}`);
    accountId = accountsRes.body[0].id;

    const tagRes = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Viagem' });
    tagId = tagRes.body.id;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('rejeita orçamento sem category nem tagId', async () => {
    const res = await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 500 });

    expect(res.status).toBe(400);
  });

  test('rejeita orçamento com category e tagId juntos', async () => {
    const res = await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 500, category: 'Lazer', tagId });

    expect(res.status).toBe(400);
  });

  test('cria orçamento por categoria e calcula o gasto real', async () => {
    await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 200, category: 'Lazer' });

    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 80, category: 'Lazer', accountId });

    const statusRes = await request(app)
      .get('/api/budgets/status')
      .set('Authorization', `Bearer ${token}`);

    expect(statusRes.status).toBe(200);
    const lazerBudget = statusRes.body.find((b) => b.category === 'Lazer');
    expect(lazerBudget.spent).toBe(80);
    expect(lazerBudget.remaining).toBe(120);
  });

  test('cria orçamento por tag e calcula o gasto real via transações marcadas', async () => {
    await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 1000, tagId });

    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 250, category: 'Transporte', accountId, tags: [tagId] });

    const statusRes = await request(app)
      .get('/api/budgets/status')
      .set('Authorization', `Bearer ${token}`);

    const tagBudget = statusRes.body.find((b) => b.tag && b.tag.id === tagId);
    expect(tagBudget.spent).toBe(250);
    expect(tagBudget.remaining).toBe(750);
  });
});
