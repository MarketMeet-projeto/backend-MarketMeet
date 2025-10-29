const bcrypt = require('bcryptjs');

module.exports = (app) => {
  const { getDB, checkDB } = require('../db');

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

      const db = getDB();
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

      console.log('Tentativa de login:', { email }); // Log para debug

      const query = 'SELECT * FROM account WHERE email = ?';
      const db = getDB();
      db.query(query, [email], async (err, results) => {
        if (err) {
          console.error('Erro na consulta:', err);
          return res.status(500).json({
            error: 'Erro interno do servidor'
          });
        }

        if (results.length === 0) {
          console.log('Usuário não encontrado:', email);
          return res.status(401).json({
            error: 'Email ou senha incorretos'
          });
        }

        const account = results[0];
        console.log('Conta encontrada:', {
          id: account.id_user,
          email: account.email,
          hasPassword: !!account.password
        }); // Log para debug
        
        // Verificar senha
        const senhaValida = await bcrypt.compare(password, account.password);
        console.log('Resultado da validação de senha:', senhaValida); // Log para debug
        
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

      const query = 'SELECT id, username, email, birth_date FROM account WHERE id = ?';
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

      const query = 'UPDATE account SET username = ? WHERE id = ?';
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
};
