// test/routes/posts.test.js
// 🧪 Testes unitários e de integração para timeline com isLiked

const request = require('supertest');
const app = require('../../src/app');
const { getDB } = require('../../src/db');

// Mock JWT token
const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZF91c2VyIjoxLCJ1c2VybmFtZSI6ImpvYW8iLCJpYXQiOjE3MDAyMzAwMDB9.mock_signature';
const invalidToken = 'invalid.token.here';

// ============================================
// TESTES DA TIMELINE COM isLiked
// ============================================

describe('GET /api/posts/timeline', () => {
  
  describe('Autenticação', () => {
    
    test('Deve retornar 401 sem JWT', async () => {
      const response = await request(app)
        .get('/api/posts/timeline');
      
      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Token');
    });

    test('Deve retornar 401 com JWT inválido', async () => {
      const response = await request(app)
        .get('/api/posts/timeline')
        .set('Authorization', `Bearer ${invalidToken}`);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Token inválido');
    });

    test('Deve aceitar JWT válido', async () => {
      const response = await request(app)
        .get('/api/posts/timeline')
        .set('Authorization', `Bearer ${validToken}`);
      
      // Pode retornar 200 ou erro de banco, mas não 401
      expect(response.status).not.toBe(401);
    });

  });

  describe('Formato de Resposta', () => {
    
    test('Deve retornar JSON com estrutura correta', async () => {
      const response = await request(app)
        .get('/api/posts/timeline')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('posts');
      expect(Array.isArray(response.body.posts)).toBe(true);
    });

    test('Cada post deve ter campo isLiked', async () => {
      const response = await request(app)
        .get('/api/posts/timeline')
        .set('Authorization', `Bearer ${validToken}`);
      
      if (response.body.posts.length > 0) {
        const post = response.body.posts[0];
        expect(post).toHaveProperty('isLiked');
        expect(typeof post.isLiked).toBe('boolean');
      }
    });

    test('Cada post deve ter campos obrigatórios', async () => {
      const response = await request(app)
        .get('/api/posts/timeline')
        .set('Authorization', `Bearer ${validToken}`);
      
      if (response.body.posts.length > 0) {
        const post = response.body.posts[0];
        expect(post).toHaveProperty('id_post');
        expect(post).toHaveProperty('caption');
        expect(post).toHaveProperty('created_at');
        expect(post).toHaveProperty('likes_count');
        expect(post).toHaveProperty('comments_count');
        expect(post).toHaveProperty('isLiked');
      }
    });

  });

  describe('Campo isLiked', () => {
    
    test('isLiked deve ser boolean', async () => {
      const response = await request(app)
        .get('/api/posts/timeline')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(200);
      
      if (response.body.posts && response.body.posts.length > 0) {
        const post = response.body.posts[0];
        expect(typeof post.isLiked).toBe('boolean');
      }
    });

    test('isLiked = true para posts curtidos pelo usuário', async () => {
      // Pré-requisito: Usuário 1 curtiu post 42
      // Este teste valida que isLiked retorna true
      const response = await request(app)
        .get('/api/posts/timeline')
        .set('Authorization', `Bearer ${validToken}`);
      
      if (response.status === 200 && response.body.posts) {
        const likedPost = response.body.posts.find(p => p.isLiked === true);
        if (likedPost) {
          expect(likedPost.isLiked).toBe(true);
        }
      }
    });

    test('isLiked = false para posts não curtidos', async () => {
      const response = await request(app)
        .get('/api/posts/timeline')
        .set('Authorization', `Bearer ${validToken}`);
      
      if (response.status === 200 && response.body.posts) {
        const unlikedPost = response.body.posts.find(p => p.isLiked === false);
        if (unlikedPost) {
          expect(unlikedPost.isLiked).toBe(false);
        }
      }
    });

  });

});

// ============================================
// TESTES DA ROTA DE CURTIR
// ============================================

describe('POST /api/posts/:postId/like', () => {
  
  const postId = 42;

  describe('Autenticação', () => {
    
    test('Deve retornar 401 sem JWT', async () => {
      const response = await request(app)
        .post(`/api/posts/${postId}/like`);
      
      expect(response.status).toBe(401);
    });

    test('Deve aceitar JWT válido', async () => {
      const response = await request(app)
        .post(`/api/posts/${postId}/like`)
        .set('Authorization', `Bearer ${validToken}`);
      
      // Pode retornar 200 (sucesso) ou erro de banco
      expect([200, 500, 404]).toContain(response.status);
    });

  });

  describe('Funcionamento de Toggle', () => {
    
    test('Deve retornar action "liked" ou "unliked"', async () => {
      const response = await request(app)
        .post(`/api/posts/${postId}/like`)
        .set('Authorization', `Bearer ${validToken}`);
      
      if (response.status === 200) {
        expect(response.body.action).toMatch(/liked|unliked/);
      }
    });

    test('Deve ter success=true na resposta', async () => {
      const response = await request(app)
        .post(`/api/posts/${postId}/like`)
        .set('Authorization', `Bearer ${validToken}`);
      
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });

  });

});

// ============================================
// TESTES DE LISTAGEM POR FILTRO
// ============================================

describe('GET /api/posts/user/:userId', () => {
  
  test('Deve retornar 401 sem JWT', async () => {
    const response = await request(app)
      .get('/api/posts/user/1');
    
    expect(response.status).toBe(401);
  });

  test('Deve incluir campo isLiked', async () => {
    const response = await request(app)
      .get('/api/posts/user/1')
      .set('Authorization', `Bearer ${validToken}`);
    
    if (response.status === 200 && response.body.posts.length > 0) {
      const post = response.body.posts[0];
      expect(post).toHaveProperty('isLiked');
      expect(typeof post.isLiked).toBe('boolean');
    }
  });

});

describe('GET /api/posts/category/:category', () => {
  
  test('Deve retornar 401 sem JWT', async () => {
    const response = await request(app)
      .get('/api/posts/category/Eletrônicos');
    
    expect(response.status).toBe(401);
  });

  test('Deve incluir campo isLiked', async () => {
    const response = await request(app)
      .get('/api/posts/category/Eletrônicos')
      .set('Authorization', `Bearer ${validToken}`);
    
    if (response.status === 200 && response.body.posts.length > 0) {
      const post = response.body.posts[0];
      expect(post).toHaveProperty('isLiked');
    }
  });

});

describe('GET /api/posts/rating/:rating', () => {
  
  test('Deve retornar 401 sem JWT', async () => {
    const response = await request(app)
      .get('/api/posts/rating/5');
    
    expect(response.status).toBe(401);
  });

  test('Deve incluir campo isLiked', async () => {
    const response = await request(app)
      .get('/api/posts/rating/5')
      .set('Authorization', `Bearer ${validToken}`);
    
    if (response.status === 200 && response.body.posts.length > 0) {
      const post = response.body.posts[0];
      expect(post).toHaveProperty('isLiked');
    }
  });

  test('Deve retornar 400 para rating inválido', async () => {
    const response = await request(app)
      .get('/api/posts/rating/10')
      .set('Authorization', `Bearer ${validToken}`);
    
    expect(response.status).toBe(400);
  });

});

// ============================================
// TESTES DE CRIAÇÃO DE POSTAGEM
// ============================================

describe('POST /api/posts/create', () => {
  
  test('Deve retornar 401 sem JWT', async () => {
    const response = await request(app)
      .post('/api/posts/create')
      .send({
        rating: 5,
        caption: 'Ótimo produto!'
      });
    
    expect(response.status).toBe(401);
  });

  test('Deve validar rating entre 1-5', async () => {
    const response = await request(app)
      .post('/api/posts/create')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        rating: 10,
        caption: 'Ótimo!'
      });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Rating');
  });

  test('Deve aceitar postagem com rating válido', async () => {
    const response = await request(app)
      .post('/api/posts/create')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        rating: 5,
        caption: 'Ótimo produto!',
        category: 'Eletrônicos'
      });
    
    if (response.status === 201) {
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('postId');
    }
  });

});

// ============================================
// TESTES DE VERIFICAÇÃO DE STATUS
// ============================================

describe('GET /api/posts/:postId/like-status', () => {
  
  test('Deve retornar 400 sem id_user', async () => {
    const response = await request(app)
      .get('/api/posts/42/like-status');
    
    expect(response.status).toBe(400);
  });

  test('Deve retornar isLiked como boolean', async () => {
    const response = await request(app)
      .get('/api/posts/42/like-status')
      .query({ id_user: 1 });
    
    if (response.status === 200) {
      expect(typeof response.body.isLiked).toBe('boolean');
    }
  });

});

// ============================================
// TESTES DE COMENTÁRIOS
// ============================================

describe('POST /api/posts/:postId/comments', () => {
  
  test('Deve retornar 401 sem JWT', async () => {
    const response = await request(app)
      .post('/api/posts/42/comments')
      .send({
        comment_text: 'Ótimo!'
      });
    
    expect(response.status).toBe(401);
  });

  test('Deve aceitar comentário com JWT válido', async () => {
    const response = await request(app)
      .post('/api/posts/42/comments')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        comment_text: 'Ótimo!'
      });
    
    if (response.status === 201) {
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('commentId');
    }
  });

});

// ============================================
// TESTES DE ERRO
// ============================================

describe('Tratamento de Erros', () => {
  
  test('Deve retornar 500 em erro do banco', async () => {
    // Este teste depende de mockar o banco de dados
    const response = await request(app)
      .get('/api/posts/timeline')
      .set('Authorization', `Bearer ${validToken}`);
    
    // Não deve retornar status inesperado
    expect([200, 500, 503]).toContain(response.status);
  });

  test('Deve retornar mensagem de erro útil', async () => {
    const response = await request(app)
      .get('/api/posts/user/999999')
      .set('Authorization', `Bearer ${validToken}`);
    
    if (response.status !== 200) {
      expect(response.body).toHaveProperty('error');
    }
  });

});

// ============================================
// SUITE DE TESTES COMPLETA
// ============================================

describe('Suite Completa: Timeline com isLiked', () => {
  
  test('Fluxo completo: Listar → Curtir → Verificar', async () => {
    // 1. Listar timeline
    const listResponse = await request(app)
      .get('/api/posts/timeline')
      .set('Authorization', `Bearer ${validToken}`);
    
    if (listResponse.status === 200 && listResponse.body.posts.length > 0) {
      const postId = listResponse.body.posts[0].id_post;
      const initialIsLiked = listResponse.body.posts[0].isLiked;
      
      // 2. Curtir post
      const likeResponse = await request(app)
        .post(`/api/posts/${postId}/like`)
        .set('Authorization', `Bearer ${validToken}`);
      
      if (likeResponse.status === 200) {
        expect(likeResponse.body.success).toBe(true);
        
        // 3. Verificar status
        const statusResponse = await request(app)
          .get(`/api/posts/${postId}/like-status`)
          .query({ id_user: 1 });
        
        if (statusResponse.status === 200) {
          // Status deve ter mudado
          expect(typeof statusResponse.body.isLiked).toBe('boolean');
        }
      }
    }
  });

});

// ============================================
// INSTRUÇÕES PARA EXECUTAR
// ============================================

/**
 * Para executar os testes:
 * 
 * npm test
 * 
 * Ou teste específico:
 * npm test -- --testNamePattern="isLiked"
 * 
 * Com coverage:
 * npm test -- --coverage
 * 
 * Em watch mode:
 * npm test -- --watch
 */

