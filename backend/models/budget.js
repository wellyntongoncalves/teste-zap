const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');
const Tag = require('./tag');
const { CATEGORIES } = require('./transaction');

const Budget = sequelize.define('Budget', {
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
  category: {
    type: DataTypes.ENUM(...CATEGORIES),
    allowNull: true
  },
  tagId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'tag_id'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  recurring: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  month: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: { min: 1, max: 12 }
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'budgets',
  underscored: true,
  validate: {
    exactlyOneTarget() {
      if ((this.category == null) === (this.tagId == null)) {
        throw new Error('Informe exatamente um entre category e tagId');
      }
    },
    monthYearWhenNotRecurring() {
      if (!this.recurring && (this.month == null || this.year == null)) {
        throw new Error('month e year são obrigatórios quando recurring é false');
      }
    }
  }
});

Budget.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Budget, { foreignKey: 'userId' });
Budget.belongsTo(Tag, { foreignKey: 'tagId' });

module.exports = Budget;
