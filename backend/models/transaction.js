const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');
const Account = require('./account');
const CreditCard = require('./creditCard');
const Tag = require('./tag');
const TransactionTag = require('./transactionTag');

const CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Contas',
  'Saúde',
  'Lazer',
  'Educação',
  'Compras',
  'Salário',
  'Investimentos',
  'Outras Receitas',
  'Outros'
];

const TYPES = ['income', 'expense', 'transfer'];

const Transaction = sequelize.define('Transaction', {
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
  destinationAccountId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'destination_account_id'
  },
  type: {
    type: DataTypes.ENUM(...TYPES),
    allowNull: false,
    defaultValue: 'expense'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM(...CATEGORIES),
    allowNull: false,
    defaultValue: 'Outros'
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  rawMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'raw_message'
  },
  source: {
    type: DataTypes.ENUM('whatsapp', 'dashboard'),
    allowNull: false,
    defaultValue: 'whatsapp'
  },
  occurredAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'occurred_at'
  },
  creditCardId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'credit_card_id'
  },
  installmentGroupId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'installment_group_id'
  },
  installmentNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'installment_number'
  },
  installmentTotal: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'installment_total'
  }
}, {
  tableName: 'transactions',
  underscored: true
});

Transaction.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Transaction, { foreignKey: 'userId' });

Transaction.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });
Transaction.belongsTo(Account, { foreignKey: 'destinationAccountId', as: 'destinationAccount' });
Account.hasMany(Transaction, { foreignKey: 'accountId' });

Transaction.belongsTo(CreditCard, { foreignKey: 'creditCardId' });
CreditCard.hasMany(Transaction, { foreignKey: 'creditCardId' });

Transaction.belongsToMany(Tag, { through: TransactionTag, foreignKey: 'transactionId', otherKey: 'tagId' });

module.exports = Transaction;
module.exports.CATEGORIES = CATEGORIES;
module.exports.TYPES = TYPES;
