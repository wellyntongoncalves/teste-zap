const { isQuestion, parseMessage } = require('../services/nlp');

describe('Roteamento WhatsApp: pergunta vs lançamento', () => {
  describe('reconhece pergunta', () => {
    const perguntas = [
      'quanto gastei esse mês?',
      'Quanto gastei com mercado',
      'qual meu saldo?',
      'Quais orçamentos estourei?',
      'onde estou gastando mais?',
      'dá pra viajar em dezembro?',
      'me diz quanto sobrou',
      'tenho dinheiro pra pagar o aluguel?',
      'posso gastar 200 no fim de semana?'
    ];

    it.each(perguntas)('%s', (texto) => {
      expect(isQuestion(texto)).toBe(true);
    });
  });

  describe('reconhece lançamento', () => {
    const lancamentos = [
      'Gastei 50 reais no mercado',
      'paguei 120 de energia',
      'Recebi 3000 de salário',
      'R$ 45 no uber',
      'comprei 89,90 em roupa'
    ];

    it.each(lancamentos)('%s', (texto) => {
      expect(isQuestion(texto)).toBe(false);
      expect(parseMessage(texto).valid).toBe(true);
    });
  });

  it('a armadilha: "quanto gastei 2026" NÃO pode virar despesa de R$ 2.026', () => {
    const texto = 'quanto gastei 2026';

    // O parser sozinho cairia na armadilha — o verbo colado ao número casa.
    expect(parseMessage(texto).valid).toBe(true);
    expect(parseMessage(texto).amount).toBe(2026);

    // Por isso isQuestion roda primeiro e desvia pro Vero.
    expect(isQuestion(texto)).toBe(true);
  });

  it('pergunta com valor continua sendo pergunta', () => {
    expect(isQuestion('posso gastar 200 hoje?')).toBe(true);
    expect(isQuestion('quanto sobra se eu gastar R$ 500?')).toBe(true);
  });

  it('não confunde palavra que começa igual', () => {
    // "Comprei" começa com "com", mas não é pergunta.
    expect(isQuestion('Comprei 50 de pão')).toBe(false);
    // "Quantia" começa com "quant", mas não é um dos gatilhos.
    expect(isQuestion('Quantia de 50 no mercado')).toBe(false);
  });
});
