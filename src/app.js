require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { helmet, limiter } = require('./config/security');
const errorHandler = require('./middlewares/errorHandler');
const { isConnected } = require('./db');
const logger = require('./utils/logger');

const app = express();

// Configurações de segurança
app.use(helmet());
app.use(limiter);

// Configuração do CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// MIDDLEWARES
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rota de status da aplicação
app.get('/api/status', (req, res) => {
  try {
    res.json({
      status: 'online',
      timestamp: new Date().toISOString(),
      database: isConnected() ? 'connected' : 'disconnected',
      message: isConnected() ? 'Todos os serviços funcionando' : 'Banco de dados indisponível'
    });
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Rota de teste (não precisa do banco)
app.get('/api/test', (req, res) => {
  try {
    res.json({
      message: 'API funcionando!',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro na rota de teste:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Importar rotas
require('./routes/users')(app);
require('./routes/posts')(app);

// Error Handler - deve ser o último middleware
app.use(errorHandler);

module.exports = app;
