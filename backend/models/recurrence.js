const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');
const Account = require('./account');

// Conta fixa: a regra que gera um lançamento por mês (aluguel, assinatura,
// salário). A regra NÃO é um lançamento — quem vira lançamento é cada
// vencimento dela, materializado por services/recurrences.js.
const Recurrence = sequelize.define('Recurrence', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id'
  },
  accountId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'account_id'
  },
  type: {
    type: DataTypes.ENUM('income', 'expense'),
    allowNull: false,
    defaultValue: 'expense'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Outros'
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // Dia do vencimento. 31 em fevereiro cai no último dia do mês (ver dueDate).
  dayOfMonth: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    field: 'day_of_month',
    validate: { min: 1, max: 31 }
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'start_date'
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'end_date'
  },
  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  // Último vencimento já materializado. É o cursor da geração: só nascem
  // lançamentos com data depois dele.
  lastRunOn: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'last_run_on'
  }
}, {
  tableName: 'recurrences',
  underscored: true
});

Recurrence.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Recurrence, { foreignKey: 'userId' });
Recurrence.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });

module.exports = Recurrence;
