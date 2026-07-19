const express = require('express');
const twilio = require('twilio');
const User = require('../models/user');
const Account = require('../models/account');
const Transaction = require('../models/transaction');
const { isQuestion, isGreeting } = require('../services/nlp');
const { parseMessageSmart } = require('../services/nlpSmart');
const { sendWhatsAppMessage } = require('../services/whatsapp');
const { appendTransactionNote } = require('../services/obsidian');
const { ask, isConfigured: veroIsConfigured } = require('../services/assistant');
const { toOccurredAt } = require('../services/dates');
const { formatBRL } = require('../services/money');

const router = express.Router();

// Sem TWILIO_AUTH_TOKEN configurado (ex: ambiente de dev local), pula a validação.
// Em produção, defina a variável para que assinaturas inválidas sejam rejeitadas.
function verifyTwilioSignature(req, res, next) {
  if (!process.env.TWILIO_AUTH_TOKEN) {
    return next();
  }

  const signature = req.headers['x-twilio-signature'];
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const valid = twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, url, req.body);

  if (!valid) {
    return res.status(403).send('Assinatura Twilio inválida');
  }

  return next();
}

// Toda mensagem do WhatsApp lança na conta mais antiga do usuário. Contas são
// criadas automaticamente no registro; este fallback só cobre usuários antigos
// que não passaram por esse fluxo.
async function getDefaultAccount(user) {
  const existing = await Account.findOne({ where: { userId: user.id }, order: [['createdAt', 'ASC']] });
  if (existing) return existing;

  return Account.create({ userId: user.id, name: 'Conta Padrão', type: 'carteira', initialBalance: 0 });
}

// Boas-vindas/ajuda: primeiro contato acolhedor e auto-explicativo, em vez do
// hint genérico de "não entendi". A lista de exemplos ensina o formato.
function welcomeMessage(user, veroOn) {
  const nome = (user.name || '').trim().split(/\s+/)[0];
  const linhas = [
    `Oi${nome ? `, ${nome}` : ''}! 👋 Sou o assistente do MeuBolso.`,
    '',
    'Me manda seus gastos e receitas que eu registro na hora:',
    '• gastei 50 no mercado',
    '• paguei 120 de luz',
    '• recebi 3000 de salário'
  ];
  if (veroOn) {
    linhas.push('', 'Quer saber algo? Pergunte: "quanto gastei esse mês?"');
  }
  linhas.push('', 'Tudo aparece no seu painel: https://meubolso-xi.vercel.app');
  return linhas.join('\n');
}

// O Vero pode demorar alguns segundos; a Twilio reenvia o webhook se a resposta
// não vier rápido, o que geraria respostas duplicadas. Por isso confirmamos o
// recebimento na hora e mandamos a resposta pelo WhatsApp quando ela ficar pronta.
async function answerQuestion(user, from, question, res) {
  if (!veroIsConfigured()) {
    await sendWhatsAppMessage(
      from,
      'Ainda não consigo responder perguntas — o assistente não está configurado. Por enquanto, mande seus gastos que eu registro.'
    );
    return res.sendStatus(200);
  }

  res.sendStatus(200);

  try {
    const { answer } = await ask(user, question);
    await sendWhatsAppMessage(from, answer);
  } catch (err) {
    console.warn('Vero falhou no WhatsApp:', err.message);
    await sendWhatsAppMessage(from, 'Não consegui responder agora. Tente de novo em instantes.');
  }
}

// Webhook chamado pela Twilio a cada mensagem recebida no número do WhatsApp Business.
// Configurar em https://console.twilio.com -> WhatsApp Sandbox/Sender -> "When a message comes in".
router.post('/webhook', verifyTwilioSignature, async (req, res) => {
  const from = req.body.From; // ex: "whatsapp:+5511999999999"
  const body = req.body.Body;

  if (!from || !body) {
    return res.sendStatus(400);
  }

  const whatsappNumber = from.replace('whatsapp:', '');
  const user = await User.findOne({ where: { whatsappNumber } });

  if (!user) {
    await sendWhatsAppMessage(from, 'Número não cadastrado. Cadastre-se no dashboard antes de registrar gastos.');
    return res.sendStatus(200);
  }

  // Saudação/ajuda vem antes de tudo: "oi"/"ajuda" não é pergunta nem lançamento.
  if (isGreeting(body)) {
    await sendWhatsAppMessage(from, welcomeMessage(user, veroIsConfigured()));
    return res.sendStatus(200);
  }

  // Pergunta vai pro Vero; o resto tenta virar lançamento. A ordem importa:
  // "quanto gastei 2026" casa com o padrão de valor e viraria uma despesa.
  if (isQuestion(body)) {
    return answerQuestion(user, from, body, res);
  }

  // Tenta o regex e, se ele não entender, o LLM. Ver services/nlpSmart.js.
  const parsed = await parseMessageSmart(body);

  if (!parsed.valid) {
    const dica = veroIsConfigured()
      ? 'Não achei um valor aí. Pra lançar, mande algo como "Gastei 50 reais no mercado" — ou faça uma pergunta, tipo "quanto gastei esse mês?".'
      : 'Não consegui identificar um valor na mensagem. Tente algo como "Gastei 50 reais no mercado".';
    await sendWhatsAppMessage(from, dica);
    return res.sendStatus(200);
  }

  const account = await getDefaultAccount(user);

  const transaction = await Transaction.create({
    userId: user.id,
    accountId: account.id,
    type: parsed.type,
    amount: parsed.amount,
    category: parsed.category,
    description: parsed.description,
    rawMessage: body,
    source: 'whatsapp',
    // Data de hoje ancorada ao meio-dia UTC, mesmo invariante do dashboard —
    // o default NOW gravava um instante real e sofria o mesmo off-by-one.
    occurredAt: toOccurredAt()
  });

  await appendTransactionNote(user, transaction);

  const verb = transaction.type === 'income' ? 'Receita registrada' : 'Gasto registrado';
  await sendWhatsAppMessage(
    from,
    `${verb}: ${formatBRL(transaction.amount)} em "${transaction.category}". Confira no seu dashboard.`
  );

  return res.sendStatus(200);
});

module.exports = router;
