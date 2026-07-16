const Anthropic = require('@anthropic-ai/sdk');
const Transaction = require('../models/transaction');
const { parseMessage } = require('./nlp');

// Interpretar "almocei com a galera, saiu 80 pila" é o tipo de coisa que
// palavra-chave não pega. Mas o regex acerta o caso comum, é instantâneo e não
// custa nada — então ele continua sendo a primeira tentativa. O LLM entra só
// quando o regex falha, e se o LLM também falhar voltamos pro regex.
const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 1024;

let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

function isEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SCHEMA = {
  type: 'object',
  properties: {
    understood: {
      type: 'boolean',
      description: 'true se a mensagem descreve mesmo um lançamento financeiro com valor'
    },
    amount: { type: ['number', 'null'], description: 'Valor em reais, positivo' },
    type: { type: 'string', enum: ['income', 'expense', 'transfer'] },
    category: { type: 'string', enum: Transaction.CATEGORIES },
    description: { type: ['string', 'null'], description: 'Descrição curta e limpa, sem o valor' }
  },
  required: ['understood', 'amount', 'type', 'category', 'description'],
  additionalProperties: false
};

const SYSTEM = [
  'Você extrai lançamentos financeiros de mensagens informais em português do Brasil.',
  '',
  'Regras:',
  '- "understood" só é true se houver mesmo um valor e um gasto/recebimento.',
  '- Gírias de dinheiro contam: pila, conto, mangos, pau, real. "80 pila" = 80.',
  '- "k" e "mil" multiplicam: "2k" = 2000, "1,5 mil" = 1500.',
  '- Escolha a categoria mais próxima da lista. Na dúvida use "Outros".',
  '- "description" é uma etiqueta curta ("almoço com a equipe"), sem o valor.',
  '- Se a mensagem não descreve um lançamento, understood = false.'
].join('\n');

// Estruturado: sem isso teríamos que parsear texto livre e torcer.
async function extract(text) {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: text }]
  });

  if (message.stop_reason === 'refusal') return null;

  const block = message.content.find((b) => b.type === 'text');
  if (!block) return null;

  const parsed = JSON.parse(block.text);
  if (!parsed.understood || !parsed.amount || parsed.amount <= 0) return null;

  // O modelo é instruído a usar a lista, mas category é um ENUM no banco:
  // um valor fora dela derrubaria a query em vez de virar um erro tratável.
  const category = Transaction.CATEGORIES.includes(parsed.category) ? parsed.category : 'Outros';

  return {
    amount: parsed.amount,
    type: Transaction.TYPES.includes(parsed.type) ? parsed.type : 'expense',
    category,
    description: parsed.description || text.trim(),
    valid: true,
    source: 'llm'
  };
}

async function parseMessageSmart(text) {
  const byRegex = parseMessage(text);
  if (byRegex.valid) return { ...byRegex, source: 'regex' };

  if (!isEnabled()) return byRegex;

  try {
    const byLlm = await extract(text);
    return byLlm || byRegex;
  } catch (err) {
    // Uma falha da API não pode impedir o usuário de lançar um gasto: se o
    // regex já tinha desistido, devolvemos a desistência dele e seguimos.
    console.warn('NLP por LLM falhou, mantendo o regex:', err.message);
    return byRegex;
  }
}

module.exports = { parseMessageSmart, isEnabled };
