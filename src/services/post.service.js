class PostService {
  constructor(db) {
    this.db = db;
  }

  async createPost(userId, postData) {
    if (!userId) {
      throw new Error('ID do usuário é obrigatório');
    }

    if (postData.rating !== undefined && (postData.rating < 1 || postData.rating > 5)) {
      throw new Error('Rating deve estar entre 1 e 5');
    }

    const user = await this.findUserById(userId);
    const data = { ...postData, id_user: user.id_user };
    const newPost = await this.savePost(data);
    console.log(`✅ Post criado: ${newPost.id_post}`);
    return newPost;
  }

  async getPostsTimeline() {
    const posts = await this.getPostsFromDB();
    if (!posts || posts.length === 0) return [];

    const enriched = await Promise.all(
      posts.map(async (post) => {
        try {
          const user = await this.findUserById(post.id_user);
          return {
            ...post,
            author: {
              id_user: user.id_user,
              username: user.username
            }
          };
        } catch (e) {
          return post;
        }
      })
    );

    enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    console.log(`✅ ${enriched.length} posts carregados`);
    return enriched;
  }

  async toggleLike(postId, userId) {
    const post = await this.findPostById(postId);
    const liked = await this.checkIfLiked(postId, userId);

    const result = liked
      ? await this.removeLike(postId, userId)
      : await this.addLike(postId, userId);

    console.log(`✅ Like atualizado`);
    return result;
  }

  async addComment(postId, userId, commentText) {
    if (!userId) {
      throw new Error('ID do usuário é obrigatório');
    }

    await this.findPostById(postId);
    const comment = await this.saveComment({ postId, userId, comment_text: commentText || '' });
    console.log(`✅ Comentário adicionado: ${comment.id_comment}`);
    return comment;
  }

  // ========== MÉTODOS AUXILIARES ==========

  findUserById(userId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT id_user, username, email FROM account WHERE id_user = ?';
      this.db.query(query, [userId], (err, results) => {
        if (err || !results || results.length === 0) {
          return reject(new Error('Usuário não encontrado'));
        }
        resolve(results[0]);
      });
    });
  }

  findPostById(postId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM post WHERE id_post = ?';
      this.db.query(query, [postId], (err, results) => {
        if (err || !results || results.length === 0) {
          return reject(new Error('Post não encontrado'));
        }
        resolve(results[0]);
      });
    });
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
        if (err) return reject(err);
        resolve(results || []);
      });
    });
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
        if (err) return reject(err);
        resolve({ id_post: result.insertId, ...postData });
      });
    });
  }

  checkIfLiked(postId, userId) {
    return new Promise((resolve) => {
      const query = 'SELECT id_like FROM likes WHERE id_post = ? AND id_user = ?';
      this.db.query(query, [postId, userId], (err, results) => {
        resolve(results && results.length > 0);
      });
    });
  }

  addLike(postId, userId) {
    return new Promise((resolve, reject) => {
      const query = 'INSERT INTO likes (id_post, id_user, created_at) VALUES (?, ?, NOW())';
      this.db.query(query, [postId, userId], (err) => {
        if (err) return reject(err);
        resolve({ success: true, action: 'liked' });
      });
    });
  }

  removeLike(postId, userId) {
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM likes WHERE id_post = ? AND id_user = ?';
      this.db.query(query, [postId, userId], (err) => {
        if (err) return reject(err);
        resolve({ success: true, action: 'unliked' });
      });
    });
  }

  saveComment(data) {
    return new Promise((resolve, reject) => {
      const query = 'INSERT INTO comments (id_post, id_user, comment_text, created_at) VALUES (?, ?, ?, NOW())';
      this.db.query(query, [data.postId, data.userId, data.comment_text], (err, result) => {
        if (err) return reject(err);
        resolve({ id_comment: result.insertId, ...data });
      });
    });
  }
}

module.exports = PostService;
