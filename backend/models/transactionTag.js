const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TransactionTag = sequelize.define('TransactionTag', {
  transactionId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'transaction_id'
  },
  tagId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'tag_id'
  }
}, {
  tableName: 'transaction_tags',
  underscored: true,
  id: false,
  indexes: [{ unique: true, fields: ['transaction_id', 'tag_id'] }]
});

module.exports = TransactionTag;
