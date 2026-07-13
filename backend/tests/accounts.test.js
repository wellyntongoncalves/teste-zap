const request = require('supertest');
const app = require('../server');
const sequelize = require('../config/database');

describe('Rotas de contas', () => {
  let token;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    await request(app).post('/api/auth/register').send({
      name: 'Contas Teste',
      email: 'contas@example.com',
      password: 'senha1234'
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'contas@example.com',
      password: 'senha1234'
    });

    token = loginRes.body.token;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('rejeita acesso sem token', async () => {
    const res = await request(app).get('/api/accounts');
    expect(res.status).toBe(401);
  });

  test('registro já cria a conta padrão automaticamente', async () => {
    const res = await request(app).get('/api/accounts').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Conta Padrão');
    expect(res.body[0].balance).toBe(0);
  });

  test('cria uma conta e retorna o saldo computado', async () => {
    const createRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Carteira', type: 'carteira', initialBalance: 100 });

    expect(createRes.status).toBe(201);
    expect(createRes.body.balance).toBe(100);

    const listRes = await request(app).get('/api/accounts').set('Authorization', `Bearer ${token}`);
    expect(listRes.body).toHaveLength(2);
    expect(listRes.body.some((a) => a.name === 'Carteira')).toBe(true);
  });

  test('atualiza uma conta', async () => {
    const createRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Conta Corrente', type: 'corrente' });

    const updateRes = await request(app)
      .patch(`/api/accounts/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Conta Corrente Renomeada' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('Conta Corrente Renomeada');
  });

  test('arquiva (soft delete) e some da listagem padrão', async () => {
    const createRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Poupança', type: 'poupanca' });

    const deleteRes = await request(app)
      .delete(`/api/accounts/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);

    const listRes = await request(app).get('/api/accounts').set('Authorization', `Bearer ${token}`);
    expect(listRes.body.find((a) => a.id === createRes.body.id)).toBeUndefined();

    const listWithArchived = await request(app)
      .get('/api/accounts?includeArchived=true')
      .set('Authorization', `Bearer ${token}`);
    expect(listWithArchived.body.find((a) => a.id === createRes.body.id)).toBeDefined();
  });
});
