const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');

const Tag = sequelize.define('Tag', {
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
  color: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'tags',
  underscored: true,
  indexes: [{ unique: true, fields: ['user_id', 'name'] }]
});

Tag.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Tag, { foreignKey: 'userId' });

module.exports = Tag;
