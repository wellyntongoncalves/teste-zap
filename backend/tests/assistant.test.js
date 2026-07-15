// O SDK é mockado: os testes NUNCA fazem uma chamada real (não gasta chave e
// não depende de rede). O que importa aqui é o contrato — o que mandamos, como
// tratamos a resposta e como traduzimos cada erro em status HTTP.
const mockCreate = jest.fn();

class MockAPIError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
class MockRateLimitError extends MockAPIError {}
class MockAuthenticationError extends MockAPIError {}
class MockAPIConnectionError extends MockAPIError {}

jest.mock('@anthropic-ai/sdk', () => {
  const Anthropic = jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate }
  }));
  Anthropic.APIError = MockAPIError;
  Anthropic.RateLimitError = MockRateLimitError;
  Anthropic.AuthenticationError = MockAuthenticationError;
  Anthropic.APIConnectionError = MockAPIConnectionError;
  return Anthropic;
});

const request = require('supertest');
const app = require('../server');
const sequelize = require('../config/database');
const Account = require('../models/account');
const Transaction = require('../models/transaction');

function textReply(text, stopReason = 'end_turn') {
  return { content: [{ type: 'text', text }], stop_reason: stopReason };
}

async function registerUser(email = 'vero@test.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Teste Vero', email, password: 'senha12345' });
  return { token: res.body.token, user: res.body.user };
}

describe('Vero (/api/assistant)', () => {
  let token;
  let account;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    const registered = await registerUser();
    token = registered.token;
    account = await Account.findOne({ where: { userId: registered.user.id } });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(() => {
    mockCreate.mockReset();
    process.env.ANTHROPIC_API_KEY = 'sk-ant-fake-para-teste';
  });

  it('exige autenticação', async () => {
    await request(app).post('/api/assistant').send({ question: 'oi' }).expect(401);
  });

  it('rejeita pergunta vazia', async () => {
    await request(app)
      .post('/api/assistant')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '   ' })
      .expect(400);

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejeita pergunta longa demais', async () => {
    await request(app)
      .post('/api/assistant')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'a'.repeat(1001) })
      .expect(400);

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('responde a pergunta e devolve o texto', async () => {
    mockCreate.mockResolvedValue(textReply('Você gastou R$ 50,00 com Alimentação.'));

    const res = await request(app)
      .post('/api/assistant')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'quanto gastei com alimentação?' })
      .expect(200);

    expect(res.body.answer).toBe('Você gastou R$ 50,00 com Alimentação.');
    expect(res.body.refused).toBe(false);
  });

  it('manda os parâmetros que o Opus 4.8 aceita — e nenhum dos removidos', async () => {
    mockCreate.mockResolvedValue(textReply('ok'));

    await request(app)
      .post('/api/assistant')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'e aí?' })
      .expect(200);

    const params = mockCreate.mock.calls[0][0];
    expect(params.model).toBe('claude-opus-4-8');
    expect(params.thinking).toEqual({ type: 'adaptive' });
    expect(params.output_config).toEqual({ effort: 'high' });

    // Removidos no Opus 4.8: enviar qualquer um destes devolve 400 da API.
    expect(params.temperature).toBeUndefined();
    expect(params.top_p).toBeUndefined();
    expect(params.top_k).toBeUndefined();
    expect(params.thinking.budget_tokens).toBeUndefined();
  });

  it('injeta o retrato financeiro real do usuário no prompt', async () => {
    await Transaction.create({
      userId: account.userId,
      accountId: account.id,
      type: 'expense',
      amount: 137.5,
      category: 'Alimentação',
      description: 'Mercado da esquina',
      occurredAt: new Date()
    });

    mockCreate.mockResolvedValue(textReply('ok'));

    await request(app)
      .post('/api/assistant')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'quanto gastei?' })
      .expect(200);

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Alimentação');
    expect(prompt).toContain('137.50');
    expect(prompt).toContain('Mercado da esquina');
    expect(prompt).toContain('quanto gastei?');
  });

  it('trata recusa do modelo sem quebrar (content vem vazio)', async () => {
    mockCreate.mockResolvedValue({ content: [], stop_reason: 'refusal' });

    const res = await request(app)
      .post('/api/assistant')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'algo que o classificador recusa' })
      .expect(200);

    expect(res.body.refused).toBe(true);
    expect(res.body.answer).toContain('Não consigo responder');
  });

  it('sem ANTHROPIC_API_KEY devolve 503, não 500', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const res = await request(app)
      .post('/api/assistant')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'oi' })
      .expect(503);

    expect(res.body.error).toContain('ANTHROPIC_API_KEY');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rate limit da Anthropic vira 429, não 500', async () => {
    mockCreate.mockRejectedValue(new MockRateLimitError(429, 'rate limited'));

    await request(app)
      .post('/api/assistant')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'oi' })
      .expect(429);
  });

  it('chave inválida vira 503', async () => {
    mockCreate.mockRejectedValue(new MockAuthenticationError(401, 'bad key'));

    await request(app)
      .post('/api/assistant')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'oi' })
      .expect(503);
  });

  it('falha de rede vira 503', async () => {
    mockCreate.mockRejectedValue(new MockAPIConnectionError(0, 'offline'));

    await request(app)
      .post('/api/assistant')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'oi' })
      .expect(503);
  });

  it('erro genérico da API vira 502', async () => {
    mockCreate.mockRejectedValue(new MockAPIError(500, 'boom'));

    await request(app)
      .post('/api/assistant')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'oi' })
      .expect(502);
  });

  describe('GET /status', () => {
    it('diz que está ligado quando há chave', async () => {
      const res = await request(app)
        .get('/api/assistant/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.enabled).toBe(true);
    });

    it('diz que está desligado sem chave', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      const res = await request(app)
        .get('/api/assistant/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.enabled).toBe(false);
    });
  });
});
