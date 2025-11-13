const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

// Usar pool para maior robustez
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'MarketMeet',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

let dbConnected = false;

// Testar conexão inicial
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Erro ao conectar MySQL (pool):', err.message || err);
    dbConnected = false;
    return;
  }
  if (connection) {
    console.log('Conectado ao MySQL (pool)');
    dbConnected = true;
    connection.release();
  }
});

const getDB = () => pool;
const isConnected = () => dbConnected;

// Middleware para verificar conexão com o banco (faz uma simples query de ping)
const checkDB = (req, res, next) => {
  pool.query('SELECT 1', (err) => {
    if (err) {
      console.error('Banco de dados indisponível:', err.message || err);
      return res.status(503).json({
        error: 'Banco de dados indisponível',
        message: 'O serviço está temporariamente indisponível. Tente novamente em alguns minutos.'
      });
    }
    next();
  });
};

module.exports = {
  getDB,
  isConnected,
  checkDB
};
