require('dotenv').config();
const path = require('path');

const connection = process.env.DATABASE_URL || {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'task_management',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
};

module.exports = {
  client: 'pg',
  connection,
  pool: { min: 0, max: 10 },
  migrations: { directory: path.join(__dirname, 'src/db/migrations') },
  seeds: { directory: path.join(__dirname, 'src/db/seeds') },
};
