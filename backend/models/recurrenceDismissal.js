const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');

// Sugestão de conta fixa que o usuário dispensou.
//
// Sem isso, o detector reofereceria o mesmo padrão toda vez que a tela abrisse —
// e "não, obrigado" que não é lembrado vira incômodo. A `signature` é a mesma
// chave do agrupamento do detector ("expense::mercado"), não um id: o padrão é
// uma inferência, não uma linha do banco.
const RecurrenceDismissal = sequelize.define('RecurrenceDismissal', {
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
  signature: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'recurrence_dismissals',
  underscored: true,
  indexes: [{ unique: true, fields: ['user_id', 'signature'] }]
});

RecurrenceDismissal.belongsTo(User, { foreignKey: 'userId' });

module.exports = RecurrenceDismissal;
