const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AuthService = require('../services/auth.service');

module.exports = (app) => {
  const { getDB, checkDB } = require('../db');
  const db = getDB();
  const authService = new AuthService(db);

  // Helper para executar queries com Promises
  const query = (sql, params) => {
    return new Promise((resolve, reject) => {
      db.query(sql, params, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };

  // Criar usuário (requer banco)
app.post('/api/users/create', checkDB, async (req, res) => {
  try {
    console.log('🔵 [CREATE USER] - Requisição recebida');
    console.log('🔵 Body:', req.body);

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

    // ============================================
    // 1. VALIDAR CAMPOS OBRIGATÓRIOS
    // ============================================
    console.log('🟡 [VALIDATE] - Validando campos obrigatórios...');
    
    if (!username || username.trim() === '') {
      console.log('❌ Username vazio');
      return res.status(400).json({ error: 'Username é obrigatório' });
    }

    if (!email || email.trim() === '') {
      console.log('❌ Email vazio');
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    if (!password || password.trim() === '') {
      console.log('❌ Password vazio');
      return res.status(400).json({ error: 'Senha é obrigatória' });
    }

    if (!birth_date || birth_date.trim() === '') {
      console.log('❌ Birth_date vazio');
      return res.status(400).json({ error: 'Data de nascimento é obrigatória' });
    }

    console.log('✅ Campos obrigatórios OK');

    // ============================================
    // 2. VALIDAR FORMATO DA DATA
    // ============================================
    console.log('🟡 [DATE VALIDATE] - Validando formato de data...');
    
    const dataRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = birth_date.match(dataRegex);

    if (!match) {
      console.log('❌ Formato de data inválido:', birth_date);
      return res.status(400).json({
        error: 'Formato de data inválido. Use DD/MM/YYYY'
      });
    }

    const [, dia, mes, ano] = match;
    
    // Validar mês e dia
    const diaNum = parseInt(dia);
    const mesNum = parseInt(mes);
    
    if (mesNum < 1 || mesNum > 12) {
      console.log('❌ Mês inválido:', mesNum);
      return res.status(400).json({ error: 'Mês inválido. Use 01-12' });
    }

    if (diaNum < 1 || diaNum > 31) {
      console.log('❌ Dia inválido:', diaNum);
      return res.status(400).json({ error: 'Dia inválido. Use 01-31' });
    }

    const dataBanco = `${ano}-${mes}-${dia}`;
    const dataObj = new Date(dataBanco);

    if (isNaN(dataObj.getTime())) {
      console.log('❌ Data inválida após parse:', dataBanco);
      return res.status(400).json({ error: 'Data inválida' });
    }

    console.log('✅ Data validada:', dataBanco);

    // ============================================
    // 3. VALIDAR EMAIL
    // ============================================
    console.log('🟡 [EMAIL VALIDATE] - Validando email...');
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ Email inválido:', email);
      return res.status(400).json({ error: 'Email inválido' });
    }

    console.log('✅ Email validado');

    // ============================================
    // 4. VALIDAR USERNAME (mínimo 3 caracteres)
    // ============================================
    console.log('🟡 [USERNAME VALIDATE] - Validando username...');
    
    if (username.length < 3) {
      console.log('❌ Username muito curto:', username);
      return res.status(400).json({ error: 'Username deve ter pelo menos 3 caracteres' });
    }

    console.log('✅ Username validado');

    // ============================================
    // 5. VALIDAR PASSWORD
    // ============================================
    console.log('🟡 [PASSWORD VALIDATE] - Validando password...');
    
    if (password.length < 6) {
      console.log('❌ Password muito curta');
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
    }

    console.log('✅ Password validada');

    // ============================================
    // 6. PREPARAR VALORES COM DEFAULTS
    // ============================================
    console.log('🟡 [PREPARE DATA] - Preparando valores...');
    
    const userTypeValue = user_type || 'is_standard';
    const profilePhotoValue = profile_photo || null;
    const phoneValue = phone || null;
    const cnpjValue = cnpj || null;
    const fullNameValue = full_name || null;

    console.log('✅ Valores preparados:', {
      full_name: fullNameValue,
      username,
      birth_date: dataBanco,
      email,
      user_type: userTypeValue,
      phone: phoneValue,
      cnpj: cnpjValue
    });

    // ============================================
    // 7. CRIPTOGRAFAR SENHA
    // ============================================
    console.log('🟡 [HASH PASSWORD] - Criptografando senha...');
    
    let senhaHash;
    try {
      senhaHash = await bcrypt.hash(password, 10);
      console.log('✅ Senha criptografada');
    } catch (hashError) {
      console.error('❌ Erro ao criptografar senha:', hashError);
      return res.status(500).json({ error: 'Erro ao processar senha' });
    }

    // ============================================
    // 8. INSERIR NO BANCO
    // ============================================
    console.log('🟡 [DB INSERT] - Inserindo usuário no banco...');
    
    const insertQuery = `
      INSERT INTO account (
        full_name, username, birth_date, phone, email, password, profile_photo, cnpj, user_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const result = await query(insertQuery, [
        fullNameValue,
        username,
        dataBanco,
        phoneValue,
        email,
        senhaHash,
        profilePhotoValue,
        cnpjValue,
        userTypeValue
      ]);

      console.log('✅ Usuário inserido com sucesso! ID:', result.insertId);

      res.status(201).json({
        success: true,
        message: 'Usuário criado com sucesso!',
        userId: result.insertId
      });

    } catch (dbError) {
      console.error('❌ Erro ao inserir no banco:', dbError);
      console.error('Código de erro:', dbError.code);
      console.error('SQL:', dbError.sql);

      // Verificar se é erro de chave duplicada
      if (dbError.code === 'ER_DUP_ENTRY') {
        if (dbError.message.includes('email')) {
          return res.status(400).json({ error: 'Este email já está em uso' });
        } else if (dbError.message.includes('username')) {
          return res.status(400).json({ error: 'Este username já está em uso' });
        } else {
          return res.status(400).json({ error: 'Dados duplicados: ' + dbError.message });
        }
      }

      // Outros erros do banco
      return res.status(500).json({ 
        error: 'Erro ao criar usuário no banco de dados',
        details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }

  } catch (error) {
    console.error('❌ [FATAL ERROR] - Erro não capturado:', error);
    console.error('Stack:', error.stack);

    res.status(500).json({
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

  // Login de usuário
  app.post('/api/users/login', checkDB, async (req, res) => {
    const { email, password } = req.body;

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
  app.get('/api/users/:id', checkDB, async (req, res) => {
    try {
      const { id } = req.params;

      const selectQuery = 'SELECT id_user, full_name, username, email, birth_date, phone, profile_photo, cnpj, user_type FROM account WHERE id_user = ?';
      const results = await query(selectQuery, [id]);

      if (results.length === 0) {
        return res.status(404).json({
          error: 'Usuário não encontrado'
        });
      }

      res.json({
        success: true,
        user: results[0]
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

      const selectQuery = 'SELECT id_user, full_name, username, email, birth_date, phone, profile_photo, cnpj, user_type FROM account WHERE id_user = ?';
      const results = await query(selectQuery, [userId]);

      if (results.length === 0) {
        return res.status(404).json({
          error: 'Usuário não encontrado'
        });
      }

      res.status(200).json({
        success: true,
        user: results[0]
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

      const updateQuery = 'UPDATE account SET username = ? WHERE id_user = ?';
      const result = await query(updateQuery, [novoNome.trim(), userId]);

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
      const { id_user, username, birth_date, email, password } = req.body;

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
      const updateQuery = `
        UPDATE account 
        SET ${updateFields.join(', ')}
        WHERE id_user = ?
      `;

      const result = await query(updateQuery, queryParams);

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

      const results = await query(selectQuery, [id_user]);

      res.json({
        success: true,
        message: 'Perfil atualizado com sucesso!',
        user: results[0]
      });

    } catch (error) {
      console.error('Erro na atualização do perfil:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          error: 'Este email já está em uso'
        });
      }
      
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  });

  // Seguir usuário
  app.post('/api/users/:userId/follow', checkDB, async (req, res) => {
    try {
      const { userId } = req.params;
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Token de autenticação não fornecido'
        });
      }

      const token = authHeader.slice(7);
      const jwtSecret = process.env.JWT_SECRET;

      if (!jwtSecret) {
        console.error('JWT_SECRET não configurado');
        return res.status(500).json({
          error: 'Erro na configuração do servidor'
        });
      }

      let currentUserId;
      try {
        const decoded = jwt.verify(token, jwtSecret);
        currentUserId = decoded.userId;
      } catch (err) {
        return res.status(401).json({
          error: 'Token inválido ou expirado'
        });
      }

      if (String(currentUserId) === String(userId)) {
        return res.status(400).json({
          error: 'Você não pode seguir a si mesmo'
        });
      }

      // Verificar se o usuário sendo seguido existe
      const userCheckQuery = 'SELECT id_user FROM account WHERE id_user = ?';
      const userExists = await query(userCheckQuery, [userId]);
      
      if (userExists.length === 0) {
        return res.status(404).json({
          error: 'Usuário não encontrado'
        });
      }

      // Verificar se já está seguindo
      const checkFollowQuery = 'SELECT id_follow FROM follows WHERE follower_id = ? AND following_id = ?';
      const alreadyFollowing = await query(checkFollowQuery, [currentUserId, userId]);

      if (alreadyFollowing.length > 0) {
        return res.status(400).json({
          error: 'Você já está seguindo este usuário'
        });
      }

      // Adicionar follow
      const insertFollowQuery = 'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)';
      await query(insertFollowQuery, [currentUserId, userId]);

      res.status(201).json({
        success: true,
        message: 'Você começou a seguir este usuário'
      });

    } catch (error) {
      console.error('Erro ao seguir usuário:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  });

  // Deixar de seguir usuário
  app.post('/api/users/:userId/unfollow', checkDB, async (req, res) => {
    try {
      const { userId } = req.params;
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Token de autenticação não fornecido'
        });
      }

      const token = authHeader.slice(7);
      const jwtSecret = process.env.JWT_SECRET;

      if (!jwtSecret) {
        console.error('JWT_SECRET não configurado');
        return res.status(500).json({
          error: 'Erro na configuração do servidor'
        });
      }

      let currentUserId;
      try {
        const decoded = jwt.verify(token, jwtSecret);
        currentUserId = decoded.userId;
      } catch (err) {
        return res.status(401).json({
          error: 'Token inválido ou expirado'
        });
      }

      if (String(currentUserId) === String(userId)) {
        return res.status(400).json({
          error: 'Você não pode deixar de seguir a si mesmo'
        });
      }

      // Verificar se o usuário sendo deixado de seguir existe
      const userCheckQuery = 'SELECT id_user FROM account WHERE id_user = ?';
      const userExists = await query(userCheckQuery, [userId]);
      
      if (userExists.length === 0) {
        return res.status(404).json({
          error: 'Usuário não encontrado'
        });
      }

      // Deletar follow
      const deleteFollowQuery = 'DELETE FROM follows WHERE follower_id = ? AND following_id = ?';
      const result = await query(deleteFollowQuery, [currentUserId, userId]);

      if (result.affectedRows === 0) {
        return res.status(400).json({
          error: 'Você não está seguindo este usuário'
        });
      }

      res.json({
        success: true,
        message: 'Você deixou de seguir este usuário'
      });

    } catch (error) {
      console.error('Erro ao deixar de seguir usuário:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  });
};
