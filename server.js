// ===========================================
// server.js - Arquivo principal
// ===========================================

const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');
app.use(cors());

const app = express();
const PORT = 3000;

// ===========================================
// MIDDLEWARES
// ===========================================
app.use(express.json());

// ===========================================
// CONFIGURAÇÃO DO BANCO DE DADOS
// ===========================================
let db;
let dbConnected = false;

const connectDB = () => {
  db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root', 
    database: 'MarketMeet'
  });

  db.connect((err) => {
    if (err) {
      console.error('❌ Erro ao conectar MySQL:', err);
      console.log('⚠️  Servidor iniciará sem banco de dados');
      dbConnected = false;
      return;
    }
    console.log('✅ Conectado ao MySQL');
    dbConnected = true;
  });

  // Reconectar automaticamente se a conexão for perdida
  db.on('error', (err) => {
    console.error('Erro na conexão do banco:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.log('🔄 Tentando reconectar...');
      setTimeout(connectDB, 2000);
    }
  });
};

connectDB();

// ===========================================
// MIDDLEWARE PARA VERIFICAR CONEXÃO COM BANCO
// ===========================================
const checkDB = (req, res, next) => {
  if (!dbConnected) {
    return res.status(503).json({
      error: 'Banco de dados indisponível',
      message: 'O serviço está temporariamente indisponível. Tente novamente em alguns minutos.'
    });
  }
  next();
};

// ===========================================
// ROTAS
// ===========================================

// Rota de status da aplicação
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'disconnected',
    message: dbConnected ? 'Todos os serviços funcionando' : 'Banco de dados indisponível'
  });
});

// Rota de teste (não precisa do banco)
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API funcionando!', 
    timestamp: new Date().toISOString() 
  });
});

// Criar usuário (requer banco)
app.post('/api/users/create', checkDB, async (req, res) => {
  try {
    const { nome, data_nascimento, email, senha } = req.body;

    // Validação básica
    if (!nome || !email || !senha || !data_nascimento) {
      return res.status(400).json({ 
        error: 'Todos os campos são obrigatórios' 
      });
    }

    // Criptografar senha
    const senhaHash = await bcrypt.hash(senha, 10);

    const query = `
      INSERT INTO account (username, email, password, birth_date) 
      VALUES (?, ?, ?, ?)
    `;

    db.query(query, [nome, email, senhaHash, data_nascimento], (err, result) => {
      if (err) {
        console.error('Erro ao criar usuário:', err);
        
        // Verificar se é erro de email duplicado
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ 
            error: 'Este email já está em uso' 
          });
        }
        
        return res.status(500).json({ 
          error: 'Erro interno do servidor' 
        });
      }

      res.status(201).json({
        success: true,
        message: 'Usuário criado com sucesso!',
        userId: result.insertId
      });
    });

  } catch (error) {
    console.error('Erro no cadastro:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
});
//////////////////////////////////////////TEMPORARIAMENTE LIMITADO////////////////////////////////////////////////////
// Login de usuário (requer banco)
app.post('/api/users/login', checkDB, async (req, res) => {
  try {
    const { email, senha } = req.body;

    // Validação básica
    if (!email || !senha) {
      return res.status(400).json({ 
        error: 'Email e senha são obrigatórios' 
      });
    }

    const query = 'SELECT * FROM usuarios WHERE email = ?';
    
    db.query(query, [email], async (err, results) => {
      if (err) {
        console.error('Erro na consulta:', err);
        return res.status(500).json({ 
          error: 'Erro interno do servidor' 
        });
      }

      if (results.length === 0) {
        return res.status(401).json({ 
          error: 'Email ou senha incorretos' 
        });
      }

      const usuario = results[0];
      
      // Verificar senha
      const senhaValida = await bcrypt.compare(senha, usuario.senha);
      
      if (!senhaValida) {
        return res.status(401).json({ 
          error: 'Email ou senha incorretos' 
        });
      }

      // Login realizado com sucesso
      res.json({
        success: true,
        message: 'Login realizado com sucesso!',
        user: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          data_nascimento: usuario.data_nascimento
        }
      });
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
});

// Buscar usuário por ID (requer banco)
app.get('/api/users/:id', checkDB, (req, res) => {
  const { id } = req.params;

  const query = 'SELECT id, nome, email, data_nascimento FROM usuarios WHERE id = ?';
  
  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Erro na consulta:', err);
      return res.status(500).json({ 
        error: 'Erro interno do servidor' 
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ 
        error: 'Usuário não encontrado' 
      });
    }

    res.json({
      success: true,
      user: results[0]
    });
  });
});

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
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 Status: http://localhost:${PORT}/api/status`);
  console.log(`🧪 Teste: http://localhost:${PORT}/api/test`);
  
  if (!dbConnected) {
    console.log('⚠️  Aviso: Banco de dados não conectado');
    console.log('💡 As rotas de usuário retornarão erro 503 até o banco estar disponível');
  }
});