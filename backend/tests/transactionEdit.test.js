const request = require('supertest');
const app = require('../server');
const sequelize = require('../config/database');
const Account = require('../models/account');
const CreditCard = require('../models/creditCard');
const Transaction = require('../models/transaction');

describe('Editar e apagar lançamento', () => {
  let token;
  let userId;
  let conta;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Edit', email: 'edit@test.com', password: 'senha12345' });

    token = res.body.token;
    userId = res.body.user.id;
    conta = await Account.create({ userId, name: 'Corrente', type: 'corrente', initialBalance: 0 });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  const auth = (req) => req.set('Authorization', `Bearer ${token}`);

  async function novaDespesa(overrides = {}) {
    return Transaction.create({
      userId,
      accountId: conta.id,
      type: 'expense',
      amount: 100,
      category: 'Outros',
      occurredAt: new Date(),
      ...overrides
    });
  }

  describe('PATCH', () => {
    it('exige autenticação', async () => {
      const t = await novaDespesa();
      await request(app).patch(`/api/transactions/${t.id}`).send({ amount: 1 }).expect(401);
    });

    it('atualiza valor, categoria e descrição', async () => {
      const t = await novaDespesa();

      const res = await auth(request(app).patch(`/api/transactions/${t.id}`))
        .send({ amount: 55.5, category: 'Alimentação', description: 'corrigido' })
        .expect(200);

      expect(parseFloat(res.body.amount)).toBe(55.5);
      expect(res.body.category).toBe('Alimentação');
      expect(res.body.description).toBe('corrigido');
    });

    it('categoria fora do ENUM cai em "Outros" em vez de derrubar a query', async () => {
      const t = await novaDespesa();

      const res = await auth(request(app).patch(`/api/transactions/${t.id}`))
        .send({ category: 'Categoria Inventada' })
        .expect(200);

      expect(res.body.category).toBe('Outros');
    });

    it('não deixa editar transação de outro usuário', async () => {
      const outro = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Outro', email: 'outro-edit@test.com', password: 'senha12345' });

      const t = await novaDespesa();

      await request(app)
        .patch(`/api/transactions/${t.id}`)
        .set('Authorization', `Bearer ${outro.body.token}`)
        .send({ amount: 1 })
        .expect(404);
    });

    it('trocar de transferência para despesa limpa a conta de destino', async () => {
      const destino = await Account.create({ userId, name: 'Poupança', type: 'poupanca', initialBalance: 0 });
      const t = await novaDespesa({ type: 'transfer', destinationAccountId: destino.id });

      const res = await auth(request(app).patch(`/api/transactions/${t.id}`))
        .send({ type: 'expense' })
        .expect(200);

      expect(res.body.destinationAccountId).toBeNull();
    });

    it('404 para transação inexistente', async () => {
      await auth(request(app).patch('/api/transactions/00000000-0000-0000-0000-000000000000'))
        .send({ amount: 1 })
        .expect(404);
    });
  });

  describe('DELETE', () => {
    it('apaga um lançamento simples', async () => {
      const t = await novaDespesa();

      await auth(request(app).delete(`/api/transactions/${t.id}`)).expect(200);
      expect(await Transaction.findByPk(t.id)).toBeNull();
    });

    it('não deixa apagar transação de outro usuário', async () => {
      const outro = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Outro2', email: 'outro-del@test.com', password: 'senha12345' });

      const t = await novaDespesa();

      await request(app)
        .delete(`/api/transactions/${t.id}`)
        .set('Authorization', `Bearer ${outro.body.token}`)
        .expect(404);

      expect(await Transaction.findByPk(t.id)).not.toBeNull();
    });

    describe('parcelamento', () => {
      let cartao;

      beforeAll(async () => {
        cartao = await CreditCard.create({
          userId, name: 'Cartão', limitAmount: 5000, closingDay: 10, dueDay: 17
        });
      });

      async function criarParcelado() {
        const res = await auth(request(app).post('/api/transactions'))
          .send({
            amount: 300,
            category: 'Compras',
            accountId: conta.id,
            creditCardId: cartao.id,
            installments: 3,
            type: 'expense'
          })
          .expect(201);
        return res.body; // array com as 3 parcelas
      }

      it('sem scope apaga só a parcela e deixa as outras', async () => {
        const parcelas = await criarParcelado();

        await auth(request(app).delete(`/api/transactions/${parcelas[0].id}`)).expect(200);

        expect(await Transaction.findByPk(parcelas[0].id)).toBeNull();
        expect(await Transaction.findByPk(parcelas[1].id)).not.toBeNull();
        expect(await Transaction.findByPk(parcelas[2].id)).not.toBeNull();
      });

      it('scope=group apaga a compra inteira', async () => {
        const parcelas = await criarParcelado();

        const res = await auth(
          request(app).delete(`/api/transactions/${parcelas[1].id}?scope=group`)
        ).expect(200);

        expect(res.body.removed).toBe(3);
        for (const p of parcelas) {
          expect(await Transaction.findByPk(p.id)).toBeNull();
        }
      });

      it('scope=group num lançamento avulso apaga só ele', async () => {
        const t = await novaDespesa();

        const res = await auth(request(app).delete(`/api/transactions/${t.id}?scope=group`)).expect(200);
        expect(res.body.removed).toBe(1);
      });
    });
  });
});
