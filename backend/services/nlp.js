const CATEGORY_KEYWORDS = {
  'Alimentação': ['mercado', 'supermercado', 'restaurante', 'lanche', 'comida', 'almoço', 'jantar', 'padaria', 'ifood', 'feira'],
  'Transporte': ['uber', '99', 'gasolina', 'combustível', 'ônibus', 'metro', 'metrô', 'estacionamento', 'pedágio', 'táxi'],
  'Contas': ['energia', 'luz', 'água', 'internet', 'telefone', 'celular', 'aluguel', 'condomínio', 'boleto', 'conta'],
  'Saúde': ['farmácia', 'remédio', 'médico', 'consulta', 'exame', 'plano de saúde', 'dentista'],
  'Lazer': ['cinema', 'show', 'viagem', 'bar', 'balada', 'streaming', 'netflix', 'passeio'],
  'Educação': ['curso', 'faculdade', 'livro', 'mensalidade', 'escola', 'material escolar'],
  'Compras': ['roupa', 'sapato', 'shopping', 'loja', 'compra', 'eletrônico'],
  'Salário': ['salário', 'salario', 'holerite', 'contracheque'],
  'Investimentos': ['dividendo', 'rendimento', 'investimento']
};

const INCOME_KEYWORDS = [
  'recebi', 'caiu', 'ganhei', 'depositaram', 'depósito', 'deposito',
  'salário', 'salario', 'pix recebido', 'reembolso'
];

const VALUE_PATTERNS = [
  /r\$\s*([\d.,]+)/i,
  /([\d.,]+)\s*reais/i,
  /(?:gastei|paguei|comprei|gasto de|torrei)\s+(?:r\$\s*)?([\d.,]+)/i,
  /(?:recebi|caiu|ganhei|depositaram)\s+(?:r\$\s*)?([\d.,]+)/i
];

function parseAmount(text) {
  for (const pattern of VALUE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const normalized = match[1].replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
      const value = parseFloat(normalized);
      if (!Number.isNaN(value)) return value;
    }
  }
  return null;
}

function detectCategory(text) {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return category;
    }
  }
  return 'Outros';
}

function detectType(text) {
  const lower = text.toLowerCase();
  return INCOME_KEYWORDS.some((keyword) => lower.includes(keyword)) ? 'income' : 'expense';
}

function parseMessage(text) {
  const amount = parseAmount(text);
  const type = detectType(text);
  let category = detectCategory(text);

  if (type === 'income' && category === 'Outros') {
    category = 'Outras Receitas';
  }

  return {
    amount,
    category,
    type,
    description: text.trim(),
    valid: amount !== null
  };
}

module.exports = { parseMessage, parseAmount, detectCategory, detectType, CATEGORY_KEYWORDS };
