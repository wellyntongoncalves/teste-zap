const twilio = require('twilio');

const client = process.env.TWILIO_ACCOUNT_SID
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

async function sendWhatsAppMessage(to, body) {
  if (!client) {
    console.warn('Twilio não configurado; mensagem não enviada:', body);
    return null;
  }

  return client.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to,
    body
  });
}

module.exports = { sendWhatsAppMessage };
