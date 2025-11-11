const { of, combineLatest, throwError } = require('rxjs');
const { mergeMap, map, tap, filter, catchError } = require('rxjs/operators');

class PostService {
  constructor(db) {
    this.db = db;
  }

  // Criar post com validação via RxJS
  createPost(userId, postData) {
    return of(postData)
      .pipe(
        // 1️⃣ Validar que userId existe
        tap(data => {
          if (!userId) {
            throw new Error('ID do usuário é obrigatório');
          }
        }),

        // 2️⃣ Validar rating se fornecido (1-5)
        tap(data => {
          if (data.rating !== undefined && (data.rating < 1 || data.rating > 5)) {
            throw new Error('Rating deve estar entre 1 e 5');
          }
        }),

        // 3️⃣ Verificar se usuário existe
        mergeMap(data =>
          this.findUserById(userId).pipe(
            map(user => ({ ...data, id_user: user.id_user })),
            catchError(() => throwError(() => new Error('Usuário não encontrado')))
          )
        ),

        // 4️⃣ Salvar no banco
        mergeMap(data => this.savePost(data)),

        // 5️⃣ Log de sucesso
        tap(newPost => {
          console.log(`✅ Post criado: ${newPost.id_post}`);
        }),

        // Tratamento de erro
        catchError(err => {
          console.error(`❌ Erro ao criar post: ${err.message}`);
          return throwError(() => err);
        })
      );
  }

  // Buscar timeline com RxJS
  getPostsTimeline() {
    return this.getPostsFromDB()
      .pipe(
        // 1️⃣ Enriquecer com dados do usuário
        mergeMap(posts =>
          posts.length === 0
            ? of([])
            : combineLatest(
                posts.map(post =>
                  this.findUserById(post.id_user).pipe(
                    map(user => ({
                      ...post,
                      author: {
                        id_user: user.id_user,
                        username: user.username
                      }
                    })),
                    catchError(() => of(post))
                  )
                )
              )
        ),

        // 2️⃣ Ordenar por mais recentes
        map(posts => posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))),

        // 3️⃣ Log
        tap(posts => console.log(`✅ ${posts.length} posts carregados`)),

        // Tratamento de erro
        catchError(err => {
          console.error(`❌ Erro ao carregar timeline: ${err.message}`);
          return of([]);
        })
      );
  }

  // Toggle like (curtir/descurtir)
  toggleLike(postId, userId) {
    return of(postId)
      .pipe(
        // 1️⃣ Encontrar post
        mergeMap(id =>
          this.findPostById(id).pipe(
            catchError(() => throwError(() => new Error('Post não encontrado')))
          )
        ),

        // 2️⃣ Verificar se já foi liked
        mergeMap(post =>
          this.checkIfLiked(postId, userId).pipe(
            map(liked => ({ post, liked }))
          )
        ),

        // 3️⃣ Adicionar ou remover like
        mergeMap(({ post, liked }) =>
          liked
            ? this.removeLike(postId, userId)
            : this.addLike(postId, userId)
        ),

        // 4️⃣ Log
        tap(result => console.log(`✅ Like atualizado`)),

        // Tratamento de erro
        catchError(err => {
          console.error(`❌ Erro ao atualizar like: ${err.message}`);
          return throwError(() => err);
        })
      );
  }

  // Adicionar comentário
  addComment(postId, userId, commentText) {
    return of({ postId, userId, comment_text: commentText || '' })
      .pipe(
        // 1️⃣ Validar userId
        tap(data => {
          if (!userId) {
            throw new Error('ID do usuário é obrigatório');
          }
        }),

        // 2️⃣ Validar que post existe
        mergeMap(data =>
          this.findPostById(postId).pipe(
            map(() => data),
            catchError(() => throwError(() => new Error('Post não encontrado')))
          )
        ),

        // 3️⃣ Salvar comentário
        mergeMap(data => this.saveComment(data)),

        // 4️⃣ Log
        tap(comment => console.log(`✅ Comentário adicionado: ${comment.id_comment}`)),

        // Tratamento de erro
        catchError(err => {
          console.error(`❌ Erro ao adicionar comentário: ${err.message}`);
          return throwError(() => err);
        })
      );
  }

  // ========== MÉTODOS AUXILIARES ==========

  findUserById(userId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT id_user, username, email FROM account WHERE id_user = ?';
      this.db.query(query, [userId], (err, results) => {
        if (err || results.length === 0) {
          reject(new Error('Usuário não encontrado'));
        } else {
          resolve(results[0]);
        }
      });
    }).then(user => of(user));
  }

  findPostById(postId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM post WHERE id_post = ?';
      this.db.query(query, [postId], (err, results) => {
        if (err || results.length === 0) {
          reject(new Error('Post não encontrado'));
        } else {
          resolve(results[0]);
        }
      });
    }).then(post => of(post));
  }

  getPostsFromDB() {
    return new Promise((resolve, reject) => {
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
      `;
      this.db.query(query, (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results || []);
        }
      });
    }).then(posts => of(posts));
  }

  savePost(postData) {
    return new Promise((resolve, reject) => {
      let fields = ['id_user', 'created_at'];
      let placeholders = ['?', 'NOW()'];
      let values = [postData.id_user];

      if (postData.rating !== undefined) {
        fields.push('rating');
        placeholders.push('?');
        values.push(postData.rating);
      }
      if (postData.caption !== undefined) {
        fields.push('caption');
        placeholders.push('?');
        values.push(postData.caption);
      }
      if (postData.category !== undefined) {
        fields.push('category');
        placeholders.push('?');
        values.push(postData.category);
      }
      if (postData.product_photo !== undefined) {
        fields.push('product_photo');
        placeholders.push('?');
        values.push(postData.product_photo);
      }
      if (postData.product_url !== undefined) {
        fields.push('product_url');
        placeholders.push('?');
        values.push(postData.product_url);
      }

      const query = `INSERT INTO post (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`;
      
      this.db.query(query, values, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve({ id_post: result.insertId, ...postData });
        }
      });
    }).then(post => of(post));
  }

  checkIfLiked(postId, userId) {
    return new Promise((resolve) => {
      const query = 'SELECT id_like FROM likes WHERE id_post = ? AND id_user = ?';
      this.db.query(query, [postId, userId], (err, results) => {
        resolve(results && results.length > 0);
      });
    }).then(liked => of(liked));
  }

  addLike(postId, userId) {
    return new Promise((resolve, reject) => {
      const query = 'INSERT INTO likes (id_post, id_user, created_at) VALUES (?, ?, NOW())';
      this.db.query(query, [postId, userId], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve({ success: true, action: 'liked' });
        }
      });
    }).then(result => of(result));
  }

  removeLike(postId, userId) {
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM likes WHERE id_post = ? AND id_user = ?';
      this.db.query(query, [postId, userId], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve({ success: true, action: 'unliked' });
        }
      });
    }).then(result => of(result));
  }

  saveComment(data) {
    return new Promise((resolve, reject) => {
      const query = 'INSERT INTO comments (id_post, id_user, comment_text, created_at) VALUES (?, ?, ?, NOW())';
      this.db.query(query, [data.postId, data.userId, data.comment_text], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve({ id_comment: result.insertId, ...data });
        }
      });
    }).then(comment => of(comment));
  }
}

module.exports = PostService;
