require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');

const authRoutes = require('./routes/auth');
const whatsappRoutes = require('./routes/whatsapp');
const transactionRoutes = require('./routes/transactions');
const accountRoutes = require('./routes/accounts');
const tagRoutes = require('./routes/tags');
const budgetRoutes = require('./routes/budgets');
const creditCardRoutes = require('./routes/creditCards');
const goalRoutes = require('./routes/goals');

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
