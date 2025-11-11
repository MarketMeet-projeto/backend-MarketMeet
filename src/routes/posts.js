module.exports = (app) => {
  const { getDB, checkDB } = require('../db');
  const authMiddleware = require('../middlewares/auth');

  // Criar nova publicação/review
  app.post('/api/posts/create', checkDB, authMiddleware, (req, res) => {
    try {
      // 🔐 Pegar id_user do JWT, não do body (segurança)
      const id_user = req.user.id_user;
      const { rating, caption, category, product_photo, product_url } = req.body;

      // Validação: id_user vem do JWT autenticado
      if (!id_user) {
        return res.status(401).json({
          error: 'Usuário não autenticado'
        });
      }

      // Validar rating se fornecido (deve ser entre 1 e 5)
      if (rating !== undefined && (rating < 1 || rating > 5)) {
        return res.status(400).json({
          error: 'Rating deve estar entre 1 e 5'
        });
      }

      // Construir query dinamicamente baseado nos campos fornecidos
      let fields = ['id_user', 'created_at'];
      let placeholders = ['?', 'NOW()'];
      let values = [id_user];

      if (rating !== undefined) {
        fields.push('rating');
        placeholders.push('?');
        values.push(rating);
      }

      if (caption !== undefined) {
        fields.push('caption');
        placeholders.push('?');
        values.push(caption);
      }

      if (category !== undefined) {
        fields.push('category');
        placeholders.push('?');
        values.push(category);
      }

      if (product_photo !== undefined) {
        fields.push('product_photo');
        placeholders.push('?');
        values.push(product_photo);
      }

      if (product_url !== undefined) {
        fields.push('product_url');
        placeholders.push('?');
        values.push(product_url);
      }

      const query = `
        INSERT INTO post (${fields.join(', ')}) 
        VALUES (${placeholders.join(', ')})
      `;

      const db = getDB();
      db.query(query, values, (err, result) => {
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

      const db = getDB();
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
        a.id_user,
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

    const db = getDB();
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

    const db = getDB();
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
    const db = getDB();
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
  app.post('/api/posts/:postId/like', checkDB, authMiddleware, (req, res) => {
    try {
      const { postId } = req.params;
      // 🔐 Pegar id_user do JWT, não do body
      const id_user = req.user.id_user;

      if (!id_user) {
        return res.status(401).json({
          error: 'Usuário não autenticado'
        });
      }

      // Verificar se o usuário já curtiu
      const checkQuery = 'SELECT id_like FROM likes WHERE id_post = ? AND id_user = ?';
      const db = getDB();
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
    const db = getDB();
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
  app.post('/api/posts/:postId/comments', checkDB, authMiddleware, (req, res) => {
    try {
      const { postId } = req.params;
      // 🔐 Pegar id_user do JWT, não do body
      const id_user = req.user.id_user;
      const { comment_text } = req.body;

      // Validação: id_user vem do JWT autenticado
      if (!id_user) {
        return res.status(401).json({
          error: 'Usuário não autenticado'
        });
      }

      // Se comment_text não for fornecido, criar comentário vazio
      const comment = comment_text || '';

      const query = `
        INSERT INTO comments (id_post, id_user, comment_text, created_at) 
        VALUES (?, ?, ?, NOW())
      `;

      const db = getDB();
      db.query(query, [postId, id_user, comment], (err, result) => {
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

    const db = getDB();
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
    const db = getDB();

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

      const db = getDB();
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

    const db = getDB();
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

    const db = getDB();
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
    const db = getDB();
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
};
