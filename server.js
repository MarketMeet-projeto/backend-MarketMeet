// ===========================================
// server.js - Arquivo principal
// ===========================================

const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express(); 

// Configuração do CORS
app.use(cors({
  origin: '*',
  methods: '*',
  allowedHeaders: '*',
  credentials: false
}));

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
    port: '3306',
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
  try {
    res.json({
      status: 'online',
      timestamp: new Date().toISOString(),
      database: dbConnected ? 'connected' : 'disconnected',
      message: dbConnected ? 'Todos os serviços funcionando' : 'Banco de dados indisponível'
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

// Criar usuário (requer banco)
app.post('/api/users/create', checkDB, async (req, res) => {
  try {
    const { username, birth_date, email, password } = req.body;

    // Validação básica
    if (!username || !email || !password || !birth_date) {
      return res.status(400).json({ 
        error: 'Todos os campos são obrigatórios' 
      });
    }

    // Validar e converter o formato da data
    const dataRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = birth_date.match(dataRegex);
    
    if (!match) {
      return res.status(400).json({
        error: 'Formato de data inválido. Use DD/MM/YYYY'
      });
    }

    // Converter de DD/MM/YYYY para YYYY-MM-DD
    const [, dia, mes, ano] = match;
    const dataBanco = `${ano}-${mes}-${dia}`;

    // Validar se é uma data válida
    const dataObj = new Date(dataBanco);
    if (isNaN(dataObj.getTime())) {
      return res.status(400).json({
        error: 'Data inválida'
      });
    }

    // Criptografar senha
    const senhaHash = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO account (username, email, password, birth_date) 
      VALUES (?, ?, ?, ?)
    `;

    db.query(query, [username, email, senhaHash, dataBanco], (err, result) => {
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
    const { email, password } = req.body;

    // Validação básica
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email e senha são obrigatórios' 
      });
    }

    const query = 'SELECT * FROM account WHERE email = ?';
    
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

      const account = results[0];
      
      // Verificar senha
      const senhaValida = await bcrypt.compare(password, account.password);
      
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
          id_user: account.id_user,
          username: account.username,
          email: account.email,
          birth_date: account.birth_date
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
  try {
    const { id } = req.params;

    const query = 'SELECT id_user, username, email, birth_date FROM account WHERE id_user = ?';
    
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
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
});

// Rota de teste
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API funcionando!', 
    timestamp: new Date().toISOString() 
  });
});

// ===========================================
// ROTAS PARA PUBLICAÇÕES (POSTS) - Adaptado para reviews de produtos
// ===========================================

// Criar nova publicação/review
app.post('/api/posts/create', checkDB, (req, res) => {
  try {
    const { id_user, rating, caption, category, product_photo, product_url } = req.body;

    // Validação básica
    if (!id_user || !rating || !caption || !category || !product_photo || !product_url) {
      return res.status(400).json({ 
        error: 'Todos os campos são obrigatórios (id_user, rating, caption, category, product_photo, product_url)' 
      });
    }

    // Validar rating (deve ser entre 1 e 5)
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ 
        error: 'Rating deve estar entre 1 e 5' 
      });
    }

    const query = `
      INSERT INTO post (rating, caption, category, product_photo, product_url, id_user, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;

    db.query(query, [rating, caption, category, product_photo, product_url, id_user], (err, result) => {
      if (err) {
        console.error('Erro ao criar review:', err);
        return res.status(500).json({ 
          error: 'Erro interno do servidor' 
        });
      }

      res.status(201).json({
        success: true,
        message: 'Review criado com sucesso!',
        postId: result.insertId
      });
    });

  } catch (error) {
    console.error('Erro ao criar review:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
});

// Buscar todos os reviews para o timeline (ordenados por data)
app.get('/api/posts/timeline', checkDB, (req, res) => {
  try {
    const query = `
      SELECT 
        p.id_post,
        p.rating,
        p.caption,
        p.category,
        p.product_photo,
        p.product_url,
        p.created_at,
        a.username,
        a.id_user,
        COUNT(DISTINCT l.id_like) as likes_count,
        COUNT(DISTINCT c.id_comment) as comments_count
      FROM post p
      LEFT JOIN account a ON p.id_user = a.id_user
      LEFT JOIN likes l ON p.id_post = l.id_post
      LEFT JOIN comments c ON p.id_post = c.id_post
      GROUP BY p.id_post
      ORDER BY p.created_at DESC
    `;

    db.query(query, (err, results) => {
      if (err) {
        console.error('Erro ao buscar timeline:', err);
        return res.status(500).json({ 
          error: 'Erro interno do servidor' 
        });
      }

      res.json({
        success: true,
        posts: results
      });
    });
  } catch (error) {
    console.error('Erro ao buscar timeline:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
});

// Buscar reviews de um usuário específico
app.get('/api/posts/user/:userId', checkDB, (req, res) => {
  const { userId } = req.params;

  const query = `
    SELECT 
      p.id_post,
      p.rating,
      p.caption,
      p.category,
      p.product_photo,
      p.product_url,
      p.created_at,
      a.username,
      COUNT(DISTINCT l.id_like) as likes_count,
      COUNT(DISTINCT c.id_comment) as comments_count
    FROM post p
    LEFT JOIN account a ON p.id_user = a.id_user
    LEFT JOIN likes l ON p.id_post = l.id_post
    LEFT JOIN comments c ON p.id_post = c.id_post
    WHERE p.id_user = ?
    GROUP BY p.id_post
    ORDER BY p.created_at DESC
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Erro ao buscar reviews do usuário:', err);
      return res.status(500).json({ 
        error: 'Erro interno do servidor' 
      });
    }

    res.json({
      success: true,
      posts: results
    });
  });
});

// Buscar reviews por categoria
app.get('/api/posts/category/:category', checkDB, (req, res) => {
  const { category } = req.params;

  const query = `
    SELECT 
      p.id_post,
      p.rating,
      p.caption,
      p.category,
      p.product_photo,
      p.product_url,
      p.created_at,
      a.username,
      a.id_user,
      COUNT(DISTINCT l.id_like) as likes_count,
      COUNT(DISTINCT c.id_comment) as comments_count
    FROM post p
    LEFT JOIN account a ON p.id_user = a.id_user
    LEFT JOIN likes l ON p.id_post = l.id_post
    LEFT JOIN comments c ON p.id_post = c.id_post
    WHERE p.category = ?
    GROUP BY p.id_post
    ORDER BY p.created_at DESC
  `;

  db.query(query, [category], (err, results) => {
    if (err) {
      console.error('Erro ao buscar reviews por categoria:', err);
      return res.status(500).json({ 
        error: 'Erro interno do servidor' 
      });
    }

    res.json({
      success: true,
      posts: results
    });
  });
});

// Deletar review (apenas o autor pode deletar)
app.delete('/api/posts/:postId', checkDB, (req, res) => {
  const { postId } = req.params;
  const { id_user } = req.body;

  // Verificar se o post pertence ao usuário
  const checkQuery = 'SELECT id_user FROM post WHERE id_post = ?';
  
  db.query(checkQuery, [postId], (err, results) => {
    if (err) {
      console.error('Erro ao verificar post:', err);
      return res.status(500).json({ 
        error: 'Erro interno do servidor' 
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ 
        error: 'Review não encontrado' 
      });
    }

    if (results[0].id_user !== parseInt(id_user)) {
      return res.status(403).json({ 
        error: 'Você não tem permissão para deletar este review' 
      });
    }

    // Deletar o review
    const deleteQuery = 'DELETE FROM post WHERE id_post = ?';
    
    db.query(deleteQuery, [postId], (err) => {
      if (err) {
        console.error('Erro ao deletar review:', err);
        return res.status(500).json({ 
          error: 'Erro interno do servidor' 
        });
      }

      res.json({
        success: true,
        message: 'Review deletado com sucesso!'
      });
    });
  });
});

// ===========================================
// ROTAS PARA CURTIDAS (LIKES)
// ===========================================

// Curtir/Descurtir review
app.post('/api/posts/:postId/like', checkDB, (req, res) => {
  try {
    const { postId } = req.params;
    const { id_user } = req.body;

    if (!id_user) {
      return res.status(400).json({ 
        error: 'ID do usuário é obrigatório' 
      });
    }

    // Verificar se o usuário já curtiu
    const checkQuery = 'SELECT id_like FROM likes WHERE id_post = ? AND id_user = ?';
    
    db.query(checkQuery, [postId, id_user], (err, results) => {
      if (err) {
        console.error('Erro ao verificar like:', err);
        return res.status(500).json({ 
          error: 'Erro interno do servidor' 
        });
      }

      if (results.length > 0) {
        // Se já curtiu, remove a curtida
        const deleteQuery = 'DELETE FROM likes WHERE id_post = ? AND id_user = ?';
        
        db.query(deleteQuery, [postId, id_user], (err) => {
          if (err) {
            console.error('Erro ao remover like:', err);
            return res.status(500).json({ 
              error: 'Erro interno do servidor' 
            });
          }

          res.json({
            success: true,
            message: 'Curtida removida',
            action: 'unliked'
          });
        });
      } else {
        // Se não curtiu, adiciona a curtida
        const insertQuery = 'INSERT INTO likes (id_post, id_user, created_at) VALUES (?, ?, NOW())';
        
        db.query(insertQuery, [postId, id_user], (err) => {
          if (err) {
            console.error('Erro ao adicionar like:', err);
            return res.status(500).json({ 
              error: 'Erro interno do servidor' 
            });
          }

          res.json({
            success: true,
            message: 'Review curtido',
            action: 'liked'
          });
        });
      }
    });
  } catch (error) {
    console.error('Erro ao processar curtida:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
});

// Verificar se usuário curtiu um review específico
app.get('/api/posts/:postId/like-status', checkDB, (req, res) => {
  const { postId } = req.params;
  const { id_user } = req.query;

  if (!id_user) {
    return res.status(400).json({ 
      error: 'ID do usuário é obrigatório' 
    });
  }

  const query = 'SELECT id_like FROM likes WHERE id_post = ? AND id_user = ?';
  
  db.query(query, [postId, id_user], (err, results) => {
    if (err) {
      console.error('Erro ao verificar status do like:', err);
      return res.status(500).json({ 
        error: 'Erro interno do servidor' 
      });
    }

    res.json({
      success: true,
      isLiked: results.length > 0
    });
  });
});

// ===========================================
// ROTAS PARA COMENTÁRIOS
// ===========================================

// Adicionar comentário
app.post('/api/posts/:postId/comments', checkDB, (req, res) => {
  try {
    const { postId } = req.params;
    const { id_user, comment_text } = req.body;

    if (!id_user || !comment_text) {
      return res.status(400).json({ 
        error: 'ID do usuário e texto do comentário são obrigatórios' 
      });
    }

    const query = `
      INSERT INTO comments (id_post, id_user, comment_text, created_at) 
      VALUES (?, ?, ?, NOW())
    `;

    db.query(query, [postId, id_user, comment_text], (err, result) => {
      if (err) {
        console.error('Erro ao adicionar comentário:', err);
        return res.status(500).json({ 
          error: 'Erro interno do servidor' 
        });
      }

      res.status(201).json({
        success: true,
        message: 'Comentário adicionado com sucesso!',
        commentId: result.insertId
      });
    });
  } catch (error) {
    console.error('Erro ao processar adição de comentário:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
});

// Buscar comentários de um review
app.get('/api/posts/:postId/comments', checkDB, (req, res) => {
  const { postId } = req.params;

  const query = `
    SELECT 
      c.id_comment,
      c.comment_text,
      c.created_at,
      a.username,
      a.id_user
    FROM comments c
    LEFT JOIN account a ON c.id_user = a.id_user
    WHERE c.id_post = ?
    ORDER BY c.created_at ASC
  `;

  db.query(query, [postId], (err, results) => {
    if (err) {
      console.error('Erro ao buscar comentários:', err);
      return res.status(500).json({ 
        error: 'Erro interno do servidor' 
      });
    }

    res.json({
      success: true,
      comments: results
    });
  });
});

// Deletar comentário (apenas o autor pode deletar)
app.delete('/api/posts/:postId/comments/:commentId', checkDB, (req, res) => {
  const { commentId } = req.params;
  const { id_user } = req.body;

  // Verificar se o comentário pertence ao usuário
  const checkQuery = 'SELECT id_user FROM comments WHERE id_comment = ?';
  
  db.query(checkQuery, [commentId], (err, results) => {
    if (err) {
      console.error('Erro ao verificar comentário:', err);
      return res.status(500).json({ 
        error: 'Erro interno do servidor' 
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ 
        error: 'Comentário não encontrado' 
      });
    }

    if (results[0].id_user !== parseInt(id_user)) {
      return res.status(403).json({ 
        error: 'Você não tem permissão para deletar este comentário' 
      });
    }

    // Deletar o comentário
    const deleteQuery = 'DELETE FROM comments WHERE id_comment = ?';
    
    db.query(deleteQuery, [commentId], (err) => {
      if (err) {
        console.error('Erro ao deletar comentário:', err);
        return res.status(500).json({ 
          error: 'Erro interno do servidor' 
        });
      }

      res.json({
        success: true,
        message: 'Comentário deletado com sucesso!'
      });
    });
  });
});

// ===========================================
// ROTAS ADICIONAIS PARA ESTATÍSTICAS
// ===========================================

// Obter estatísticas de um review
app.get('/api/posts/:postId/stats', checkDB, (req, res) => {
  try {
    const { postId } = req.params;

    const query = `
      SELECT 
        (SELECT COUNT(*) FROM likes WHERE id_post = ?) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE id_post = ?) as comments_count
    `;

    db.query(query, [postId, postId], (err, results) => {
      if (err) {
        console.error('Erro ao buscar estatísticas:', err);
        return res.status(500).json({ 
          error: 'Erro interno do servidor' 
        });
      }

      res.json({
        success: true,
        stats: results[0]
      });
    });
  } catch (error) {
    console.error('Erro ao processar estatísticas:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
});

// Buscar usuários que curtiram um review
app.get('/api/posts/:postId/likes', checkDB, (req, res) => {
  const { postId } = req.params;

  const query = `
    SELECT 
      a.id_user,
      a.username,
      l.created_at
    FROM likes l
    LEFT JOIN account a ON l.id_user = a.id_user
    WHERE l.id_post = ?
    ORDER BY l.created_at DESC
  `;

  db.query(query, [postId], (err, results) => {
    if (err) {
      console.error('Erro ao buscar curtidas:', err);
      return res.status(500).json({ 
        error: 'Erro interno do servidor' 
      });
    }

    res.json({
      success: true,
      likes: results
    });
  });
});

// Buscar reviews por rating
app.get('/api/posts/rating/:rating', checkDB, (req, res) => {
  const { rating } = req.params;

  // Validar rating
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ 
      error: 'Rating deve estar entre 1 e 5' 
    });
  }

  const query = `
    SELECT 
      p.id_post,
      p.rating,
      p.caption,
      p.category,
      p.product_photo,
      p.product_url,
      p.created_at,
      a.username,
      a.id_user,
      COUNT(DISTINCT l.id_like) as likes_count,
      COUNT(DISTINCT c.id_comment) as comments_count
    FROM post p
    LEFT JOIN account a ON p.id_user = a.id_user
    LEFT JOIN likes l ON p.id_post = l.id_post
    LEFT JOIN comments c ON p.id_post = c.id_post
    WHERE p.rating = ?
    GROUP BY p.id_post
    ORDER BY p.created_at DESC
  `;

  db.query(query, [rating], (err, results) => {
    if (err) {
      console.error('Erro ao buscar reviews por rating:', err);
      return res.status(500).json({ 
        error: 'Erro interno do servidor' 
      });
    }

    res.json({
      success: true,
      posts: results
    });
  });
});

// Buscar categorias disponíveis
app.get('/api/categories', checkDB, (req, res) => {
  const query = 'SELECT DISTINCT category FROM post ORDER BY category ASC';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Erro ao buscar categorias:', err);
      return res.status(500).json({ 
        error: 'Erro interno do servidor' 
      });
    }

    const categories = results.map(row => row.category);

    res.json({
      success: true,
      categories: categories
    });
  });
});

// ===========================================
// ROTAS PARA TELA DE PERFIL
// ===========================================

// Rota para buscar dados do usuário (perfil)
app.get('/api/users/profile/:userId', checkDB, async (req, res) => {
  try {
    const { userId } = req.params;

    const query = 'SELECT id, username, email, birth_date FROM account WHERE id = ?';

    db.query(query, [userId], (err, results) => {
      if (err) {
        console.error('Erro ao buscar usuário:', err);
        return res.status(500).json({ 
          error: 'Erro interno do servidor' 
        });
      }

      if (results.length === 0) {
        return res.status(404).json({ 
          error: 'Usuário não encontrado' 
        });
      }

      res.status(200).json({
        success: true,
        user: results[0]
      });
    });

  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
});

// Rota para atualizar username do usuário
app.put('/api/users/update-name', checkDB, async (req, res) => {
  try {
    const { userId, novoNome } = req.body;

    // Validação básica
    if (!userId || !novoNome) {
      return res.status(400).json({ 
        error: 'ID do usuário e novo username são obrigatórios' 
      });
    }

    // Validar tamanho do username
    if (novoNome.trim().length < 3) {
      return res.status(400).json({ 
        error: 'O username deve ter pelo menos 3 caracteres' 
      });
    }

    const query = 'UPDATE account SET username = ? WHERE id = ?';

    db.query(query, [novoNome.trim(), userId], (err, result) => {
      if (err) {
        console.error('Erro ao atualizar username:', err);
        return res.status(500).json({ 
          error: 'Erro interno do servidor' 
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ 
          error: 'Usuário não encontrado' 
        });
      }

      res.status(200).json({
        success: true,
        message: 'Nome atualizado com sucesso!',
        novoNome: novoNome.trim()
      });
    });

  } catch (error) {
    console.error('Erro ao atualizar username:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
});


// ===========================================
// INICIALIZAÇÃO DO SERVIDOR
// ===========================================
app.listen(PORT, '0.0.0.0',() => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 Status: http://localhost:${PORT}/api/status`);
  console.log(`🧪 Teste: http://localhost:${PORT}/api/test`);
  
});