const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

class AuthService {
  constructor(db) {
    this.db = db;
    this.JWT_SECRET = process.env.JWT_SECRET;
    
    if (!this.JWT_SECRET) {
      throw new Error('JWT_SECRET não definida em variáveis de ambiente. Configure no arquivo .env');
    }
  }

  async loginUser(email, password) {
    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios');
    }

    const user = await this.findUserByEmail(email);
    const isValid = await this.validatePassword(password, user.password);

    if (!isValid) {
      throw new Error('Email ou senha incorretos');
    }

    const token = jwt.sign(
      { id_user: user.id_user, username: user.username },
      this.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const result = {
      user: {
        id_user: user.id_user,
        username: user.username,
        email: user.email,
        birth_date: user.birth_date
      },
      token
    };

    console.log(`✅ Login bem-sucedido: ${user.email}`);
    return result;
  }

  findUserByEmail(email) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM account WHERE email = ?';
      this.db.query(query, [email], (err, results) => {
        if (err) return reject(err);
        if (!results || results.length === 0) return reject(new Error('Usuário não encontrado'));
        resolve(results[0]);
      });
    });
  }

  validatePassword(password, hash) {
    return new Promise((resolve) => {
      bcrypt.compare(password, hash, (err, isValid) => {
        resolve(isValid && !err);
      });
    });
  }
}

module.exports = AuthService;
