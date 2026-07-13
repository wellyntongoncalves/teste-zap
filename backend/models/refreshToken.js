const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');

const RefreshToken = sequelize.define('RefreshToken', {
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
  tokenHash: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'token_hash'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at'
  },
  revokedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'revoked_at'
  }
}, {
  tableName: 'refresh_tokens',
  underscored: true
});

RefreshToken.belongsTo(User, { foreignKey: 'userId' });

module.exports = RefreshToken;
