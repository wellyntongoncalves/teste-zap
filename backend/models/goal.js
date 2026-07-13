const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');
const Account = require('./account');

const STATUSES = ['active', 'completed', 'archived'];

const Goal = sequelize.define('Goal', {
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
  targetAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'target_amount'
  },
  currentAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'current_amount'
  },
  targetDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'target_date'
  },
  linkedAccountId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'linked_account_id'
  },
  status: {
    type: DataTypes.ENUM(...STATUSES),
    allowNull: false,
    defaultValue: 'active'
  }
}, {
  tableName: 'goals',
  underscored: true
});

Goal.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Goal, { foreignKey: 'userId' });
Goal.belongsTo(Account, { foreignKey: 'linkedAccountId', as: 'linkedAccount' });

module.exports = Goal;
module.exports.STATUSES = STATUSES;
