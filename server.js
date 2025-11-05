// Arquivo de inicialização: delega para src/app.js e inicia o servidor
const app = require('./src/app');

const PORT = 3000;

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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Status: http://localhost:${PORT}/api/status`);
  console.log(`Teste: http://localhost:${PORT}/api/test`);
});

