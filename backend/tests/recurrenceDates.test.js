// Só as funções puras de data — não toca no banco de propósito: a regra de
// "todo dia 31" e o cursor de geração são onde mora o risco de erro.
const { dueDate, dueDatesUpTo, nextDueDate } = require('../services/recurrences');

const base = { dayOfMonth: 10, startDate: '2026-05-10', endDate: null, lastRunOn: null };

describe('dueDate', () => {
  it('encaixa o dia 31 no último dia de meses curtos', () => {
    expect(dueDate(2024, 1, 31)).toBe('2024-02-29');
    expect(dueDate(2026, 1, 31)).toBe('2026-02-28');
    expect(dueDate(2026, 3, 31)).toBe('2026-04-30');
  });

  it('mantém o dia quando ele existe no mês', () => {
    expect(dueDate(2026, 6, 10)).toBe('2026-07-10');
  });
});

describe('dueDatesUpTo', () => {
  it('gera todos os vencimentos desde o início da regra', () => {
    expect(dueDatesUpTo(base, '2026-07-19')).toEqual(['2026-05-10', '2026-06-10', '2026-07-10']);
  });

  it('não gera vencimento futuro', () => {
    expect(dueDatesUpTo({ ...base, dayOfMonth: 25 }, '2026-07-19')).toEqual(['2026-05-25', '2026-06-25']);
  });

  it('não repete o que o cursor já gerou', () => {
    expect(dueDatesUpTo({ ...base, lastRunOn: '2026-06-10' }, '2026-07-19')).toEqual(['2026-07-10']);
    expect(dueDatesUpTo({ ...base, lastRunOn: '2026-07-10' }, '2026-07-19')).toEqual([]);
  });

  it('para no fim da regra', () => {
    expect(dueDatesUpTo({ ...base, endDate: '2026-06-30', lastRunOn: '2026-05-10' }, '2026-07-19'))
      .toEqual(['2026-06-10']);
  });

  it('ignora regra que ainda vai começar', () => {
    expect(dueDatesUpTo({ ...base, startDate: '2026-09-01' }, '2026-07-19')).toEqual([]);
  });

  it('limita quantos lançamentos nascem de uma vez', () => {
    expect(dueDatesUpTo({ ...base, startDate: '2000-01-10' }, '2026-07-19')).toHaveLength(24);
  });
});

describe('nextDueDate', () => {
  it('pula pro mês seguinte quando o deste mês já rodou', () => {
    expect(nextDueDate({ ...base, lastRunOn: '2026-07-10' }, '2026-07-19')).toBe('2026-08-10');
  });

  it('aponta o vencimento que ainda vem neste mês', () => {
    expect(nextDueDate({ ...base, dayOfMonth: 25, lastRunOn: '2026-06-25' }, '2026-07-19')).toBe('2026-07-25');
  });

  it('aceita hoje como próxima cobrança', () => {
    expect(nextDueDate({ ...base, dayOfMonth: 19, lastRunOn: '2026-06-19' }, '2026-07-19')).toBe('2026-07-19');
  });

  it('usa a data de início quando a regra ainda não começou', () => {
    expect(nextDueDate({ ...base, startDate: '2026-09-10' }, '2026-07-19')).toBe('2026-09-10');
  });

  it('não tem próxima depois do fim da regra', () => {
    expect(nextDueDate({ ...base, endDate: '2026-07-15', lastRunOn: '2026-07-10' }, '2026-07-19')).toBeNull();
  });
});
