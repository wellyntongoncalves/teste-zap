const Anthropic = require('@anthropic-ai/sdk');
const { Op, fn, col } = require('sequelize');
const Transaction = require('../models/transaction');
const Account = require('../models/account');
const Budget = require('../models/budget');
const Goal = require('../models/goal');
const Tag = require('../models/tag');
const { computeBalances } = require('./balance');
const { buildInsights } = require('./insights');
const { formatBRL } = require('./money');

// Opus 4.8: `budget_tokens` e os parâmetros de sampling (temperature/top_p/top_k)
// foram REMOVIDOS e retornam 400. A profundidade de raciocínio se controla com
// thinking adaptativo + effort.
const MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 16000;
const RECENT_LIMIT = 20;

const TYPE_LABELS = { income: 'Receita', expense: 'Despesa', transfer: 'Transferência' };

class AssistantNotConfiguredError extends Error {
  constructor() {
    super('O Vero precisa da ANTHROPIC_API_KEY para funcionar.');
    this.name = 'AssistantNotConfiguredError';
  }
}

function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Cliente preguiçoso: o construtor lança se não houver chave, e o resto da API
// precisa subir normalmente mesmo com o Vero desligado.
let client = null;
function getClient() {
  if (!isConfigured()) throw new AssistantNotConfiguredError();
  if (!client) client = new Anthropic();
  return client;
}

function monthRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

function brl(value) {
  return formatBRL(value);
}

async function sumBy(where) {
  const rows = await Transaction.findAll({
    attributes: [[fn('SUM', col('amount')), 'total']],
    where,
    raw: true
  });
  return parseFloat(rows[0]?.total) || 0;
}

async function monthTotals(userId, date) {
  const { start, end } = monthRange(date);
  const base = { userId, occurredAt: { [Op.gte]: start, [Op.lt]: end } };

  const [income, expense] = await Promise.all([
    sumBy({ ...base, type: 'income' }),
    sumBy({ ...base, type: 'expense' })
  ]);

  return { income, expense, net: income - expense };
}

async function expensesByCategory(userId, date) {
  const { start, end } = monthRange(date);
  const rows = await Transaction.findAll({
    attributes: ['category', [fn('SUM', col('amount')), 'total']],
    where: { userId, type: 'expense', occurredAt: { [Op.gte]: start, [Op.lt]: end } },
    group: ['category'],
    raw: true
  });

  return rows
    .map((row) => ({ category: row.category, total: parseFloat(row.total) }))
    .sort((a, b) => b.total - a.total);
}

async function budgetStatus(userId, date) {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const { start, end } = monthRange(date);

  const budgets = await Budget.findAll({
    where: { userId, [Op.or]: [{ recurring: true }, { recurring: false, month, year }] },
    include: [{ model: Tag, attributes: ['id', 'name'] }]
  });

  return Promise.all(
    budgets.map(async (budget) => {
      const label = budget.category || budget.Tag?.name || '—';
      let spent = 0;

      if (budget.category) {
        spent = await sumBy({
          userId,
          type: 'expense',
          category: budget.category,
          occurredAt: { [Op.gte]: start, [Op.lt]: end }
        });
      } else if (budget.tagId) {
        const tagged = await Transaction.findAll({
          where: { userId, type: 'expense', occurredAt: { [Op.gte]: start, [Op.lt]: end } },
          include: [{ model: Tag, where: { id: budget.tagId }, attributes: [] }]
        });
        spent = tagged.reduce((sum, t) => sum + parseFloat(t.amount), 0);
      }

      const amount = parseFloat(budget.amount);
      return { label, amount, spent, remaining: amount - spent };
    })
  );
}

async function buildContext(user) {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const { start } = monthRange(now);

  const [thisMonth, previousMonth, byCategory, accounts, budgets, goals, recent, insights] = await Promise.all([
    monthTotals(user.id, now),
    monthTotals(user.id, lastMonth),
    expensesByCategory(user.id, now),
    Account.findAll({ where: { userId: user.id, archivedAt: null }, order: [['createdAt', 'ASC']] }),
    budgetStatus(user.id, now),
    Goal.findAll({ where: { userId: user.id, status: 'active' }, order: [['createdAt', 'ASC']] }),
    Transaction.findAll({
      where: { userId: user.id },
      order: [['occurredAt', 'DESC']],
      limit: RECENT_LIMIT
    }),
    buildInsights(user.id, now)
  ]);

  return {
    today: now,
    monthStart: start,
    thisMonth,
    previousMonth,
    byCategory,
    accounts: await computeBalances(accounts),
    budgets,
    goals,
    recent,
    insights
  };
}

// O contexto vira texto porque é o que o modelo lê melhor — e mantém o prompt
// pequeno e auditável (dá pra logar exatamente o que o Vero viu).
function formatContext(ctx) {
  const monthName = ctx.monthStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const lines = [];

  lines.push(`Hoje é ${ctx.today.toLocaleDateString('pt-BR')}. Mês corrente: ${monthName}.`);

  lines.push('', '## Totais do mês corrente');
  lines.push(`- Receitas: ${brl(ctx.thisMonth.income)}`);
  lines.push(`- Despesas: ${brl(ctx.thisMonth.expense)}`);
  lines.push(`- Saldo do mês: ${brl(ctx.thisMonth.net)}`);

  lines.push('', '## Mês anterior (para comparação)');
  lines.push(`- Receitas: ${brl(ctx.previousMonth.income)} | Despesas: ${brl(ctx.previousMonth.expense)} | Saldo: ${brl(ctx.previousMonth.net)}`);

  lines.push('', '## Despesas por categoria (mês corrente)');
  if (ctx.byCategory.length === 0) {
    lines.push('- (nenhuma despesa registrada)');
  } else {
    ctx.byCategory.forEach((row) => lines.push(`- ${row.category}: ${brl(row.total)}`));
  }

  lines.push('', '## Contas (saldo atual)');
  if (ctx.accounts.length === 0) {
    lines.push('- (nenhuma conta)');
  } else {
    ctx.accounts.forEach((a) => lines.push(`- ${a.name} (${a.type}): ${brl(a.balance)}`));
  }

  lines.push('', '## Orçamentos do mês');
  if (ctx.budgets.length === 0) {
    lines.push('- (nenhum orçamento definido)');
  } else {
    ctx.budgets.forEach((b) => {
      const status = b.remaining < 0 ? `ESTOUROU em ${brl(Math.abs(b.remaining))}` : `resta ${brl(b.remaining)}`;
      lines.push(`- ${b.label}: orçado ${brl(b.amount)}, gasto ${brl(b.spent)} — ${status}`);
    });
  }

  lines.push('', '## Metas ativas');
  if (ctx.goals.length === 0) {
    lines.push('- (nenhuma meta ativa)');
  } else {
    ctx.goals.forEach((g) => {
      const target = parseFloat(g.targetAmount);
      const current = parseFloat(g.currentAmount);
      const pct = target > 0 ? Math.round((current / target) * 100) : 0;
      const due = g.targetDate ? ` — prazo ${new Date(g.targetDate).toLocaleDateString('pt-BR')}` : '';
      lines.push(`- ${g.name}: ${brl(current)} de ${brl(target)} (${pct}%)${due}`);
    });
  }

  const { recurring, monthlyRecurringCost, projection } = ctx.insights;

  lines.push('', '## Cobranças recorrentes detectadas');
  if (recurring.length === 0) {
    lines.push('- (nenhum padrão recorrente identificado ainda)');
  } else {
    lines.push(`Custo fixo mensal estimado: ${brl(monthlyRecurringCost)}`);
    recurring.forEach((r) => {
      const label = r.type === 'income' ? 'entra' : 'sai';
      lines.push(`- ${r.label} (${r.category}): ${brl(r.typicalAmount)} — ${label} todo dia ${r.typicalDay}, visto em ${r.occurrences} meses`);
    });
  }

  lines.push('', '## Projeção pro fim do mês');
  lines.push(`- Saldo somando todas as contas hoje: ${brl(projection.currentBalance)}`);
  lines.push(`- Ainda deve entrar: ${brl(projection.expectedIncome)} | ainda deve sair: ${brl(projection.expectedExpense)}`);
  lines.push(`- Projeção de saldo no fim do mês: ${brl(projection.projected)} (faltam ${projection.daysLeft} dias)`);

  lines.push('', `## Últimas ${ctx.recent.length} transações`);
  if (ctx.recent.length === 0) {
    lines.push('- (nenhuma transação)');
  } else {
    ctx.recent.forEach((t) => {
      const date = new Date(t.occurredAt).toLocaleDateString('pt-BR');
      const type = TYPE_LABELS[t.type] || t.type;
      const desc = t.description ? ` — ${t.description}` : '';
      lines.push(`- ${date} | ${type} | ${t.category} | ${brl(t.amount)}${desc}`);
    });
  }

  return lines.join('\n');
}

function buildSystemPrompt(user) {
  return [
    `Você é o Vero, o assistente financeiro do app MeuBolso. Fala com ${user.name || 'o usuário'} em português do Brasil.`,
    '',
    'Você recebe um retrato das finanças reais dele. Responda com base NELE, nunca invente números.',
    '',
    'Como responder:',
    '- Direto ao ponto. Comece pela resposta, não pelo raciocínio.',
    '- Use os valores exatos do contexto e formate como R$ 1.234,56.',
    '- Se o contexto não tiver o dado, diga o que falta em vez de estimar.',
    '- Quando fizer sentido, aponte UMA observação útil (categoria que subiu, orçamento estourando).',
    '- Tom de quem entende de dinheiro e respeita o do outro: sem julgar, sem sermão, sem emoji.',
    '- Não dê conselho de investimento específico nem recomende produtos financeiros.',
    '',
    'O contexto cobre o mês corrente, o anterior e as últimas transações. Perguntas sobre períodos',
    'fora disso você não consegue responder — diga isso claramente.'
  ].join('\n');
}

function extractText(message) {
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

async function ask(user, question) {
  const anthropic = getClient();
  const context = await buildContext(user);

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: buildSystemPrompt(user),
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    messages: [
      {
        role: 'user',
        content: `Retrato das minhas finanças:\n\n${formatContext(context)}\n\n---\n\nMinha pergunta: ${question}`
      }
    ]
  });

  // Classificadores de segurança podem recusar: a resposta vem 200 com
  // stop_reason 'refusal' e content vazio. Ler content[0] direto quebraria.
  if (message.stop_reason === 'refusal') {
    return { answer: 'Não consigo responder essa pergunta. Tente reformular focando nas suas finanças.', refused: true };
  }

  return { answer: extractText(message), refused: false };
}

module.exports = { ask, buildContext, formatContext, isConfigured, AssistantNotConfiguredError };
