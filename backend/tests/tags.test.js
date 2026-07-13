const request = require('supertest');
const app = require('../server');
const sequelize = require('../config/database');

describe('Rotas de tags', () => {
  let token;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    await request(app).post('/api/auth/register').send({
      name: 'Tags Teste',
      email: 'tags@example.com',
      password: 'senha1234'
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'tags@example.com',
      password: 'senha1234'
    });

    token = loginRes.body.token;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('rejeita acesso sem token', async () => {
    const res = await request(app).get('/api/tags');
    expect(res.status).toBe(401);
  });

  test('cria uma tag', async () => {
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Viagem', color: '#4e79a7' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Viagem');
  });

  test('rejeita tag duplicada para o mesmo usuário', async () => {
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Viagem' });

    expect(res.status).toBe(409);
  });

  test('lista as tags do usuário', async () => {
    const res = await request(app).get('/api/tags').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.some((t) => t.name === 'Viagem')).toBe(true);
  });

  test('remove uma tag', async () => {
    const createRes = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Temporária' });

    const deleteRes = await request(app)
      .delete(`/api/tags/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);

    const listRes = await request(app).get('/api/tags').set('Authorization', `Bearer ${token}`);
    expect(listRes.body.find((t) => t.id === createRes.body.id)).toBeUndefined();
  });
});
