// src/websocket/socketHandler.js
// 🔌 Gerenciador de WebSockets para atualização em tempo real da timeline

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET não definida em variáveis de ambiente. Configure no arquivo .env');
}

// Mapa de usuários conectados: { userId: { socketId, username, connectedAt } }
const connectedUsers = new Map();

// Mapa de salas: { categoryName: Set<socketIds> }
const categoryRooms = new Map();

/**
 * Inicializa o gerenciador de WebSockets
 * @param {Server} io - Instância do Socket.IO
 */
function setupSocketHandlers(io) {
  
  // Middleware para autenticação JWT no WebSocket
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Token não fornecido'));
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.id_user;
      socket.username = decoded.username;
      
      console.log(`✅ [WebSocket] Usuário autenticado: ${decoded.username} (ID: ${decoded.id_user})`);
      next();
    } catch (error) {
      console.error('❌ [WebSocket] Erro de autenticação:', error.message);
      next(new Error('Token inválido'));
    }
  });

  // ========================================
  // EVENTOS DE CONEXÃO
  // ========================================

  io.on('connection', (socket) => {
    console.log(`\n📱 [WebSocket] Nova conexão: ${socket.username} (Socket ID: ${socket.id})`);

    // Registrar usuário como conectado
    connectedUsers.set(socket.userId, {
      socketId: socket.id,
      username: socket.username,
      connectedAt: new Date()
    });

    // Notificar todos sobre novo usuário online
    io.emit('user:online', {
      userId: socket.userId,
      username: socket.username,
      totalOnline: connectedUsers.size,
      timestamp: new Date().toISOString()
    });

    console.log(`👥 Usuários online: ${connectedUsers.size}`);

    // ========================================
    // EVENTO: Entrar em sala de categoria
    // ========================================
    socket.on('category:join', (data) => {
      const { category } = data;
      
      try {
        const roomName = `category:${category}`;
        socket.join(roomName);
        
        if (!categoryRooms.has(category)) {
          categoryRooms.set(category, new Set());
        }
        categoryRooms.get(category).add(socket.id);

        console.log(`✅ [WebSocket] ${socket.username} entrou na categoria: ${category}`);
        
        // Notificar sala que novo usuário entrou
        io.to(roomName).emit('category:user-joined', {
          username: socket.username,
          category: category,
          usersInCategory: categoryRooms.get(category).size,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Erro ao entrar em categoria:', error);
        socket.emit('error', { message: 'Erro ao entrar na categoria' });
      }
    });

    // ========================================
    // EVENTO: Sair de sala de categoria
    // ========================================
    socket.on('category:leave', (data) => {
      const { category } = data;
      
      try {
        const roomName = `category:${category}`;
        socket.leave(roomName);
        
        if (categoryRooms.has(category)) {
          categoryRooms.get(category).delete(socket.id);
          
          if (categoryRooms.get(category).size === 0) {
            categoryRooms.delete(category);
          }
        }

        console.log(`✅ [WebSocket] ${socket.username} saiu da categoria: ${category}`);
      } catch (error) {
        console.error('Erro ao sair de categoria:', error);
      }
    });

    // ========================================
    // EVENTO: Nova postagem (emitido do backend)
    // ========================================
    socket.on('post:created', (postData) => {
      try {
        const { category, post } = postData;
        
        console.log(`📝 [WebSocket] Nova postagem criada: ${post.id_post} (Categoria: ${category})`);

        // Notificar em tempo real:
        // 1. Todos na categoria específica
        if (category) {
          io.to(`category:${category}`).emit('post:new', {
            post: post,
            category: category,
            timestamp: new Date().toISOString()
          });
        }

        // 2. Todos na timeline geral
        io.emit('timeline:update', {
          type: 'new-post',
          post: post,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Erro ao emitir nova postagem:', error);
      }
    });

    // ========================================
    // EVENTO: Curtida em postagem
    // ========================================
    socket.on('post:liked', (likeData) => {
      try {
        const { postId, action, likesCount } = likeData;
        
        console.log(`❤️  [WebSocket] Post ${postId} - Ação: ${action}`);

        // Notificar todos sobre curtida/descurtida em tempo real
        io.emit('post:like-update', {
          postId: postId,
          action: action, // 'liked' ou 'unliked'
          likesCount: likesCount,
          userId: socket.userId,
          username: socket.username,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Erro ao emitir curtida:', error);
      }
    });

    // ========================================
    // EVENTO: Comentário adicionado
    // ========================================
    socket.on('post:commented', (commentData) => {
      try {
        const { postId, commentId, comment, category } = commentData;
        
        console.log(`💬 [WebSocket] Novo comentário no post ${postId}`);

        // Notificar em tempo real
        io.emit('post:comment-added', {
          postId: postId,
          commentId: commentId,
          comment: comment,
          category: category,
          userId: socket.userId,
          username: socket.username,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Erro ao emitir comentário:', error);
      }
    });

    // ========================================
    // EVENTO: Digitação (typing indicator)
    // ========================================
    socket.on('post:typing', (data) => {
      const { postId } = data;
      
      try {
        // Notificar para o post específico
        io.emit('post:someone-typing', {
          postId: postId,
          username: socket.username,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Erro ao emitir digitação:', error);
      }
    });

    // ========================================
    // EVENTO: Parou de digitar
    // ========================================
    socket.on('post:stop-typing', (data) => {
      const { postId } = data;
      
      try {
        io.emit('post:stop-typing', {
          postId: postId,
          username: socket.username,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Erro ao emitir parada de digitação:', error);
      }
    });

    // ========================================
    // EVENTO: Notificação de erro
    // ========================================
    socket.on('error', (error) => {
      console.error('❌ [WebSocket] Erro:', error);
      logger.error('Erro do WebSocket:', error);
    });

    // ========================================
    // DESCONEXÃO
    // ========================================
    socket.on('disconnect', () => {
      try {
        const user = connectedUsers.get(socket.userId);
        
        if (user) {
          connectedUsers.delete(socket.userId);
          
          // Remover de todas as categorias
          categoryRooms.forEach((socketIds, category) => {
            socketIds.delete(socket.id);
          });

          console.log(`\n📴 [WebSocket] Usuário desconectado: ${socket.username}`);
          console.log(`👥 Usuários online: ${connectedUsers.size}`);

          // Notificar todos sobre desconexão
          io.emit('user:offline', {
            userId: socket.userId,
            username: socket.username,
            totalOnline: connectedUsers.size,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Erro ao desconectar:', error);
      }
    });
  });
}

/**
 * Emite nova postagem para todos os clientes
 * @param {Server} io - Instância do Socket.IO
 * @param {Object} post - Dados do post
 */
function broadcastNewPost(io, post) {
  io.emit('post:created', {
    post: post,
    timestamp: new Date().toISOString()
  });
}

/**
 * Emite atualização de curtida para todos
 * @param {Server} io - Instância do Socket.IO
 * @param {number} postId - ID do post
 * @param {string} action - 'liked' ou 'unliked'
 * @param {number} likesCount - Novo número de curtidas
 */
function broadcastLikeUpdate(io, postId, action, likesCount) {
  io.emit('post:like-updated', {
    postId: postId,
    action: action,
    likesCount: likesCount,
    timestamp: new Date().toISOString()
  });
}

/**
 * Emite novo comentário para todos
 * @param {Server} io - Instância do Socket.IO
 * @param {Object} comment - Dados do comentário
 */
function broadcastNewComment(io, comment) {
  io.emit('post:comment-created', {
    comment: comment,
    timestamp: new Date().toISOString()
  });
}

/**
 * Obtém informações de usuários online
 */
function getOnlineUsers() {
  return Array.from(connectedUsers.values()).map(user => ({
    ...user,
    userId: Array.from(connectedUsers.entries())
      .find(([_, v]) => v === user)?.[0]
  }));
}

module.exports = {
  setupSocketHandlers,
  broadcastNewPost,
  broadcastLikeUpdate,
  broadcastNewComment,
  getOnlineUsers,
  connectedUsers,
  categoryRooms
};
