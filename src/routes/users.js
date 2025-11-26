const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AuthService = require('../services/auth.service');

module.exports = (app) => {
  const { getDB, checkDB } = require('../db');
  const db = getDB();
  const authService = new AuthService(db);

  // Criar usuário (requer banco)
  app.post('/api/users/create', checkDB, async (req, res) => {
    try {
      const {
        full_name,
        username,
        birth_date,
        phone,
        email,
        password,
        profile_photo,
        cnpj,
        user_type
      } = req.body;

      // Validação básica dos campos obrigatórios
      if (!username || !email || !password || !birth_date) {
        return res.status(400).json({
          error: 'username, email, password e birth_date são obrigatórios'
        });
      }

      // Validar e converter o formato da data DD/MM/YYYY -> YYYY-MM-DD
      const dataRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
      const match = birth_date.match(dataRegex);

      if (!match) {
        return res.status(400).json({
          error: 'Formato de data inválido. Use DD/MM/YYYY'
        });
      }

      const [, dia, mes, ano] = match;
      const dataBanco = `${ano}-${mes}-${dia}`;

      const dataObj = new Date(dataBanco);
      if (isNaN(dataObj.getTime())) {
        return res.status(400).json({
          error: 'Data inválida'
        });
      }

      // Criptografar senha
      const senhaHash = await bcrypt.hash(password, 10);

      // Preparar valores e garantir valores default quando necessário
      const userTypeValue = user_type || 'is_standard';
      const profilePhotoValue = profile_photo || 'sem_foto_oculos.png';
      const phoneValue = phone || null;
      const cnpjValue = cnpj || null;
      const fullNameValue = full_name || null;

      const query = `
        INSERT INTO account (
          full_name, username, birth_date, phone, email, password, profile_photo, cnpj, user_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const db = getDB();
      db.query(query, [
        fullNameValue,
        username,
        dataBanco,
        phoneValue,
        email,
        senhaHash,
        profilePhotoValue,
        cnpjValue,
        userTypeValue
      ], (err, result) => {
        if (err) {
          console.error('Erro ao criar usuário:', err);

          if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
              error: 'Este email ou username já está em uso'
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
  // Login de usuário
  app.post('/api/users/login', checkDB, async (req, res) => {
    const { email, password } = req.body;
    console.log('Tentativa de login para email:', email);

    try {
      if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
      }

      const result = await authService.loginUser(email, password);

      return res.json({
        success: true,
        message: 'Login realizado com sucesso!',
        token: result.token,
        user: result.user
      });
    } catch (err) {
      console.error('Erro no login:', err);
      return res.status(401).json({
        error: err.message || 'Erro ao fazer login'
      });
    }
  });

  // Buscar usuário por ID (requer banco)
  app.get('/api/users/:id', checkDB, (req, res) => {
    try {
      const { id } = req.params;

      const query = 'SELECT id_user, full_name, username, email, birth_date, phone, profile_photo, cnpj, user_type FROM account WHERE id_user = ?';
      const db = getDB();
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

  // Rota para buscar dados do usuário (perfil)
  app.get('/api/users/profile/:userId', checkDB, async (req, res) => {
    try {
      const { userId } = req.params;

      const query = 'SELECT id_user, full_name, username, email, birth_date, phone, profile_photo, cnpj, user_type FROM account WHERE id_user = ?';
      const db = getDB();

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

  const query = 'UPDATE account SET username = ? WHERE id_user = ?';
      const db = getDB();

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

  // Rota para atualizar dados do usuário
  app.put('/api/users/update', checkDB, async (req, res) => {
    try {
      const { id_user, username, birth_date, email, password} = req.body;

      // Validação básica
      if (!id_user) {
        return res.status(400).json({
          error: 'ID do usuário é obrigatório'
        });
      }

      // Iniciar construção da query dinâmica
      let updateFields = [];
      let queryParams = [];

      // Adicionar campos que foram fornecidos
      if (username) {
        if (username.trim().length < 3) {
          return res.status(400).json({
            error: 'Username deve ter pelo menos 3 caracteres'
          });
        }
        updateFields.push('username = ?');
        queryParams.push(username.trim());
      }

      if (email) {
        // Validação básica de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            error: 'Email inválido'
          });
        }
        updateFields.push('email = ?');
        queryParams.push(email.toLowerCase());
      }

      if (birth_date) {
        // Validar e converter o formato da data
        const dataRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
        const match = birth_date.match(dataRegex);
        
        if (!match) {
          return res.status(400).json({
            error: 'Formato de data inválido. Use DD/MM/YYYY'
          });
        }

        const [, dia, mes, ano] = match;
        const dataBanco = `${ano}-${mes}-${dia}`;
        
        // Validar se é uma data válida
        const dataObj = new Date(dataBanco);
        if (isNaN(dataObj.getTime())) {
          return res.status(400).json({
            error: 'Data inválida'
          });
        }

        updateFields.push('birth_date = ?');
        queryParams.push(dataBanco);
      }

      if (password) {
        if (password.length < 6) {
          return res.status(400).json({
            error: 'Senha deve ter pelo menos 6 caracteres'
          });
        }
        const senhaHash = await bcrypt.hash(password, 10);
        updateFields.push('password = ?');
        queryParams.push(senhaHash);
      }
      
      // Se nenhum campo foi fornecido para atualização
      if (updateFields.length === 0) {
        return res.status(400).json({
          error: 'Nenhum campo fornecido para atualização'
        });
      }

      // Adicionar id_user aos parâmetros
      queryParams.push(id_user);

      // Construir e executar a query
      const query = `
        UPDATE account 
        SET ${updateFields.join(', ')}
        WHERE id_user = ?
      `;

      const db = getDB();
      db.query(query, queryParams, (err, result) => {
        if (err) {
          console.error('Erro ao atualizar usuário:', err);
          
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

        if (result.affectedRows === 0) {
          return res.status(404).json({
            error: 'Usuário não encontrado'
          });
        }

        // Buscar dados atualizados do usuário
        const selectQuery = `
          SELECT id_user, username, email, birth_date, profile_photo 
          FROM account 
          WHERE id_user = ?
        `;

        db.query(selectQuery, [id_user], (err, results) => {
          if (err) {
            return res.status(500).json({
              error: 'Erro ao buscar dados atualizados'
            });
          }

          res.json({
            success: true,
            message: 'Perfil atualizado com sucesso!',
            user: results[0]
          });
        });
      });

    } catch (error) {
      console.error('Erro na atualização do perfil:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  });

  // =============================================
  // ROTAS DE FOLLOW/UNFOLLOW
  // =============================================

  // Seguir um usuário
  app.post('/api/users/:userId/follow', checkDB, async (req, res) => {
    try {
      const { userId: following_user_id } = req.params;
      const follower_user_id = req.body.follower_user_id;

      console.log('👥 [FOLLOW] follower_user_id:', follower_user_id, 'following_user_id:', following_user_id);

      if (!follower_user_id) {
        return res.status(400).json({
          error: 'follower_user_id é obrigatório'
        });
      }

      // Não permitir seguir a si mesmo
      if (parseInt(follower_user_id) === parseInt(following_user_id)) {
        return res.status(400).json({
          error: 'Você não pode seguir a si mesmo'
        });
      }

      // Verificar se os usuários existem
      const db = getDB();
      const checkUsers = `
        SELECT id_user FROM account WHERE id_user IN (?, ?)
      `;

      db.query(checkUsers, [follower_user_id, following_user_id], (err, users) => {
        if (err) {
          console.error('👥 [FOLLOW] Erro ao verificar usuários:', err);
          return res.status(500).json({
            error: 'Erro interno do servidor'
          });
        }

        if (users.length < 2) {
          return res.status(404).json({
            error: 'Um ou ambos os usuários não foram encontrados'
          });
        }

        // Verificar se já está seguindo
        const checkFollow = `
          SELECT id_follow FROM follow 
          WHERE follower_user_id = ? AND following_user_id = ?
        `;

        db.query(checkFollow, [follower_user_id, following_user_id], (err, follows) => {
          if (err) {
            console.error('👥 [FOLLOW] Erro ao verificar follow:', err);
            return res.status(500).json({
              error: 'Erro interno do servidor'
            });
          }

          if (follows.length > 0) {
            return res.status(400).json({
              error: 'Você já está seguindo este usuário'
            });
          }

          // Adicionar follow
          const insertFollow = `
            INSERT INTO follow (follower_user_id, following_user_id, created_at) 
            VALUES (?, ?, NOW())
          `;

          db.query(insertFollow, [follower_user_id, following_user_id], (err, result) => {
            if (err) {
              console.error('👥 [FOLLOW] Erro ao adicionar follow:', err);
              return res.status(500).json({
                error: 'Erro interno do servidor'
              });
            }

            console.log('👥 [FOLLOW] Follow adicionado:', result.insertId);

            // Buscar dados atualizados do usuário sendo seguido
            const getUser = `
              SELECT 
                a.id_user,
                a.username,
                a.profile_photo,
                COUNT(DISTINCT f1.id_follow) as followers_count,
                COUNT(DISTINCT f2.id_follow) as following_count
              FROM account a
              LEFT JOIN follow f1 ON a.id_user = f1.following_user_id
              LEFT JOIN follow f2 ON a.id_user = f2.follower_user_id
              WHERE a.id_user = ?
              GROUP BY a.id_user
            `;

            db.query(getUser, [following_user_id], (err, userResults) => {
              const userFollowed = userResults?.[0] || null;

              res.status(201).json({
                success: true,
                message: 'Seguindo usuário com sucesso!',
                followId: result.insertId,
                user: userFollowed
              });
            });
          });
        });
      });
    } catch (error) {
      console.error('👥 [FOLLOW] Erro ao processar follow:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  });

  // Deixar de seguir um usuário
  app.post('/api/users/:userId/unfollow', checkDB, async (req, res) => {
    try {
      const { userId: following_user_id } = req.params;
      const follower_user_id = req.body.follower_user_id;

      console.log('👥 [UNFOLLOW] follower_user_id:', follower_user_id, 'following_user_id:', following_user_id);

      if (!follower_user_id) {
        return res.status(400).json({
          error: 'follower_user_id é obrigatório'
        });
      }

      const db = getDB();

      // Verificar se o follow existe
      const checkFollow = `
        SELECT id_follow FROM follow 
        WHERE follower_user_id = ? AND following_user_id = ?
      `;

      db.query(checkFollow, [follower_user_id, following_user_id], (err, follows) => {
        if (err) {
          console.error('👥 [UNFOLLOW] Erro ao verificar follow:', err);
          return res.status(500).json({
            error: 'Erro interno do servidor'
          });
        }

        if (follows.length === 0) {
          return res.status(404).json({
            error: 'Você não está seguindo este usuário'
          });
        }

        // Remover follow
        const deleteFollow = `
          DELETE FROM follow 
          WHERE follower_user_id = ? AND following_user_id = ?
        `;

        db.query(deleteFollow, [follower_user_id, following_user_id], (err) => {
          if (err) {
            console.error('👥 [UNFOLLOW] Erro ao remover follow:', err);
            return res.status(500).json({
              error: 'Erro interno do servidor'
            });
          }

          console.log('👥 [UNFOLLOW] Follow removido');

          // Buscar dados atualizados do usuário
          const getUser = `
            SELECT 
              a.id_user,
              a.username,
              a.profile_photo,
              COUNT(DISTINCT f1.id_follow) as followers_count,
              COUNT(DISTINCT f2.id_follow) as following_count
            FROM account a
            LEFT JOIN follow f1 ON a.id_user = f1.following_user_id
            LEFT JOIN follow f2 ON a.id_user = f2.follower_user_id
            WHERE a.id_user = ?
            GROUP BY a.id_user
          `;

          db.query(getUser, [following_user_id], (err, userResults) => {
            const userUnfollowed = userResults?.[0] || null;

            res.json({
              success: true,
              message: 'Deixou de seguir o usuário com sucesso!',
              user: userUnfollowed
            });
          });
        });
      });
    } catch (error) {
      console.error('👥 [UNFOLLOW] Erro ao processar unfollow:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  });

  // Verificar se está seguindo um usuário
  app.get('/api/users/:userId/follow-status', checkDB, (req, res) => {
    try {
      const { userId: following_user_id } = req.params;
      const { follower_user_id } = req.query;

      console.log('👥 [FOLLOW_STATUS] follower_user_id:', follower_user_id, 'following_user_id:', following_user_id);

      if (!follower_user_id) {
        return res.status(400).json({
          error: 'follower_user_id é obrigatório'
        });
      }

      const db = getDB();
      const query = `
        SELECT id_follow FROM follow 
        WHERE follower_user_id = ? AND following_user_id = ?
      `;

      db.query(query, [follower_user_id, following_user_id], (err, results) => {
        if (err) {
          console.error('👥 [FOLLOW_STATUS] Erro ao verificar status:', err);
          return res.status(500).json({
            error: 'Erro interno do servidor'
          });
        }

        res.json({
          success: true,
          isFollowing: results.length > 0
        });
      });
    } catch (error) {
      console.error('👥 [FOLLOW_STATUS] Erro:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  });

  // Obter seguidores de um usuário
  app.get('/api/users/:userId/followers', checkDB, (req, res) => {
    try {
      const { userId } = req.params;

      console.log('👥 [FOLLOWERS] Buscando seguidores de:', userId);

      const db = getDB();
      const query = `
        SELECT 
          a.id_user,
          a.username,
          a.profile_photo,
          f.created_at
        FROM follow f
        LEFT JOIN account a ON f.follower_user_id = a.id_user
        WHERE f.following_user_id = ?
        ORDER BY f.created_at DESC
      `;

      db.query(query, [userId], (err, results) => {
        if (err) {
          console.error('👥 [FOLLOWERS] Erro ao buscar seguidores:', err);
          return res.status(500).json({
            error: 'Erro interno do servidor'
          });
        }

        console.log('👥 [FOLLOWERS] Seguidores encontrados:', results.length);

        res.json({
          success: true,
          followers: results,
          followers_count: results.length
        });
      });
    } catch (error) {
      console.error('👥 [FOLLOWERS] Erro:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  });

  // Obter quem o usuário está seguindo
  app.get('/api/users/:userId/following', checkDB, (req, res) => {
    try {
      const { userId } = req.params;

      console.log('👥 [FOLLOWING] Buscando seguindo de:', userId);

      const db = getDB();
      const query = `
        SELECT 
          a.id_user,
          a.username,
          a.profile_photo,
          f.created_at
        FROM follow f
        LEFT JOIN account a ON f.following_user_id = a.id_user
        WHERE f.follower_user_id = ?
        ORDER BY f.created_at DESC
      `;

      db.query(query, [userId], (err, results) => {
        if (err) {
          console.error('👥 [FOLLOWING] Erro ao buscar seguindo:', err);
          return res.status(500).json({
            error: 'Erro interno do servidor'
          });
        }

        console.log('👥 [FOLLOWING] Seguindo encontrados:', results.length);

        res.json({
          success: true,
          following: results,
          following_count: results.length
        });
      });
    } catch (error) {
      console.error('👥 [FOLLOWING] Erro:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  });

  // Obter perfil do usuário com contagem de seguidores/seguindo
  app.get('/api/users/:userId/profile-full', checkDB, (req, res) => {
    try {
      const { userId } = req.params;

      console.log('👥 [PROFILE_FULL] Buscando perfil completo de:', userId);

      const db = getDB();
      const query = `
        SELECT 
          a.id_user,
          a.full_name,
          a.username,
          a.email,
          a.birth_date,
          a.phone,
          a.profile_photo,
          a.cnpj,
          a.user_type,
          COUNT(DISTINCT f1.id_follow) as followers_count,
          COUNT(DISTINCT f2.id_follow) as following_count
        FROM account a
        LEFT JOIN follow f1 ON a.id_user = f1.following_user_id
        LEFT JOIN follow f2 ON a.id_user = f2.follower_user_id
        WHERE a.id_user = ?
        GROUP BY a.id_user
      `;

      db.query(query, [userId], (err, results) => {
        if (err) {
          console.error('👥 [PROFILE_FULL] Erro ao buscar perfil:', err);
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
      console.error('👥 [PROFILE_FULL] Erro:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  });
};
