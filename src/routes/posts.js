
module.exports = (app) => {
  const { getDB, checkDB } = require('../db');
  const authMiddleware = require('../middlewares/auth');
  const logger = require('../utils/logger');

  // =============================================
  // ROTA: CRIAR PUBLICAÇÃO/REVIEW (CORRIGIDA)
  // =============================================
  app.post('/api/posts/create', checkDB, authMiddleware, async (req, res) => {
    try {
      console.log('\n' + '='.repeat(60));
      console.log('🔵 [CREATE POST] - Requisição recebida');
      console.log('='.repeat(60));

      // 🔐 Pegar id_user do JWT autenticado
      const id_user = req.user?.id_user;
      const { rating, caption, category, product_photo, product_url } = req.body;

      console.log('📦 Dados recebidos:');
      console.log('  - id_user (do JWT):', id_user);
      console.log('  - rating:', rating);
      console.log('  - caption:', caption);
      console.log('  - category:', category);
      console.log('  - product_photo:', product_photo ? 'presente' : 'vazio');
      console.log('  - product_url:', product_url);

      // ============================================
      // 1. VALIDAÇÃO: id_user vem do JWT autenticado
      // ============================================
      console.log('\n🟡 [VALIDATE] - Validando autenticação...');

      if (!id_user) {
        console.log('❌ id_user não encontrado no JWT');
        return res.status(401).json({
          error: 'Usuário não autenticado. Token inválido ou expirado.',
          debug: { id_user }
        });
      }

      console.log('✅ Usuário autenticado: ID', id_user);

      // ============================================
      // 2. VALIDAÇÃO: pelo menos caption deve existir
      // ============================================
      console.log('\n🟡 [VALIDATE] - Verificando campos obrigatórios...');

      if (!caption || caption.trim() === '') {
        console.log('❌ Caption vazio');
        return res.status(400).json({
          error: 'Caption é obrigatório. Forneça um texto para o post.'
        });
      }

      console.log('✅ Caption válido:', caption.substring(0, 50) + '...');

      // ============================================
      // 3. VALIDAÇÃO: rating deve estar entre 1-5
      // ============================================
      console.log('\n🟡 [VALIDATE] - Validando rating...');

      if (rating !== undefined && rating !== null) {
        const ratingNum = Number(rating);
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
          console.log('❌ Rating inválido:', rating);
          return res.status(400).json({
            error: 'Rating deve estar entre 1 e 5'
          });
        }
        console.log('✅ Rating válido:', ratingNum);
      } else {
        console.log('⚪ Rating não fornecido (opcional)');
      }

      // ============================================
      // 4. CONSTRUIR QUERY DINAMICAMENTE
      // ============================================
      console.log('\n🟡 [BUILD QUERY] - Construindo query INSERT...');

      let fields = ['id_user', 'created_at'];
      let placeholders = ['?', 'NOW()'];
      let values = [id_user];

      // Adicionar rating se fornecido
      if (rating !== undefined && rating !== null) {
        fields.push('rating');
        placeholders.push('?');
        values.push(Number(rating));
      }

      // Adicionar caption (obrigatório)
      if (caption !== undefined && caption !== null) {
        fields.push('caption');
        placeholders.push('?');
        values.push(caption.trim());
      }

      // Adicionar category se fornecido
      if (category !== undefined && category !== null && category.trim() !== '') {
        fields.push('category');
        placeholders.push('?');
        values.push(category.trim());
      }

      // Adicionar product_photo se fornecido
      if (product_photo !== undefined && product_photo !== null && product_photo.trim() !== '') {
        fields.push('product_photo');
        placeholders.push('?');
        values.push(product_photo.trim());
      }

      // Adicionar product_url se fornecido
      if (product_url !== undefined && product_url !== null && product_url.trim() !== '') {
        fields.push('product_url');
        placeholders.push('?');
        values.push(product_url.trim());
      }

      const query = `
        INSERT INTO post (${fields.join(', ')}) 
        VALUES (${placeholders.join(', ')})
      `;

      console.log('📋 Query:', query);
      console.log('📊 Valores:', values);
      console.log('✅ Query construída com sucesso');

      // ============================================
      // 5. EXECUTAR INSERT NO BANCO
      // ============================================
      console.log('\n🟡 [DB INSERT] - Inserindo no banco...');

      const db = getDB();
      
      db.query(query, values, async (err, result) => {
        if (err) {
          console.error('❌ ERRO ao inserir no banco:', err);
          console.error('  - Código:', err.code);
          console.error('  - Mensagem:', err.message);
          console.error('  - SQL:', err.sql);
          
          return res.status(500).json({
            error: 'Erro ao criar post no banco de dados',
            debug: process.env.NODE_ENV === 'development' ? {
              code: err.code,
              message: err.message,
              sql: err.sql
            } : undefined
          });
        }

        console.log('✅ Post inserido com sucesso!');
        console.log('  - ID gerado:', result.insertId);
        console.log('  - Affected rows:', result.affectedRows);

        // ============================================
        // 6. EMITIR EVENTO WEBSOCKET
        // ============================================
        console.log('\n🟡 [WEBSOCKET] - Preparando evento WebSocket...');

        try {
          const io = req.app.get('io');
          
          if (io) {
            const newPost = {
              id_post: result.insertId,
              rating: rating || null,
              caption: caption,
              category: category || null,
              product_photo: product_photo || null,
              product_url: product_url || null,
              id_user: id_user,
              username: req.user.username,
              likes_count: 0,
              comments_count: 0,
              isLiked: false,
              created_at: new Date().toISOString()
            };

            console.log('📤 Emitindo evento post:created...');

            // Emitir para todos os usuários
            io.emit('post:created', {
              post: newPost,
              category: category,
              timestamp: new Date().toISOString()
            });

            // Emitir também para categoria específica
            if (category && category.trim() !== '') {
              io.to(`category:${category}`).emit('post:new', {
                post: newPost,
                category: category,
                timestamp: new Date().toISOString()
              });
              console.log(`📝 [WebSocket] Post emitido para categoria: ${category}`);
            }

            console.log(`✅ [WebSocket] Eventos emitidos com sucesso (Post ID: ${result.insertId})`);
          } else {
            console.warn('⚠️ WebSocket não está disponível (io não configurado)');
          }
        } catch (wsError) {
          console.error('⚠️ Erro ao emitir WebSocket (não bloqueia resposta):', wsError);
          // Não falhar a resposta por erro de WebSocket
        }

        // ============================================
        // 7. RETORNAR SUCESSO
        // ============================================
        console.log('\n✅ [SUCCESS] - Resposta de sucesso enviada');
        console.log('='.repeat(60) + '\n');

        res.status(201).json({
          success: true,
          message: 'Post criado com sucesso!',
          postId: result.insertId,
          post: {
            id_post: result.insertId,
            id_user: id_user,
            caption: caption,
            rating: rating || null,
            category: category || null,
            product_photo: product_photo || null,
            product_url: product_url || null,
            created_at: new Date().toISOString()
          }
        });
      });

    } catch (error) {
      console.error('❌ [FATAL ERROR] - Erro não capturado:', error);
      console.error('Stack:', error.stack);
      console.log('='.repeat(60) + '\n');

      res.status(500).json({
        error: 'Erro interno do servidor',
        debug: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // =============================================
  // ROTA: BUSCAR TIMELINE (CORRIGIDA)
  // =============================================
  app.get('/api/posts/timeline', checkDB, authMiddleware, (req, res) => {
    try {
      const id_user = req.user.id_user;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      console.log(`\n🔵 [GET TIMELINE] - Página ${page}, Limit ${limit}`);

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
        GROUP BY p.id_post, a.id_user, a.username, p.rating, p.caption, p.category, p.product_photo, p.product_url, p.created_at
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const db = getDB();
      db.query(query, [id_user, limit, offset], (err, results) => {
        if (err) {
          console.error('❌ Erro ao buscar timeline:', err);
          return res.status(500).json({
            error: 'Erro ao buscar timeline',
            debug: process.env.NODE_ENV === 'development' ? err.message : undefined
          });
        }

        console.log(`✅ Timeline carregada: ${results.length} posts`);
        res.json({
          success: true,
          posts: results,
          pagination: { page, limit, offset, total: results.length }
        });
      });
    } catch (error) {
      console.error('❌ Erro ao buscar timeline:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  });

  // =============================================
  // ROTAS ADICIONAIS (SEM ALTERAÇÕES CRÍTICAS)
  // =============================================

  // Buscar reviews de um usuário específico
  app.get('/api/posts/user/:userId', checkDB, authMiddleware, (req, res) => {
    const { userId } = req.params;
    const id_user = req.user.id_user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

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
      GROUP BY p.id_post, a.id_user, a.username, p.rating, p.caption, p.category, p.product_photo, p.product_url, p.created_at
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const db = getDB();
    db.query(query, [id_user, userId, limit, offset], (err, results) => {
      if (err) {
        console.error('❌ Erro ao buscar reviews do usuário:', err);
        return res.status(500).json({
          error: 'Erro ao buscar reviews do usuário'
        });
      }

      res.json({
        success: true,
        posts: results,
        pagination: { page, limit, offset }
      });
    });
  });

  // Buscar reviews por categoria
  app.get('/api/posts/category/:category', checkDB, authMiddleware, (req, res) => {
    const { category } = req.params;
    const id_user = req.user.id_user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

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
      GROUP BY p.id_post, a.id_user, a.username, p.rating, p.caption, p.category, p.product_photo, p.product_url, p.created_at
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const db = getDB();
    db.query(query, [id_user, category, limit, offset], (err, results) => {
      if (err) {
        console.error('❌ Erro ao buscar reviews por categoria:', err);
        return res.status(500).json({
          error: 'Erro ao buscar reviews por categoria'
        });
      }

      res.json({
        success: true,
        posts: results,
        pagination: { page, limit, offset }
      });
    });
  });

<<<<<<< HEAD
  // Deletar review (apenas o autor pode deletar)
  app.delete('/api/posts/:postId', checkDB, authMiddleware, (req, res) => {
    const { postId } = req.params;
    const id_user = req.user.id_user;

    console.log(`\n🔵 [DELETE POST] - Deletando post ${postId}`);
    console.log(`  - Usuário: ${id_user}`);

    // Verificar se o post pertence ao usuário
    const checkQuery = 'SELECT id_user FROM post WHERE id_post = ?';
    const db = getDB();
    db.query(checkQuery, [postId], (err, results) => {
      if (err) {
        console.error('❌ Erro ao verificar post:', err);
        return res.status(500).json({
          error: 'Erro ao verificar post',
          debug: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }

      if (results.length === 0) {
        console.log('❌ Post não encontrado');
        return res.status(404).json({
          error: 'Post não encontrado'
        });
      }

      if (results[0].id_user !== id_user) {
        console.log('❌ Usuário não autorizado');
        return res.status(403).json({
          error: 'Você não tem permissão para deletar este post'
        });
      }

      console.log('✅ Post pertence ao usuário, deletando...');

      // PASSO 1: Deletar comentários associados
      console.log('🟡 [DELETE] - Deletando comentários...');
      const deleteCommentsQuery = 'DELETE FROM comments WHERE id_post = ?';
      db.query(deleteCommentsQuery, [postId], (err) => {
        if (err) {
          console.warn('⚠️ Erro ao deletar comentários:', err.message);
        } else {
          console.log('✅ Comentários deletados');
        }

        // PASSO 2: Deletar likes associados
        console.log('🟡 [DELETE] - Deletando likes...');
        const deleteLikesQuery = 'DELETE FROM likes WHERE id_post = ?';
        db.query(deleteLikesQuery, [postId], (err) => {
          if (err) {
            console.warn('⚠️ Erro ao deletar likes:', err.message);
          } else {
            console.log('✅ Likes deletados');
          }

          // PASSO 3: Deletar o post em si
          console.log('🟡 [DELETE] - Deletando post...');
          const deletePostQuery = 'DELETE FROM post WHERE id_post = ?';
          db.query(deletePostQuery, [postId], (err, result) => {
            if (err) {
              console.error('❌ Erro ao deletar post:', err);
              return res.status(500).json({
                error: 'Erro ao deletar post',
                debug: process.env.NODE_ENV === 'development' ? err.message : undefined
              });
            }

            console.log(`✅ Post ${postId} deletado com sucesso`);
            console.log('='.repeat(60) + '\n');

            res.json({
              success: true,
              message: 'Post deletado com sucesso!',
              postId: postId
            });
          });
        });
      });
    });
  });

  // =============================================
  // ROTAS DE LIKES
  // =============================================
=======
  // ===========================================
  // ROTAS PARA CURTIDAS (LIKES)
  // ===========================================
>>>>>>> d9f9ae7e32f61f773a461907049d9f2fcfbf01ad

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
<<<<<<< HEAD
          console.error('❌ Erro ao verificar like:', err);
=======
          console.error('❤️ [LIKE] Erro ao verificar like:', err);
>>>>>>> d9f9ae7e32f61f773a461907049d9f2fcfbf01ad
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
<<<<<<< HEAD
              console.error('❌ Erro ao remover like:', err);
=======
              console.error('❤️ [LIKE] Erro ao remover like:', err);
>>>>>>> d9f9ae7e32f61f773a461907049d9f2fcfbf01ad
              return res.status(500).json({
                error: 'Erro interno do servidor'
              });
            }

<<<<<<< HEAD
            try {
              const io = req.app.get('io');
              if (io) {
                io.emit('post:like-update', {
                  postId: postId,
                  action: 'unliked',
                  userId: id_user,
                  username: req.user.username,
                  timestamp: new Date().toISOString()
                });
              }
            } catch (wsError) {
              console.warn('⚠️ WebSocket error (não bloqueia):', wsError);
            }
=======
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
>>>>>>> d9f9ae7e32f61f773a461907049d9f2fcfbf01ad

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
<<<<<<< HEAD
              console.error('❌ Erro ao adicionar like:', err);
=======
              console.error('❤️ [LIKE] Erro ao adicionar like:', err);
>>>>>>> d9f9ae7e32f61f773a461907049d9f2fcfbf01ad
              return res.status(500).json({
                error: 'Erro interno do servidor'
              });
            }

<<<<<<< HEAD
            try {
              const io = req.app.get('io');
              if (io) {
                io.emit('post:like-update', {
                  postId: postId,
                  action: 'liked',
                  userId: id_user,
                  username: req.user.username,
                  timestamp: new Date().toISOString()
                });
              }
            } catch (wsError) {
              console.warn('⚠️ WebSocket error (não bloqueia):', wsError);
            }

            res.json({
              success: true,
              message: 'Post curtido',
              action: 'liked'
=======
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
>>>>>>> d9f9ae7e32f61f773a461907049d9f2fcfbf01ad
            });
          });
        }
      });
    } catch (error) {
<<<<<<< HEAD
      console.error('❌ Erro ao processar curtida:', error);
=======
      console.error('❤️ [LIKE] Erro ao processar curtida:', error);
>>>>>>> d9f9ae7e32f61f773a461907049d9f2fcfbf01ad
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  });

  app.get('/api/posts/:postId/like-status', checkDB, authMiddleware, (req, res) => {
    const { postId } = req.params;
    const id_user = req.user.id_user;

    const query = 'SELECT id_like FROM likes WHERE id_post = ? AND id_user = ?';
    const db = getDB();
    db.query(query, [postId, id_user], (err, results) => {
      if (err) {
        console.error('❌ Erro ao verificar status do like:', err);
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

  // =============================================
  // ROTAS DE COMENTÁRIOS
  // =============================================

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
          console.error('❌ Erro ao adicionar comentário:', err);
          return res.status(500).json({
            error: 'Erro interno do servidor'
          });
        }

<<<<<<< HEAD
        try {
          const io = req.app.get('io');
          if (io) {
            io.emit('post:comment-added', {
              postId: postId,
              commentId: result.insertId,
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
        } catch (wsError) {
          console.warn('⚠️ WebSocket error (não bloqueia):', wsError);
        }
=======
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
>>>>>>> d9f9ae7e32f61f773a461907049d9f2fcfbf01ad

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
      console.error('❌ Erro ao processar comentário:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  });

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
        console.error('❌ Erro ao buscar comentários:', err);
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

<<<<<<< HEAD
  app.delete('/api/posts/:postId/comments/:commentId', checkDB, authMiddleware, (req, res) => {
    const { commentId } = req.params;
    const id_user = req.user.id_user;
    const db = getDB();

    const checkQuery = 'SELECT id_user FROM comments WHERE id_comment = ?';
    db.query(checkQuery, [commentId], (err, results) => {
=======
  // Deletar comentário (apenas o autor pode deletar)
  app.delete('/api/posts/:postId/comments/:commentId', checkDB, authMiddleware, (req, res) => {
    const { postId, commentId } = req.params;
    const id_user = req.user.id_user;
    const io = req.app.get('io');
    const db = getDB();

    // Verificar se o comentário pertence ao usuário
    const checkQuery = 'SELECT id_post FROM comments WHERE id_comment = ? AND id_user = ?';
    db.query(checkQuery, [commentId, id_user], (err, results) => {
>>>>>>> d9f9ae7e32f61f773a461907049d9f2fcfbf01ad
      if (err) {
        console.error('❌ Erro ao verificar comentário:', err);
        return res.status(500).json({
          error: 'Erro interno do servidor'
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
<<<<<<< HEAD
          error: 'Comentário não encontrado'
        });
      }

      if (results[0].id_user !== id_user) {
        return res.status(403).json({
          error: 'Você não tem permissão para deletar este comentário'
=======
          error: 'Comentário não encontrado ou sem permissão'
>>>>>>> d9f9ae7e32f61f773a461907049d9f2fcfbf01ad
        });
      }

      const deleteQuery = 'DELETE FROM comments WHERE id_comment = ?';
      db.query(deleteQuery, [commentId], (err) => {
        if (err) {
          console.error('❌ Erro ao deletar comentário:', err);
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

  // =============================================
  // ROTAS DE ESTATÍSTICAS E OUTRAS
  // =============================================

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
          console.error('❌ Erro ao buscar estatísticas:', err);
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
      console.error('❌ Erro ao processar estatísticas:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  });

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
<<<<<<< HEAD
        console.error('❌ Erro ao buscar curtidas:', err);
=======
        console.error('❤️ [GET_LIKES] Erro ao buscar curtidas:', err);
>>>>>>> d9f9ae7e32f61f773a461907049d9f2fcfbf01ad
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

  app.get('/api/posts/rating/:rating', checkDB, authMiddleware, (req, res) => {
    const { rating } = req.params;
    const id_user = req.user.id_user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

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
      GROUP BY p.id_post, a.id_user, a.username, p.rating, p.caption, p.category, p.product_photo, p.product_url, p.created_at
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const db = getDB();
    db.query(query, [id_user, rating, limit, offset], (err, results) => {
      if (err) {
        console.error('❌ Erro ao buscar reviews por rating:', err);
        return res.status(500).json({
          error: 'Erro interno do servidor'
        });
      }

      res.json({
        success: true,
        posts: results,
        pagination: { page, limit, offset }
      });
    });
  });

  app.get('/api/categories', checkDB, (req, res) => {
    const query = 'SELECT DISTINCT category FROM post WHERE category IS NOT NULL AND category != "" ORDER BY category ASC';
    const db = getDB();
    db.query(query, (err, results) => {
      if (err) {
        console.error('❌ Erro ao buscar categorias:', err);
        return res.status(500).json({
          error: 'Erro interno do servidor'
        });
      }

      const categories = results.map(row => row.category).filter(cat => cat);

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
