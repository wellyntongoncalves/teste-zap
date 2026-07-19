const { formatBRL } = require('../services/money');

// Intl pt-BR separa "R$" do numero com NBSP (U+00A0); normalizamos pra espaco
// comum antes de comparar, senao a igualdade textual falharia por um byte invisivel.
const norm = (s) => s.replace(/[\s ]/g, ' ');

describe('formatBRL', () => {
  test.each([
    [80, 'R$ 80,00'],
    [1234.56, 'R$ 1.234,56'],
    [0, 'R$ 0,00'],
    ['75.50', 'R$ 75,50'],
    [3185.44, 'R$ 3.185,44']
  ])('formata %s como %s (padrao pt-BR)', (input, expected) => {
    expect(norm(formatBRL(input))).toBe(expected);
  });

  test('trata valor invalido como zero', () => {
    expect(norm(formatBRL(null))).toBe('R$ 0,00');
    expect(norm(formatBRL(undefined))).toBe('R$ 0,00');
    expect(norm(formatBRL('abc'))).toBe('R$ 0,00');
  });
});
