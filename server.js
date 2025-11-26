// Arquivo de inicialização: delega para src/app.js e inicia o servidor
const app = require('./src/app');
const http = require('http');
const socketIO = require('socket.io');
const { setupSocketHandlers } = require('./src/websocket/socketHandler');

// Importar rotas
const userRoutes = require('./src/routes/users');
const postRoutes = require('./src/routes/posts');

const PORT = 3000;

// Criar servidor HTTP para suportar WebSocket
const server = http.createServer(app);

// Inicializar Socket.IO com CORS
const io = socketIO(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Configurar handlers de WebSocket
setupSocketHandlers(io);

// Fazer io disponível globalmente para as rotas
app.set('io', io);

// Aplicar rotas
userRoutes(app);
postRoutes(app);

// Rota de teste
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API funcionando!', 
    timestamp: new Date().toISOString() 
  });
});

// ===========================================
// INICIALIZAÇÃO DO SERVIDOR
// ===========================================
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📡 WebSocket ativo`);
  console.log(`${'='.repeat(50)}\n`);
  console.log(`Status:  http://localhost:${PORT}/api/status`);
  console.log(`Teste:   http://localhost:${PORT}/api/test`);
  console.log(`\n${'='.repeat(50)}\n`);
});

module.exports = server;


