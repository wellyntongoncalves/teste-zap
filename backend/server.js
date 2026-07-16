require('dotenv').config();
require('express-async-errors'); // encaminha erros de rotas async para o middleware de erro (Express 4 não faz isso sozinho)
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');

// Rede de segurança: em serverless, uma exceção não tratada MATA a função e a
// requisição fica "pendurada" até o timeout. Logamos e seguimos vivos.
process.on('unhandledRejection', (err) => console.error('unhandledRejection:', err));
process.on('uncaughtException', (err) => console.error('uncaughtException:', err));

const authRoutes = require('./routes/auth');
const whatsappRoutes = require('./routes/whatsapp');
const transactionRoutes = require('./routes/transactions');
const accountRoutes = require('./routes/accounts');
const tagRoutes = require('./routes/tags');
const budgetRoutes = require('./routes/budgets');
const creditCardRoutes = require('./routes/creditCards');
const goalRoutes = require('./routes/goals');
const assistantRoutes = require('./routes/assistant');
const insightRoutes = require('./routes/insights');

const app = express();

app.set('trust proxy', true); // necessário para req.protocol/host corretos atrás de proxy (ex: validação da assinatura Twilio)

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // Twilio envia application/x-www-form-urlencoded

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/credit-cards', creditCardRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/insights', insightRoutes);

// Middleware de erro: qualquer erro de rota vira uma resposta JSON limpa em vez
// de derrubar o servidor. Erros de validação/enum do Postgres viram 400.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Erro na requisição:', err.message);
  if (res.headersSent) return next(err);
  const isValidation = /Sequelize(Validation|Database|ForeignKey|UniqueConstraint)Error/.test(err.name || '');
  res.status(isValidation ? 400 : 500).json({
    error: isValidation ? 'Dados inválidos na requisição' : 'Erro interno no servidor'
  });
});

const PORT = process.env.PORT || 3000;

async function start() {
  await sequelize.authenticate();
  await sequelize.sync();
  app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Falha ao iniciar o servidor:', err);
    process.exit(1);
  });
}

module.exports = app;
