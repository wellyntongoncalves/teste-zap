const request = require('supertest');
const app = require('../server');
const sequelize = require('../config/database');

describe('Rotas de transações', () => {
  let token;
  let defaultAccountId;
  let secondAccountId;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    await request(app).post('/api/auth/register').send({
      name: 'Transações Teste',
      email: 'transacoes@example.com',
      password: 'senha1234'
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'transacoes@example.com',
      password: 'senha1234'
    });

    token = loginRes.body.token;

    const accountsRes = await request(app).get('/api/accounts').set('Authorization', `Bearer ${token}`);
    defaultAccountId = accountsRes.body[0].id;

    const secondAccountRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Poupança', type: 'poupanca' });
    secondAccountId = secondAccountRes.body.id;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('registro cria uma conta padrão automaticamente', () => {
    expect(defaultAccountId).toBeDefined();
  });

  test('rejeita acesso sem token', async () => {
    const res = await request(app).get('/api/transactions');
    expect(res.status).toBe(401);
  });

  test('exige accountId para criar transação', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 75.5, category: 'Lazer' });

    expect(res.status).toBe(400);
  });

  test('cria uma despesa e retorna na listagem', async () => {
    const createRes = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 75.5, category: 'Lazer', description: 'Cinema', accountId: defaultAccountId });

    expect(createRes.status).toBe(201);
    expect(createRes.body.type).toBe('expense');

    const listRes = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.some((t) => t.description === 'Cinema')).toBe(true);
  });

  test('cria uma receita e o resumo mensal reflete no total de receitas', async () => {
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 3000, category: 'Salário', type: 'income', accountId: defaultAccountId });

    const res = await request(app)
      .get('/api/transactions/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalIncome).toBe(3000);
    expect(res.body.totalExpense).toBe(75.5);
    expect(res.body.net).toBe(3000 - 75.5);
    // count conta todos os tipos do mês: a despesa "Cinema" + esta receita
    expect(res.body.count).toBe(2);
  });

  test('exige destinationAccountId para transferências', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100, category: 'Outros', type: 'transfer', accountId: defaultAccountId });

    expect(res.status).toBe(400);
  });

  test('cria uma transferência entre contas', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: 200,
        category: 'Outros',
        type: 'transfer',
        accountId: defaultAccountId,
        destinationAccountId: secondAccountId
      });

    expect(res.status).toBe(201);
    expect(res.body.destinationAccountId).toBe(secondAccountId);
  });

  test('exporta as transações do período em CSV', async () => {
    const res = await request(app)
      .get('/api/transactions/export/csv')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('Cinema');
    // formato brasileiro: cabeçalho e tipo em português, valor com vírgula
    expect(res.text).toContain('Categoria');
    expect(res.text).toContain('Despesa');
    expect(res.text).toContain('75,50');
  });
});
