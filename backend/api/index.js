// Ponto de entrada para o Vercel (Serverless Functions).
//
// No Docker/local o servidor sobe com `app.listen()` (ver server.js). No Vercel
// não existe um processo fixo escutando uma porta: o Express é chamado uma vez
// por requisição. Por isso aqui NÃO chamamos listen — apenas garantimos que o
// banco esteja conectado e o schema sincronizado (uma única vez por instância,
// no "cold start") e então delegamos a requisição para o app Express.

const app = require('../server');
const sequelize = require('../config/database');
const { runMigrations } = require('../database/migrate');

let ready;
function ensureReady() {
  if (!ready) {
    ready = (async () => {
      await sequelize.authenticate();
      await sequelize.sync();
      // sync() só cria tabelas novas; colunas novas em tabelas antigas vêm daqui.
      await runMigrations();
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
  // IMPORTANTE (serverless): só resolvemos quando a resposta REALMENTE terminou.
  // Se retornássemos `app(req, res)` direto, a promise resolveria antes de o
  // Express terminar rotas com trabalho assíncrono (ex: fetch pro GitHub), e o
  // ambiente do Vercel "congelaria" a execução -> a requisição travava.
  return new Promise((resolve) => {
    res.once('finish', resolve);
    res.once('close', resolve);
    app(req, res);
  });
};
