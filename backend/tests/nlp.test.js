const { parseMessage, parseAmount, detectCategory, isGreeting } = require('../services/nlp');

describe('parseMessage', () => {
  test('extrai valor e categoria de "Gastei 50 reais no mercado"', () => {
    const result = parseMessage('Gastei 50 reais no mercado');
    expect(result.valid).toBe(true);
    expect(result.amount).toBe(50);
    expect(result.category).toBe('Alimentação');
  });

  test('extrai valor com R$ e vírgula decimal, categoria Contas', () => {
    const result = parseMessage('Paguei R$ 120,50 de energia');
    expect(result.valid).toBe(true);
    expect(result.amount).toBeCloseTo(120.5);
    expect(result.category).toBe('Contas');
  });

  test('usa categoria Outros quando não reconhece nenhuma palavra-chave', () => {
    const result = parseMessage('Gastei 30 reais com o carro');
    expect(result.category).toBe('Outros');
  });

  test('retorna valid=false quando não encontra valor na mensagem', () => {
    const result = parseMessage('Oi, tudo bem?');
    expect(result.valid).toBe(false);
    expect(result.amount).toBeNull();
  });
});

describe('parseAmount', () => {
  test('lida com separador de milhar e decimal (1.234,56)', () => {
    expect(parseAmount('Gastei R$ 1.234,56 na loja')).toBeCloseTo(1234.56);
  });

  test('lida com "reais" sem R$', () => {
    expect(parseAmount('gastei 45 reais')).toBe(45);
  });

  test('retorna null quando não há valor', () => {
    expect(parseAmount('sem nenhum número aqui')).toBeNull();
  });
});

describe('detectCategory', () => {
  test('reconhece Alimentação por "ifood"', () => {
    expect(detectCategory('Pedido no ifood 35 reais')).toBe('Alimentação');
  });

  test('reconhece Transporte por "uber"', () => {
    expect(detectCategory('uber para o trabalho 18 reais')).toBe('Transporte');
  });

  test('reconhece Saúde por "farmácia"', () => {
    expect(detectCategory('comprei remédio na farmácia 22 reais')).toBe('Saúde');
  });
});

describe('isGreeting', () => {
  test.each(['oi', 'Olá', 'bom dia', 'ajuda', 'menu', 'help', 'oi tudo bem'])(
    'reconhece saudação/ajuda: %s',
    (msg) => expect(isGreeting(msg)).toBe(true)
  );

  test.each(['gastei 50 no mercado', 'recebi 3000 de salário', 'quanto gastei esse mês'])(
    'não confunde lançamento/pergunta com saudação: %s',
    (msg) => expect(isGreeting(msg)).toBe(false)
  );

  test('mensagem com valor não é saudação, mesmo contendo "ajuda"', () => {
    expect(isGreeting('ajuda de custo recebi 200')).toBe(false);
  });
});
