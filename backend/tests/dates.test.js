const { toOccurredAt, noonUtc } = require('../services/dates');

describe('services/dates — âncora de data ao meio-dia UTC', () => {
  test('data-only YYYY-MM-DD vira meio-dia UTC do mesmo dia', () => {
    expect(toOccurredAt('2026-07-16').toISOString()).toBe('2026-07-16T12:00:00.000Z');
  });

  test('meia-noite UTC é reancorada ao meio-dia do mesmo dia (conserta o off-by-one)', () => {
    expect(toOccurredAt('2026-07-16T00:00:00.000Z').toISOString()).toBe('2026-07-16T12:00:00.000Z');
  });

  test('timestamp já ao meio-dia UTC não muda', () => {
    expect(toOccurredAt('2026-03-05T12:00:00.000Z').toISOString()).toBe('2026-03-05T12:00:00.000Z');
  });

  test('instante de madrugada usa a data UTC dele, ao meio-dia', () => {
    expect(toOccurredAt('2026-07-16T01:00:00.000Z').toISOString()).toBe('2026-07-16T12:00:00.000Z');
  });

  test('vazio/ausente vira hoje (data UTC) ao meio-dia', () => {
    const hoje = new Date().toISOString().slice(0, 10);
    expect(toOccurredAt().toISOString()).toBe(`${hoje}T12:00:00.000Z`);
    expect(toOccurredAt('').toISOString()).toBe(`${hoje}T12:00:00.000Z`);
  });

  test('valor inválido vira Invalid Date (deixa o Sequelize rejeitar com 400)', () => {
    expect(Number.isNaN(toOccurredAt('lixo').getTime())).toBe(true);
  });

  test('noonUtc monta o meio-dia UTC a partir de YYYY-MM-DD', () => {
    expect(noonUtc('2026-01-01').toISOString()).toBe('2026-01-01T12:00:00.000Z');
  });
});
