// occurredAt de um lançamento é uma DATA de calendário, não um instante.
//
// A coluna é um TIMESTAMP, e gravar a data escolhida à meia-noite UTC fazia ela
// "voltar um dia" ao ser exibida a oeste (Brasil = UTC-3): 2026-07-16T00:00Z
// vira 15/07 às 21h. A regra aqui é ancorar toda data ao MEIO-DIA UTC — longe da
// meia-noite, a data de calendário sobrevive à leitura em qualquer fuso.
//
// Contrato: o wire é uma string YYYY-MM-DD (o que o <input type=date> produz);
// o backend ancora ao meio-dia UTC; o front lê/exibe em UTC (timeZone: 'UTC').
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function noonUtc(dateOnly) {
  return new Date(`${dateOnly}T12:00:00.000Z`);
}

// Normaliza qualquer entrada de data de lançamento para o meio-dia UTC do dia certo.
// - vazio            -> hoje (data UTC), ao meio-dia (ex: WhatsApp, sem data digitada)
// - "YYYY-MM-DD"     -> aquele dia ao meio-dia UTC
// - timestamp cheio  -> a data UTC dele, reancorada ao meio-dia
// - lixo             -> Invalid Date (deixa o Sequelize validar e devolver 400)
function toOccurredAt(value) {
  if (value === undefined || value === null || value === '') {
    return noonUtc(new Date().toISOString().slice(0, 10));
  }
  const s = String(value);
  if (DATE_ONLY.test(s)) return noonUtc(s);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return d;
  return noonUtc(d.toISOString().slice(0, 10));
}

module.exports = { toOccurredAt, noonUtc };
