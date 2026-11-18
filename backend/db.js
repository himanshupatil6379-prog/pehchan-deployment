import { Sequelize } from 'sequelize';
import config from './config.js';

/**
 * MySQL connection (Sequelize + mysql2).
 * Datetimes are stored in UTC (Django USE_TZ=True stores UTC as well); the
 * Asia/Kolkata conversion happens when rendering.
 */
const sequelize = new Sequelize(config.DB.name, config.DB.user, config.DB.password, {
  host: config.DB.host,
  port: config.DB.port,
  dialect: 'mysql',
  timezone: '+00:00',
  logging: config.DB.logging ? console.log : false,
  dialectOptions: {
    charset: 'utf8mb4',
    dateStrings: false,
    decimalNumbers: false,
  },
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    timestamps: false,
    freezeTableName: true,
    underscored: true,
  },
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
});

export default sequelize;
