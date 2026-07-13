const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');

const ACCOUNT_TYPES = ['corrente', 'poupanca', 'carteira', 'investimento', 'outra'];

const Account = sequelize.define('Account', {
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
  type: {
    type: DataTypes.ENUM(...ACCOUNT_TYPES),
    allowNull: false,
    defaultValue: 'carteira'
  },
  initialBalance: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'initial_balance'
  },
  archivedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'archived_at'
  }
}, {
  tableName: 'accounts',
  underscored: true
});

Account.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Account, { foreignKey: 'userId' });

module.exports = Account;
module.exports.ACCOUNT_TYPES = ACCOUNT_TYPES;
