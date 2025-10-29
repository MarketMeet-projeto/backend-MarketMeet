const mysql = require('mysql2');

let db;
let dbConnected = false;

const connectDB = () => {
  db = mysql.createConnection({
    host: 'localhost',
    port: '3306',
    user: 'root',
    password: 'root',
    database: 'MarketMeet'
  });

  db.connect((err) => {
    if (err) {
      console.error('Erro ao conectar MySQL:', err);
      console.log('Servidor iniciará sem banco de dados');
      dbConnected = false;
      return;
    }
    console.log('Conectado ao MySQL');
    dbConnected = true;
  });

  // Reconectar automaticamente se a conexão for perdida
  db.on('error', (err) => {
    console.error('Erro na conexão do banco:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.log('Tentando reconectar...');
      setTimeout(connectDB, 2000);
    }
  });
};

// Inicializa a conexão ao carregar o módulo
connectDB();

const getDB = () => db;
const isConnected = () => dbConnected;

// Middleware para verificar conexão com o banco
const checkDB = (req, res, next) => {
  if (!dbConnected) {
    return res.status(503).json({
      error: 'Banco de dados indisponível',
      message: 'O serviço está temporariamente indisponível. Tente novamente em alguns minutos.'
    });
  }
  next();
};

module.exports = {
  getDB,
  isConnected,
  connectDB,
  checkDB
};
