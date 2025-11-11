const { of, throwError } = require('rxjs');
const { mergeMap, tap, map, catchError } = require('rxjs/operators');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

class AuthService {
  constructor(db) {
    this.db = db;
    this.JWT_SECRET = process.env.JWT_SECRET || 'SEU_SEGREDO_AQUI';
  }

  // Login com RxJS
  loginUser(email, password) {
    return of({ email, password })
      .pipe(
        // 1️⃣ Validar formato de email e senha
        tap(cred => {
          if (!cred.email || !cred.password) {
            throw new Error('Email e senha são obrigatórios');
          }
        }),
        
        // 2️⃣ Buscar usuário no banco
        mergeMap(cred =>
          this.findUserByEmail(cred.email).pipe(
            catchError(() => throwError(() => new Error('Email ou senha incorretos')))
          )
        ),
        
        // 3️⃣ Validar senha
        mergeMap(user =>
          this.validatePassword(password, user.password).pipe(
            map(isValid => {
              if (!isValid) {
                throw new Error('Email ou senha incorretos');
              }
              return user;
            })
          )
        ),
        
        // 4️⃣ Gerar JWT
        map(user => ({
          user: {
            id_user: user.id_user,
            username: user.username,
            email: user.email,
            birth_date: user.birth_date
          },
          token: jwt.sign(
            { id_user: user.id_user, username: user.username },
            this.JWT_SECRET,
            { expiresIn: '7d' }
          )
        })),
        
        // 5️⃣ Log de sucesso
        tap(result => {
          console.log(`✅ Login bem-sucedido: ${result.user.email}`);
        }),
        
        // Tratamento de erro
        catchError(err => {
          console.error(`❌ Erro no login: ${err.message}`);
          return throwError(() => err);
        })
      );
  }

  // Buscar usuário por email (Promisse em RxJS)
  findUserByEmail(email) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM account WHERE email = ?';
      this.db.query(query, [email], (err, results) => {
        if (err) {
          reject(err);
        } else if (results.length === 0) {
          reject(new Error('Usuário não encontrado'));
        } else {
          resolve(results[0]);
        }
      });
    }).then(user => of(user))
      .catch(err => throwError(() => err));
  }

  // Validar senha
  validatePassword(password, hash) {
    return new Promise((resolve) => {
      bcrypt.compare(password, hash, (err, isValid) => {
        resolve(isValid && !err);
      });
    }).then(isValid => of(isValid));
  }
}

module.exports = AuthService;
