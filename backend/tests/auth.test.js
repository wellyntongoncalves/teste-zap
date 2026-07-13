const request = require('supertest');
const app = require('../server');
const sequelize = require('../config/database');

describe('Rotas de autenticação', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('registra um novo usuário', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Fulano',
      email: 'fulano@example.com',
      password: 'senha1234'
    });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('fulano@example.com');
  });

  test('rejeita registro com e-mail duplicado', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Fulano',
      email: 'dup@example.com',
      password: 'senha1234'
    });

    const res = await request(app).post('/api/auth/register').send({
      name: 'Outro',
      email: 'dup@example.com',
      password: 'outrasenha'
    });

    expect(res.status).toBe(409);
  });

  test('faz login e retorna access token + refresh token', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Login Teste',
      email: 'login@example.com',
      password: 'senha1234'
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'login@example.com',
      password: 'senha1234'
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  test('rejeita login com senha errada', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@example.com',
      password: 'errada'
    });

    expect(res.status).toBe(401);
  });

  test('troca um refresh token válido por um novo par de tokens', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Refresh Teste',
      email: 'refresh@example.com',
      password: 'senha1234'
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'refresh@example.com',
      password: 'senha1234'
    });

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.token).toBeDefined();
    expect(refreshRes.body.refreshToken).not.toBe(loginRes.body.refreshToken);
  });

  test('rejeita reuso de um refresh token já trocado', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Reuso Teste',
      email: 'reuso@example.com',
      password: 'senha1234'
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'reuso@example.com',
      password: 'senha1234'
    });

    await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken });

    const secondAttempt = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken });

    expect(secondAttempt.status).toBe(401);
  });

  test('logout revoga o refresh token', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Logout Teste',
      email: 'logout@example.com',
      password: 'senha1234'
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'logout@example.com',
      password: 'senha1234'
    });

    await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken: loginRes.body.refreshToken });

    const refreshAfterLogout = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken });

    expect(refreshAfterLogout.status).toBe(401);
  });
});
