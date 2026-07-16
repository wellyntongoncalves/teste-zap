const request = require('supertest');
const app = require('../server');
const sequelize = require('../config/database');
const Account = require('../models/account');
const Transaction = require('../models/transaction');

// Congela "hoje" para os testes não mudarem de resultado conforme o mês real.
const NOW = new Date(2026, 6, 15); // 15/07/2026

describe('Insights (recorrência e projeção)', () => {
  let token;
  let userId;
  let conta;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Insights', email: 'insights@test.com', password: 'senha12345' });

    token = res.body.token;
    userId = res.body.user.id;
    conta = await Account.create({ userId, name: 'Corrente', type: 'corrente', initialBalance: 1000 });

    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterAll(async () => {
    jest.useRealTimers();
    await sequelize.close();
  });

  async function addExpense(description, amount, monthsAgo, day = 5) {
    return Transaction.create({
      userId,
      accountId: conta.id,
      type: 'expense',
      amount,
      category: 'Contas',
      description,
      occurredAt: new Date(2026, 6 - monthsAgo, day)
    });
  }

  async function getInsights() {
    const res = await request(app).get('/api/insights').set('Authorization', `Bearer ${token}`).expect(200);
    return res.body;
  }

  it('exige autenticação', async () => {
    await request(app).get('/api/insights').expect(401);
  });

  it('não marca como recorrente quem apareceu só duas vezes', async () => {
    await addExpense('Cinema', 40, 2);
    await addExpense('Cinema', 40, 1);

    const { recurring } = await getInsights();
    expect(recurring.find((r) => r.label === 'Cinema')).toBeUndefined();
  });

  it('detecta recorrente a partir de três meses distintos', async () => {
    await addExpense('Netflix', 39.9, 3);
    await addExpense('Netflix', 39.9, 2);
    await addExpense('Netflix', 39.9, 1);

    const { recurring } = await getInsights();
    const netflix = recurring.find((r) => r.label === 'Netflix');

    expect(netflix).toBeDefined();
    expect(netflix.typicalAmount).toBe(39.9);
    expect(netflix.occurrences).toBe(3);
  });

  it('ignora o que varia na descrição — "Netflix 12/2025" é a mesma assinatura', async () => {
    await addExpense('Spotify 10/2025', 21.9, 3, 8);
    await addExpense('Spotify 11/2025', 21.9, 2, 8);
    await addExpense('SPOTIFY 12/2025', 21.9, 1, 8);

    const { recurring } = await getInsights();
    const spotify = recurring.filter((r) => r.label.toLowerCase().includes('spotify'));

    // Um grupo só, não três — senão a projeção contaria a assinatura 3x.
    expect(spotify).toHaveLength(1);
    expect(spotify[0].occurrences).toBe(3);
  });

  it('aceita variação de valor — conta de luz não é fixa', async () => {
    await addExpense('Energia', 180, 3, 20);
    await addExpense('Energia', 210, 2, 20);
    await addExpense('Energia', 195, 1, 20);

    const { recurring } = await getInsights();
    const energia = recurring.find((r) => r.label === 'Energia');

    expect(energia).toBeDefined();
    expect(energia.typicalAmount).toBe(195); // mediana, não média
  });

  it('não confunde valores muito diferentes com recorrência', async () => {
    await addExpense('Mercado', 50, 3);
    await addExpense('Mercado', 800, 2);
    await addExpense('Mercado', 30, 1);

    const { recurring } = await getInsights();
    expect(recurring.find((r) => r.label === 'Mercado')).toBeUndefined();
  });

  it('soma o custo recorrente mensal', async () => {
    const { monthlyRecurringCost, recurring } = await getInsights();
    const expected = recurring
      .filter((r) => r.type === 'expense')
      .reduce((sum, r) => sum + r.typicalAmount, 0);

    expect(monthlyRecurringCost).toBeCloseTo(expected, 2);
  });

  describe('projeção', () => {
    it('parte do saldo atual e desconta o que ainda vai cair', async () => {
      const { projection } = await getInsights();

      expect(projection.currentBalance).toBeDefined();
      expect(projection.projected).toBeCloseTo(
        projection.currentBalance + projection.expectedIncome - projection.expectedExpense,
        2
      );
    });

    it('não conta de novo a recorrente que já caiu este mês', async () => {
      // Energia costuma cair dia 20 — ainda não chegou (hoje é 15), então entra.
      const antes = await getInsights();
      const energiaAntes = antes.projection.upcoming.find((u) => u.label === 'Energia');
      expect(energiaAntes).toBeDefined();

      // Agora ela caiu. Não pode ser projetada outra vez.
      await Transaction.create({
        userId,
        accountId: conta.id,
        type: 'expense',
        amount: 200,
        category: 'Contas',
        description: 'Energia',
        occurredAt: new Date(2026, 6, 14)
      });

      const depois = await getInsights();
      expect(depois.projection.upcoming.find((u) => u.label === 'Energia')).toBeUndefined();
    });

    it('não projeta recorrente cujo dia já passou', async () => {
      const { projection } = await getInsights();
      // Netflix cai dia 5; hoje é 15 — já passou, não entra na projeção.
      expect(projection.upcoming.find((u) => u.label === 'Netflix')).toBeUndefined();
    });
  });
});
