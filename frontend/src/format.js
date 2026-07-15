const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const BRL_COMPACT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1
});

export function formatMoney(value) {
  return BRL.format(Number(value) || 0);
}

// Para valores grandes em espaço estreito (stat tile no celular): R$ 12,3 mil
export function formatMoneyCompact(value) {
  const n = Number(value) || 0;
  return Math.abs(n) >= 10000 ? BRL_COMPACT.format(n) : BRL.format(n);
}

export function formatDate(value) {
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
