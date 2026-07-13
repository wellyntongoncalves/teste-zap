const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');
const Account = require('./account');

const CreditCard = sequelize.define('CreditCard', {
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
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  limitAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'limit_amount'
  },
  closingDay: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'closing_day',
    validate: { min: 1, max: 31 }
  },
  dueDay: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'due_day',
    validate: { min: 1, max: 31 }
  },
  paymentAccountId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'payment_account_id'
  },
  archivedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'archived_at'
  }
}, {
  tableName: 'credit_cards',
  underscored: true
});

CreditCard.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(CreditCard, { foreignKey: 'userId' });
CreditCard.belongsTo(Account, { foreignKey: 'paymentAccountId', as: 'paymentAccount' });

module.exports = CreditCard;
