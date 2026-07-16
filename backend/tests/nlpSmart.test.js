// SDK mockado: os testes não gastam chave nem dependem de rede. O que importa
// é o contrato — quando o LLM é chamado, quando NÃO é, e o que acontece quando
// ele falha.
const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } }));
  Anthropic.APIError = class extends Error {};
  return Anthropic;
});

const { parseMessageSmart } = require('../services/nlpSmart');

function llmReply(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }], stop_reason: 'end_turn' };
}

describe('NLP híbrido (regex + LLM)', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    process.env.ANTHROPIC_API_KEY = 'sk-ant-fake';
  });

  it('o regex resolve o caso comum sozinho — não gasta chamada', async () => {
    const result = await parseMessageSmart('Gastei 50 reais no mercado');

    expect(result.valid).toBe(true);
    expect(result.amount).toBe(50);
    expect(result.source).toBe('regex');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('só chama o LLM quando o regex desiste', async () => {
    mockCreate.mockResolvedValue(
      llmReply({
        understood: true,
        amount: 80,
        type: 'expense',
        category: 'Alimentação',
        description: 'almoço com a galera'
      })
    );

    const result = await parseMessageSmart('almocei com a galera, saiu 80 pila');

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.valid).toBe(true);
    expect(result.amount).toBe(80);
    expect(result.category).toBe('Alimentação');
    expect(result.source).toBe('llm');
  });

  it('categoria fora do ENUM vira "Outros" em vez de derrubar a query', async () => {
    mockCreate.mockResolvedValue(
      llmReply({
        understood: true,
        amount: 30,
        type: 'expense',
        category: 'Categoria Inventada',
        description: 'algo'
      })
    );

    const result = await parseMessageSmart('paguei trinta pila numa parada aí');
    expect(result.category).toBe('Outros');
  });

  it('LLM dizendo que não entendeu devolve inválido — não inventa lançamento', async () => {
    mockCreate.mockResolvedValue(
      llmReply({ understood: false, amount: null, type: 'expense', category: 'Outros', description: null })
    );

    const result = await parseMessageSmart('bom dia, tudo certo?');
    expect(result.valid).toBe(false);
  });

  it('falha da API não impede o usuário de usar o app', async () => {
    mockCreate.mockRejectedValue(new Error('boom'));

    const result = await parseMessageSmart('almocei com a galera, saiu 80 pila');
    expect(result.valid).toBe(false); // volta pro veredito do regex, sem estourar
  });

  it('sem chave configurada, não tenta o LLM', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const result = await parseMessageSmart('almocei com a galera, saiu 80 pila');

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.valid).toBe(false);
  });

  it('recusa do modelo não vira lançamento', async () => {
    mockCreate.mockResolvedValue({ content: [], stop_reason: 'refusal' });

    const result = await parseMessageSmart('algo estranho aí');
    expect(result.valid).toBe(false);
  });
});
