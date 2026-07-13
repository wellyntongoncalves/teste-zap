const request = require('supertest');
const app = require('../server');
const sequelize = require('../config/database');

describe('Webhook do WhatsApp', () => {
  let token;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    await request(app).post('/api/auth/register').send({
      name: 'WhatsApp Teste',
      email: 'whatsapp@example.com',
      password: 'senha1234',
      whatsappNumber: '+5511988887777'
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'whatsapp@example.com',
      password: 'senha1234'
    });

    token = loginRes.body.token;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('mensagem de número não cadastrado não cria transação e responde 200', async () => {
    const res = await request(app)
      .post('/api/whatsapp/webhook')
      .type('form')
      .send({ From: 'whatsapp:+5511900000000', Body: 'Gastei 10 reais' });

    expect(res.status).toBe(200);
  });

  test('detecta despesa e lança na conta padrão do usuário', async () => {
    await request(app)
      .post('/api/whatsapp/webhook')
      .type('form')
      .send({ From: 'whatsapp:+5511988887777', Body: 'Gastei 50 reais no mercado' });

    const listRes = await request(app).get('/api/transactions').set('Authorization', `Bearer ${token}`);
    const created = listRes.body.find((t) => t.description === 'Gastei 50 reais no mercado');

    expect(created).toBeDefined();
    expect(created.type).toBe('expense');
    expect(created.category).toBe('Alimentação');
    expect(created.accountId).toBeDefined();
  });

  test('detecta receita a partir de frase com "recebi"', async () => {
    await request(app)
      .post('/api/whatsapp/webhook')
      .type('form')
      .send({ From: 'whatsapp:+5511988887777', Body: 'Recebi 3000 reais de salário' });

    const listRes = await request(app).get('/api/transactions').set('Authorization', `Bearer ${token}`);
    const created = listRes.body.find((t) => t.description === 'Recebi 3000 reais de salário');

    expect(created).toBeDefined();
    expect(created.type).toBe('income');
    expect(created.category).toBe('Salário');
  });

  test('mensagem sem valor numérico não cria transação', async () => {
    const before = await request(app).get('/api/transactions').set('Authorization', `Bearer ${token}`);

    await request(app)
      .post('/api/whatsapp/webhook')
      .type('form')
      .send({ From: 'whatsapp:+5511988887777', Body: 'Oi, tudo bem?' });

    const after = await request(app).get('/api/transactions').set('Authorization', `Bearer ${token}`);
    expect(after.body.length).toBe(before.body.length);
  });
});
