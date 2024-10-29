// db.js
const { Pool } = require('pg');

const pool = new Pool({
  user: 'christy',
  host: 'localhost',
  database: 'health_diagnosis',
  password: 'kichu106070',
  port: 5432,
});

module.exports = pool;
