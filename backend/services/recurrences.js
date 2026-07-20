// Materialização de contas fixas.
//
// Uma recorrência é uma REGRA ("todo dia 10, R$ 1.800 de aluguel"), não um
// lançamento. Este serviço traduz a regra em lançamentos reais até a data de
// hoje — nada de datas futuras, senão o saldo do mês mentiria.
//
// Não existe cron aqui: o backend é serverless e não tem processo vivo pra
// acordar às 00h. A geração acontece de forma preguiçosa, na primeira vez que o
// usuário abre o app no mês (ver routes/transactions.js). É barato: quando não
// há nada vencido, o custo é uma única consulta.
const Recurrence = require('../models/recurrence');
const Transaction = require('../models/transaction');
const { noonUtc } = require('./dates');
const { appendTransactionNote } = require('./obsidian');

// Teto por execução: uma regra com data de início muito antiga não pode despejar
// centenas de lançamentos numa requisição só. O resto vem na próxima chamada.
const MAX_PER_RUN = 24;

const pad = (n) => String(n).padStart(2, '0');

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Vencimento do mês, em "YYYY-MM-DD". Dia 31 em fevereiro vira o dia 28/29:
// quem escolhe "todo dia 31" quer dizer "no último dia", não "pula fevereiro".
function dueDate(year, monthIndex, dayOfMonth) {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return `${year}-${pad(monthIndex + 1)}-${pad(Math.min(dayOfMonth, lastDay))}`;
}

// Datas ISO ordenam como texto, então comparar com < e > é seguro aqui.
function* schedule(rule, fromIso) {
  const [y, m] = fromIso.split('-').map(Number);
  let year = y;
  let monthIndex = m - 1;

  for (let i = 0; i < 600; i += 1) {
    yield dueDate(year, monthIndex, rule.dayOfMonth);
    monthIndex += 1;
    if (monthIndex > 11) {
      monthIndex = 0;
      year += 1;
    }
  }
}

// Vencimentos ainda não materializados, do início da regra até hoje.
function dueDatesUpTo(rule, today = todayIso()) {
  const limit = rule.endDate && rule.endDate < today ? rule.endDate : today;
  // Começa do mês do cursor (último gerado) ou do início da regra — o que for
  // mais recente. Sem isso, uma regra antiga percorreria anos de meses à toa.
  const from = rule.lastRunOn && rule.lastRunOn > rule.startDate ? rule.lastRunOn : rule.startDate;

  const dates = [];
  for (const date of schedule(rule, from)) {
    if (date > limit) break;
    if (date >= rule.startDate && (!rule.lastRunOn || date > rule.lastRunOn)) {
      dates.push(date);
      if (dates.length >= MAX_PER_RUN) break;
    }
  }
  return dates;
}

function nextDay(iso) {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Próximo vencimento — o que a tela mostra como "próxima cobrança".
// Null quando a regra já terminou (endDate no passado).
function nextDueDate(rule, today = todayIso()) {
  // O piso é o mais tarde entre: hoje, o início da regra e o dia seguinte ao
  // último vencimento já gerado (esse já virou lançamento, não conta de novo).
  const floor = [today, rule.startDate, rule.lastRunOn ? nextDay(rule.lastRunOn) : '']
    .reduce((a, b) => (b > a ? b : a));

  for (const date of schedule(rule, floor)) {
    if (date >= floor) return rule.endDate && date > rule.endDate ? null : date;
  }
  return null;
}

// Postgres devolve 23505 quando o índice único (recurrence_id, occurred_at)
// barra a duplicata — sinal de que outra requisição já criou este vencimento.
function isDuplicate(err) {
  return err?.name === 'SequelizeUniqueConstraintError' || err?.parent?.code === '23505';
}

// `user` precisa ser o registro do usuário (a nota do Obsidian é por e-mail).
async function materializeRecurrences(user, today = todayIso()) {
  const userId = user.id;
  const rules = await Recurrence.findAll({ where: { userId, active: true } });
  if (rules.length === 0) return { created: [] };

  const created = [];

  for (const rule of rules) {
    for (const date of dueDatesUpTo(rule, today)) {
      try {
        const transaction = await Transaction.create({
          userId: rule.userId,
          accountId: rule.accountId,
          type: rule.type,
          amount: rule.amount,
          category: Transaction.CATEGORIES.includes(rule.category) ? rule.category : 'Outros',
          description: rule.description,
          source: 'dashboard',
          occurredAt: noonUtc(date),
          recurrenceId: rule.id
        });
        created.push(transaction);

        // O cérebro no Obsidian precisa ver a conta fixa como qualquer outro
        // lançamento. Falha aqui (GitHub fora do ar) não pode derrubar a
        // requisição que só queria listar transações.
        try {
          await appendTransactionNote(user, transaction);
        } catch (noteErr) {
          console.warn('Nota do Obsidian falhou na recorrência:', noteErr.message);
        }
      } catch (err) {
        if (!isDuplicate(err)) throw err;
      }
      // Avança o cursor mesmo quando a criação esbarrou na duplicata: o
      // vencimento existe, e insistir nele travaria a regra pra sempre.
      await rule.update({ lastRunOn: date });
    }
  }

  return { created };
}

module.exports = { materializeRecurrences, dueDatesUpTo, nextDueDate, dueDate, todayIso };
