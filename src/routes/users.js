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
      const profilePhotoValue = profile_photo || null;
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
};
