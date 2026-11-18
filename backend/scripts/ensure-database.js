/**
 * Create the MySQL database if it does not exist yet (local development).
 * On Hostinger the database is created from hPanel, so a missing privilege is ignored.
 */
import mysql from 'mysql2/promise';
import config from '../config.js';

export async function ensureDatabase() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: config.DB.host,
      port: config.DB.port,
      user: config.DB.user,
      password: config.DB.password,
    });
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.DB.name.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } catch (err) {
    if (!['ER_DBACCESS_DENIED_ERROR', 'ER_ACCESS_DENIED_ERROR', 'ER_SPECIFIC_ACCESS_DENIED_ERROR'].includes(err.code)) {
      throw err;
    }
  } finally {
    if (conn) await conn.end();
  }
}
