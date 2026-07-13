// Ponto de entrada para o Vercel (Serverless Functions).
//
// No Docker/local o servidor sobe com `app.listen()` (ver server.js). No Vercel
// não existe um processo fixo escutando uma porta: o Express é chamado uma vez
// por requisição. Por isso aqui NÃO chamamos listen — apenas garantimos que o
// banco esteja conectado e o schema sincronizado (uma única vez por instância,
// no "cold start") e então delegamos a requisição para o app Express.

const app = require('../server');
const sequelize = require('../config/database');

let ready;
function ensureReady() {
  if (!ready) {
    ready = (async () => {
      await sequelize.authenticate();
      await sequelize.sync();
    })();
  }
  return ready;
}

module.exports = async (req, res) => {
  try {
    await ensureReady();
  } catch (err) {
    // Se a próxima requisição vier num novo cold start, tentamos de novo.
    ready = undefined;
    console.error('Falha ao conectar/sincronizar o banco:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Erro ao conectar ao banco de dados' }));
    return;
  }
  return app(req, res);
};
