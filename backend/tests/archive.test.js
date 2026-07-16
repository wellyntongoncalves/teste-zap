const request = require('supertest');
const app = require('../server');
const sequelize = require('../config/database');
const Account = require('../models/account');
const CreditCard = require('../models/creditCard');

describe('Arquivar e restaurar', () => {
  let token;
  let userId;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Arq', email: 'arq@test.com', password: 'senha12345' });

    token = res.body.token;
    userId = res.body.user.id;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  const auth = (req) => req.set('Authorization', `Bearer ${token}`);

  describe('contas', () => {
    it('some da lista ao arquivar, mas volta com includeArchived', async () => {
      const conta = await Account.create({ userId, name: 'Velha', type: 'carteira', initialBalance: 10 });

      await auth(request(app).delete(`/api/accounts/${conta.id}`)).expect(204);

      const padrao = await auth(request(app).get('/api/accounts')).expect(200);
      expect(padrao.body.find((a) => a.id === conta.id)).toBeUndefined();

      const comArquivadas = await auth(
        request(app).get('/api/accounts').query({ includeArchived: 'true' })
      ).expect(200);
      expect(comArquivadas.body.find((a) => a.id === conta.id)).toBeDefined();
    });

    it('restaura uma conta arquivada — arquivar não pode ser porta de mão única', async () => {
      const conta = await Account.create({ userId, name: 'Volta', type: 'carteira', initialBalance: 0 });

      await auth(request(app).delete(`/api/accounts/${conta.id}`)).expect(204);
      await conta.reload();
      expect(conta.archivedAt).not.toBeNull();

      const res = await auth(request(app).patch(`/api/accounts/${conta.id}`))
        .send({ archived: false })
        .expect(200);

      expect(res.body.archivedAt).toBeNull();

      const lista = await auth(request(app).get('/api/accounts')).expect(200);
      expect(lista.body.find((a) => a.id === conta.id)).toBeDefined();
    });

    it('arquiva pelo PATCH também', async () => {
      const conta = await Account.create({ userId, name: 'Patch', type: 'carteira', initialBalance: 0 });

      const res = await auth(request(app).patch(`/api/accounts/${conta.id}`))
        .send({ archived: true })
        .expect(200);

      expect(res.body.archivedAt).not.toBeNull();
    });

    it('não restaura conta de outro usuário', async () => {
      const outro = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Outro', email: 'outro-arq@test.com', password: 'senha12345' });

      const conta = await Account.create({ userId, name: 'Minha', type: 'carteira', initialBalance: 0 });
      await auth(request(app).delete(`/api/accounts/${conta.id}`)).expect(204);

      await request(app)
        .patch(`/api/accounts/${conta.id}`)
        .set('Authorization', `Bearer ${outro.body.token}`)
        .send({ archived: false })
        .expect(404);
    });
  });

  describe('cartões', () => {
    it('restaura um cartão arquivado', async () => {
      const cartao = await CreditCard.create({
        userId, name: 'Cartão', limitAmount: 1000, closingDay: 10, dueDay: 17
      });

      await auth(request(app).delete(`/api/credit-cards/${cartao.id}`)).expect(204);

      const res = await auth(request(app).patch(`/api/credit-cards/${cartao.id}`))
        .send({ archived: false })
        .expect(200);

      expect(res.body.archivedAt).toBeNull();

      const lista = await auth(request(app).get('/api/credit-cards')).expect(200);
      expect(lista.body.find((c) => c.id === cartao.id)).toBeDefined();
    });
  });
});
