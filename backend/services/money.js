// Formata em real brasileiro (R$ 1.234,56). Centralizado porque o bot do WhatsApp
// e o contexto do Vero mostravam "R$ 80.00" (toFixed → ponto, formato gringo) num
// app 100% BR. Node oficial (dev e Vercel) traz ICU completo, então pt-BR resolve.
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatBRL(value) {
  return BRL.format(Number(value) || 0);
}

module.exports = { formatBRL };
