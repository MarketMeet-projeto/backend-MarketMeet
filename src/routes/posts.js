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

        // 🔌 Emitir evento WebSocket para nova postagem
        const io = req.app.get('io');
        if (io) {
          const newPost = {
            id_post: result.insertId,
            rating: rating,
            caption: caption,
            category: category,
            product_photo: product_photo,
            product_url: product_url,
            id_user: id_user,
            username: req.user.username,
            likes_count: 0,
            comments_count: 0,
            isLiked: false,
            created_at: new Date().toISOString()
          };

          // Emitir para todos os usuários
          io.emit('post:created', {
            post: newPost,
            category: category,
            timestamp: new Date().toISOString()
          });

          // Emitir também para categoria específica
          if (category) {
            io.to(`category:${category}`).emit('post:new', {
              post: newPost,
              category: category,
              timestamp: new Date().toISOString()
            });
          }

          console.log(`📝 [WebSocket] Nova postagem emitida: ${result.insertId}`);
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
  app.get('/api/posts/timeline', checkDB, authMiddleware, (req, res) => {
    try {
      const id_user = req.user.id_user;
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
          COUNT(DISTINCT c.id_comment) as comments_count,
          CASE WHEN EXISTS(SELECT 1 FROM likes WHERE id_post = p.id_post AND id_user = ?) THEN true ELSE false END as isLiked
        FROM post p
        LEFT JOIN account a ON p.id_user = a.id_user
        LEFT JOIN likes l ON p.id_post = l.id_post
        LEFT JOIN comments c ON p.id_post = c.id_post
        GROUP BY p.id_post
        ORDER BY p.created_at DESC
      `;

      const db = getDB();
      db.query(query, [id_user], (err, results) => {
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
  app.get('/api/posts/user/:userId', checkDB, authMiddleware, (req, res) => {
    const { userId } = req.params;
    const id_user = req.user.id_user;

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
        COUNT(DISTINCT c.id_comment) as comments_count,
        CASE WHEN EXISTS(SELECT 1 FROM likes WHERE id_post = p.id_post AND id_user = ?) THEN true ELSE false END as isLiked
      FROM post p
      LEFT JOIN account a ON p.id_user = a.id_user
      LEFT JOIN likes l ON p.id_post = l.id_post
      LEFT JOIN comments c ON p.id_post = c.id_post
      WHERE p.id_user = ?
      GROUP BY p.id_post
      ORDER BY p.created_at DESC
    `;

    const db = getDB();
    db.query(query, [id_user, userId], (err, results) => {
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
  app.get('/api/posts/category/:category', checkDB, authMiddleware, (req, res) => {
    const { category } = req.params;
    const id_user = req.user.id_user;

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
        COUNT(DISTINCT c.id_comment) as comments_count,
        CASE WHEN EXISTS(SELECT 1 FROM likes WHERE id_post = p.id_post AND id_user = ?) THEN true ELSE false END as isLiked
      FROM post p
      LEFT JOIN account a ON p.id_user = a.id_user
      LEFT JOIN likes l ON p.id_post = l.id_post
      LEFT JOIN comments c ON p.id_post = c.id_post
      WHERE p.category = ?
      GROUP BY p.id_post
      ORDER BY p.created_at DESC
    `;

    const db = getDB();
    db.query(query, [id_user, category], (err, results) => {
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

  // ===========================================
  // ROTAS PARA CURTIDAS (LIKES)
  // ===========================================

  // Curtir/Descurtir review
  app.post('/api/posts/:postId/like', checkDB, authMiddleware, (req, res) => {
    try {
      const { postId } = req.params;
      const id_user = req.user.id_user;
      const io = req.app.get('io');

      console.log('❤️ [LIKE] === INICIANDO CURTIDA ===');
      console.log('❤️ [LIKE] postId:', postId, 'type:', typeof postId);
      console.log('❤️ [LIKE] id_user:', id_user, 'type:', typeof id_user);
      console.log('❤️ [LIKE] username:', req.user.username);

      if (!id_user) {
        return res.status(401).json({
          error: 'Usuário não autenticado'
        });
      }

      const checkQuery = 'SELECT id_like FROM likes WHERE id_post = ? AND id_user = ?';
      const db = getDB();
      
      db.query(checkQuery, [postId, id_user], (err, results) => {
        if (err) {
          console.error('❤️ [LIKE] Erro ao verificar like:', err);
          return res.status(500).json({
            error: 'Erro interno do servidor'
          });
        }

        console.log('❤️ [LIKE] Already liked?:', results.length > 0);

        const getPostQuery = `
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
          WHERE p.id_post = ?
          GROUP BY p.id_post
        `;

        if (results.length > 0) {
          // Remove curtida
          console.log('❤️ [LIKE] Removendo like existente');
          const deleteQuery = 'DELETE FROM likes WHERE id_post = ? AND id_user = ?';
          db.query(deleteQuery, [postId, id_user], (err) => {
            if (err) {
              console.error('❤️ [LIKE] Erro ao remover like:', err);
              return res.status(500).json({
                error: 'Erro interno do servidor'
              });
            }

            console.log('❤️ [LIKE] Like removido, buscando post atualizado');
            // Buscar post atualizado
            db.query(getPostQuery, [postId], (err, postResults) => {
              const post = postResults?.[0] || null;
              
              console.log('❤️ [LIKE] Post retornado após DELETE:', JSON.stringify(post, null, 2));
              
              // Emitir WebSocket
              if (io) {
                io.emit('timeline:update', {
                  type: 'like-removed',
                  post: post,
                  postId: postId,
                  action: 'unliked',
                  userId: id_user,
                  timestamp: new Date().toISOString()
                });
              }

              const response = {
                success: true,
                message: 'Curtida removida',
                action: 'unliked',
                post: post
              };

              console.log('❤️ [LIKE] === RESPOSTA FINAL (UNLIKE) ===');
              console.log('❤️ [LIKE] Response:', JSON.stringify(response, null, 2));
              
              res.json(response);
            });
          });
        } else {
          // Adiciona curtida
          console.log('❤️ [LIKE] Adicionando nova curtida');
          const insertQuery = 'INSERT INTO likes (id_post, id_user, created_at) VALUES (?, ?, NOW())';
          db.query(insertQuery, [postId, id_user], (err, result) => {
            if (err) {
              console.error('❤️ [LIKE] Erro ao adicionar like:', err);
              return res.status(500).json({
                error: 'Erro interno do servidor'
              });
            }

            console.log('❤️ [LIKE] Like inserido, ID:', result.insertId);
            console.log('❤️ [LIKE] Buscando post atualizado');
            // Buscar post atualizado
            db.query(getPostQuery, [postId], (err, postResults) => {
              const post = postResults?.[0] || null;

              console.log('❤️ [LIKE] Post retornado após INSERT:', JSON.stringify(post, null, 2));

              // Emitir WebSocket
              if (io) {
                io.emit('timeline:update', {
                  type: 'like-added',
                  post: post,
                  postId: postId,
                  action: 'liked',
                  userId: id_user,
                  likeId: result.insertId,
                  timestamp: new Date().toISOString()
                });
              }

              const response = {
                success: true,
                message: 'Review curtido',
                action: 'liked',
                post: post,
                likeId: result.insertId
              };

              console.log('❤️ [LIKE] === RESPOSTA FINAL (LIKE) ===');
              console.log('❤️ [LIKE] Response:', JSON.stringify(response, null, 2));
              
              res.json(response);
            });
          });
        }
      });
    } catch (error) {
      console.error('❤️ [LIKE] Erro ao processar curtida:', error);
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
      const id_user = req.user.id_user;
      const { comment_text } = req.body;
      const io = req.app.get('io');

      if (!id_user) {
        return res.status(401).json({
          error: 'Usuário não autenticado'
        });
      }

      const comment = comment_text || '';

      const insertQuery = `
        INSERT INTO comments (id_post, id_user, comment_text, created_at) 
        VALUES (?, ?, ?, NOW())
      `;

      const db = getDB();
      db.query(insertQuery, [postId, id_user, comment], (err, result) => {
        if (err) {
          console.error('Erro ao adicionar comentário:', err);
          return res.status(500).json({
            error: 'Erro interno do servidor'
          });
        }

        const getPostQuery = `
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
          WHERE p.id_post = ?
          GROUP BY p.id_post
        `;

        // Buscar post atualizado
        db.query(getPostQuery, [postId], (err, postResults) => {
          const post = postResults?.[0] || null;

          // Emitir WebSocket
          if (io) {
            io.emit('timeline:update', {
              type: 'comment-added',
              post: post,
              postId: postId,
              comment: {
                id_comment: result.insertId,
                id_post: postId,
                id_user: id_user,
                comment_text: comment,
                username: req.user.username,
                created_at: new Date().toISOString()
              },
              timestamp: new Date().toISOString()
            });
          }

          res.status(201).json({
            success: true,
            message: 'Comentário adicionado com sucesso!',
            commentId: result.insertId,
            post: post
          });
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
  app.delete('/api/posts/:postId/comments/:commentId', checkDB, authMiddleware, (req, res) => {
    const { postId, commentId } = req.params;
    const id_user = req.user.id_user;
    const io = req.app.get('io');
    const db = getDB();

    // Verificar se o comentário pertence ao usuário
    const checkQuery = 'SELECT id_post FROM comments WHERE id_comment = ? AND id_user = ?';
    db.query(checkQuery, [commentId, id_user], (err, results) => {
      if (err) {
        console.error('Erro ao verificar comentário:', err);
        return res.status(500).json({
          error: 'Erro interno do servidor'
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          error: 'Comentário não encontrado ou sem permissão'
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

        // Buscar post atualizado
        const getPostQuery = `
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
          WHERE p.id_post = ?
          GROUP BY p.id_post
        `;

        db.query(getPostQuery, [postId], (err, postResults) => {
          const post = postResults?.[0] || null;

          // Emitir WebSocket
          if (io) {
            io.emit('timeline:update', {
              type: 'comment-removed',
              post: post,
              postId: postId,
              commentId: commentId,
              timestamp: new Date().toISOString()
            });
          }

          res.json({
            success: true,
            message: 'Comentário deletado com sucesso!',
            post: post
          });
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

    console.log('❤️ [GET_LIKES] Buscando curtidas para postId:', postId, 'type:', typeof postId);

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
        console.error('❤️ [GET_LIKES] Erro ao buscar curtidas:', err);
        return res.status(500).json({
          error: 'Erro interno do servidor'
        });
      }

      console.log('❤️ [GET_LIKES] Curtidas encontradas:', results.length);
      console.log('❤️ [GET_LIKES] Dados completos:', JSON.stringify(results, null, 2));

      const response = {
        success: true,
        likes: results,
        likedBy: results.map(l => ({ id_user: l.id_user, username: l.username }))
      };

      console.log('❤️ [GET_LIKES] Resposta:', JSON.stringify(response, null, 2));

      res.json(response);
    });
  });

  // Buscar reviews por rating
  app.get('/api/posts/rating/:rating', checkDB, authMiddleware, (req, res) => {
    const { rating } = req.params;
    const id_user = req.user.id_user;

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
        COUNT(DISTINCT c.id_comment) as comments_count,
        CASE WHEN EXISTS(SELECT 1 FROM likes WHERE id_post = p.id_post AND id_user = ?) THEN true ELSE false END as isLiked
      FROM post p
      LEFT JOIN account a ON p.id_user = a.id_user
      LEFT JOIN likes l ON p.id_post = l.id_post
      LEFT JOIN comments c ON p.id_post = c.id_post
      WHERE p.rating = ?
      GROUP BY p.id_post
      ORDER BY p.created_at DESC
    `;

    const db = getDB();
    db.query(query, [id_user, rating], (err, results) => {
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

  // =============================================
  // EDITAR POST
  // =============================================
  app.put('/api/posts/:postId', checkDB, authMiddleware, (req, res) => {
    try {
      const { postId } = req.params;
      const id_user = req.user.id_user;
      const { rating, caption, category, product_photo, product_url } = req.body;
      const io = req.app.get('io');

      if (!id_user) {
        return res.status(401).json({
          error: 'Usuário não autenticado'
        });
      }

      // Validar rating se fornecido
      if (rating !== undefined && (rating < 1 || rating > 5)) {
        return res.status(400).json({
          error: 'Rating deve estar entre 1 e 5'
        });
      }

      const db = getDB();

      // Primeiro verificar se o post pertence ao usuário
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
            error: 'Post não encontrado'
          });
        }

        if (results[0].id_user !== id_user) {
          return res.status(403).json({
            error: 'Você não tem permissão para editar este post'
          });
        }

        // Construir query de atualização dinamicamente
        let updates = [];
        let values = [];

        if (rating !== undefined) {
          updates.push('rating = ?');
          values.push(rating);
        }

        if (caption !== undefined) {
          updates.push('caption = ?');
          values.push(caption);
        }

        if (category !== undefined) {
          updates.push('category = ?');
          values.push(category);
        }

        if (product_photo !== undefined) {
          updates.push('product_photo = ?');
          values.push(product_photo);
        }

        if (product_url !== undefined) {
          updates.push('product_url = ?');
          values.push(product_url);
        }

        if (updates.length === 0) {
          return res.status(400).json({
            error: 'Nenhum campo fornecido para atualizar'
          });
        }

        values.push(postId);

        const updateQuery = `UPDATE post SET ${updates.join(', ')} WHERE id_post = ?`;

        db.query(updateQuery, values, (err) => {
          if (err) {
            console.error('Erro ao atualizar post:', err);
            return res.status(500).json({
              error: 'Erro interno do servidor'
            });
          }

          // Buscar post atualizado
          const getPostQuery = `
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
            WHERE p.id_post = ?
            GROUP BY p.id_post
          `;

          db.query(getPostQuery, [postId], (err, postResults) => {
            const post = postResults?.[0] || null;

            // Emitir WebSocket
            if (io) {
              io.emit('timeline:update', {
                type: 'post-edited',
                post: post,
                postId: postId,
                timestamp: new Date().toISOString()
              });
            }

            res.json({
              success: true,
              message: 'Post atualizado com sucesso!',
              post: post
            });
          });
        });
      });
    } catch (error) {
      console.error('Erro ao processar edição do post:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  });

  // =============================================
  // DELETAR POST
  // =============================================
  app.delete('/api/posts/:postId', checkDB, authMiddleware, (req, res) => {
    try {
      const { postId } = req.params;
      const id_user = req.user.id_user;
      const io = req.app.get('io');

      if (!id_user) {
        return res.status(401).json({
          error: 'Usuário não autenticado'
        });
      }

      const db = getDB();

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
            error: 'Post não encontrado'
          });
        }

        if (results[0].id_user !== id_user) {
          return res.status(403).json({
            error: 'Você não tem permissão para deletar este post'
          });
        }

        // Deletar likes
        db.query('DELETE FROM likes WHERE id_post = ?', [postId], (err) => {
          if (err) {
            console.error('Erro ao deletar likes:', err);
            return res.status(500).json({
              error: 'Erro interno do servidor'
            });
          }

          // Deletar comentários
          db.query('DELETE FROM comments WHERE id_post = ?', [postId], (err) => {
            if (err) {
              console.error('Erro ao deletar comentários:', err);
              return res.status(500).json({
                error: 'Erro interno do servidor'
              });
            }

            // Deletar o post
            db.query('DELETE FROM post WHERE id_post = ?', [postId], (err) => {
              if (err) {
                console.error('Erro ao deletar post:', err);
                return res.status(500).json({
                  error: 'Erro interno do servidor'
                });
              }

              // Emitir WebSocket
              if (io) {
                io.emit('timeline:update', {
                  type: 'post-deleted',
                  postId: postId,
                  timestamp: new Date().toISOString()
                });
              }

              res.json({
                success: true,
                message: 'Post deletado com sucesso!',
                postId: postId
              });
            });
          });
        });
      });
    } catch (error) {
      console.error('Erro ao processar deleção do post:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  });
};
