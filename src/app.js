require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { helmet, limiter } = require('./config/security');
const errorHandler = require('./middlewares/errorHandler');
const { isConnected } = require('./db');
const logger = require('./utils/logger');

const app = express();

console.log('🔵 [APP INIT] - Inicializando aplicação...');

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

console.log('✅ [MIDDLEWARES] - Middlewares configurados');

// =====================================================
// ROTAS DE STATUS E TESTE
// =====================================================

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
    console.error('❌ Erro ao verificar status:', error);
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
    console.error('❌ Erro na rota de teste:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// =====================================================
// IMPORTAR E REGISTRAR ROTAS
// =====================================================

console.log('🟡 [ROUTES] - Carregando rotas...');

try {
  require('./routes/users')(app);
  console.log('✅ [ROUTES] - Rotas de usuários carregadas');
} catch (error) {
  console.error('❌ Erro ao carregar rotas de usuários:', error);
}

try {
  require('./routes/posts')(app);
  console.log('✅ [ROUTES] - Rotas de posts carregadas');
} catch (error) {
  console.error('❌ Erro ao carregar rotas de posts:', error);
}

console.log('✅ [ROUTES] - Todas as rotas carregadas com sucesso');

// =====================================================
// ROTA 404 - DEVE SER POR ÚLTIMO
// =====================================================

app.use((req, res) => {
  console.warn(`⚠️ [404] - Rota não encontrada: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'Rota não encontrada',
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// =====================================================
// ERROR HANDLER - DEVE SER O ÚLTIMO MIDDLEWARE
// =====================================================

app.use(errorHandler);

console.log('✅ [APP INIT] - Aplicação inicializada com sucesso!\n');

module.exports = app;