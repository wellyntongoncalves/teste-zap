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

// occurredAt é gravado ao meio-dia UTC (ver backend/services/dates.js), então
// lemos em UTC: a data de calendário sai igual à que foi digitada, em qualquer
// fuso — e os lançamentos antigos (meia-noite UTC) também passam a exibir o dia certo.
export function formatDate(value) {
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

// Hoje no fuso do usuário, como YYYY-MM-DD, pro <input type=date> abrir no dia
// certo. new Date().toISOString() daria a data em UTC — de noite no Brasil já é "amanhã".
export function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
