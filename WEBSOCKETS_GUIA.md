# 🔌 WEBSOCKETS - ATUALIZAÇÃO EM TEMPO REAL DA TIMELINE

## 📋 O QUE FOI IMPLEMENTADO

Adicionado suporte completo a WebSockets para atualizar a timeline em tempo real com:
- ✅ Novas postagens (broadcast)
- ✅ Curtidas/Descurtidas (ao vivo)
- ✅ Comentários (instantâneo)
- ✅ Indicador de digitação (typing)
- ✅ Status de usuários online
- ✅ Salas por categoria

---

## 🚀 INSTALAÇÃO

### 1. Instalar dependência

```bash
npm install socket.io
```

### 2. Reiniciar servidor

```bash
npm run dev
```

Você deve ver:

```
==================================================
🚀 Servidor rodando na porta 3000
📡 WebSocket ativo
==================================================
```

---

## 📡 EVENTOS WEBSOCKET

### Servidor → Cliente (Broadcast)

#### 1. **Nova Postagem**
```javascript
// Evento: post:created
io.emit('post:created', {
  post: {
    id_post: 42,
    caption: "Ótimo produto!",
    rating: 5,
    category: "Eletrônicos",
    likes_count: 0,
    comments_count: 0,
    isLiked: false,
    username: "joao",
    created_at: "2025-11-24T10:30:00Z"
  },
  category: "Eletrônicos",
  timestamp: "2025-11-24T10:30:00Z"
});

// Também emitido para categoria específica:
// Evento: post:new
// io.to('category:Eletrônicos').emit('post:new', {...})
```

#### 2. **Curtida/Descurtida**
```javascript
// Evento: post:like-update
io.emit('post:like-update', {
  postId: 42,
  action: "liked",  // "liked" ou "unliked"
  userId: 1,
  username: "joao",
  timestamp: "2025-11-24T10:30:00Z"
});
```

#### 3. **Novo Comentário**
```javascript
// Evento: post:comment-added
io.emit('post:comment-added', {
  postId: 42,
  commentId: 15,
  comment: {
    id_comment: 15,
    id_post: 42,
    id_user: 1,
    comment_text: "Realmente bom!",
    username: "joao",
    created_at: "2025-11-24T10:30:00Z"
  },
  timestamp: "2025-11-24T10:30:00Z"
});
```

#### 4. **Status de Usuários**
```javascript
// Evento: user:online
io.emit('user:online', {
  userId: 1,
  username: "joao",
  totalOnline: 5,
  timestamp: "2025-11-24T10:30:00Z"
});

// Evento: user:offline
io.emit('user:offline', {
  userId: 1,
  username: "joao",
  totalOnline: 4,
  timestamp: "2025-11-24T10:30:00Z"
});
```

#### 5. **Digitação (Typing Indicator)**
```javascript
// Evento: post:someone-typing
io.emit('post:someone-typing', {
  postId: 42,
  username: "joao",
  timestamp: "2025-11-24T10:30:00Z"
});

// Evento: post:stop-typing
io.emit('post:stop-typing', {
  postId: 42,
  username: "joao",
  timestamp: "2025-11-24T10:30:00Z"
});
```

#### 6. **Entrada/Saída de Categoria**
```javascript
// Evento: category:user-joined
io.to('category:Eletrônicos').emit('category:user-joined', {
  username: "joao",
  category: "Eletrônicos",
  usersInCategory: 5,
  timestamp: "2025-11-24T10:30:00Z"
});
```

---

## 💻 FRONTEND - COMO USAR

### 1. Conexão com Servidor

```javascript
import io from 'socket.io-client';

// Conectar com autenticação JWT
const socket = io('http://localhost:3000', {
  auth: {
    token: localStorage.getItem('token')  // JWT do login
  }
});

// Ouvir conexão
socket.on('connect', () => {
  console.log('✅ Conectado ao servidor WebSocket');
});

socket.on('disconnect', () => {
  console.log('❌ Desconectado do servidor');
});
```

### 2. Ouvir Novas Postagens

```javascript
socket.on('post:created', (data) => {
  console.log('📝 Nova postagem:', data.post);
  
  // Adicionar à timeline
  addPostToTimeline(data.post);
  
  // Animar entrada
  animateNewPost(data.post.id_post);
});

// Ou para categoria específica
socket.on('post:new', (data) => {
  console.log('📝 Novo post em', data.category);
  addPostToTimeline(data.post);
});
```

### 3. Ouvir Atualizações de Curtidas

```javascript
socket.on('post:like-update', (data) => {
  console.log(`❤️  Post ${data.postId} - ${data.action}`);
  
  // Atualizar contagem e visual
  updateLikeButton(data.postId, data.action);
  updateLikeCount(data.postId);
  
  // Mostrar quem curtiu
  showNotification(`${data.username} ${data.action === 'liked' ? 'curtiu' : 'descurtiu'}`);
});
```

### 4. Ouvir Novos Comentários

```javascript
socket.on('post:comment-added', (data) => {
  console.log('💬 Novo comentário:', data.comment);
  
  // Adicionar comentário em tempo real
  addCommentToPost(data.postId, data.comment);
  
  // Incrementar contador
  incrementCommentCount(data.postId);
});
```

### 5. Indicador de Digitação

```javascript
// Ao começar a digitar
function onCommentInputFocus(postId) {
  socket.emit('post:typing', { postId });
}

// Ao parar de digitar
function onCommentInputBlur(postId) {
  socket.emit('post:stop-typing', { postId });
}

// Ouvir quem está digitando
socket.on('post:someone-typing', (data) => {
  console.log(`✏️  ${data.username} está digitando em ${data.postId}`);
  
  // Mostrar indicador visual
  showTypingIndicator(data.postId, data.username);
});

socket.on('post:stop-typing', (data) => {
  console.log(`${data.username} parou de digitar`);
  hideTypingIndicator(data.postId, data.username);
});
```

### 6. Entrar em Salas de Categoria

```javascript
// Ao abrir uma categoria
function openCategory(categoryName) {
  socket.emit('category:join', { category: categoryName });
  
  // Ouvir postagens dessa categoria
  socket.on('post:new', (data) => {
    if (data.category === categoryName) {
      addPostToTimeline(data.post);
    }
  });
}

// Ao sair da categoria
function closeCategory(categoryName) {
  socket.emit('category:leave', { category: categoryName });
}

// Ouvir quando alguém entra
socket.on('category:user-joined', (data) => {
  console.log(`${data.username} entrou em ${data.category}`);
  console.log(`Usuários nessa categoria: ${data.usersInCategory}`);
});
```

### 7. Status de Usuários Online

```javascript
socket.on('user:online', (data) => {
  console.log(`✅ ${data.username} está online`);
  console.log(`Total online: ${data.totalOnline}`);
  
  // Atualizar lista de online
  updateOnlineUsers(data.totalOnline);
  showNotification(`${data.username} entrou`);
});

socket.on('user:offline', (data) => {
  console.log(`❌ ${data.username} saiu`);
  console.log(`Total online: ${data.totalOnline}`);
  
  updateOnlineUsers(data.totalOnline);
  showNotification(`${data.username} saiu`);
});
```

---

## 🔄 FLUXO COMPLETO - NOVA POSTAGEM

```
Frontend                        Backend                  WebSocket
   ↓                              ↓
[Usuário cria post]              
   ↓
POST /api/posts/create (JWT)
   ↓                        Valida JWT ✓
   ↓                        Insere em BD ✓
   ↓                        Emite: post:created
   ←←←←←←←←←←←←←←←←←←←←←←←←← [broadcast para todos]
Recebe: post:created
   ↓
Renderiza nova postagem
   ↓
Anima entrada suave
   ↓
Mostra "novo post!"
```

---

## 🔄 FLUXO COMPLETO - CURTIDA

```
Frontend                        Backend                  WebSocket
   ↓                              ↓
[Usuário clica ♥]                
   ↓
POST /api/posts/:id/like (JWT)
   ↓                        Valida JWT ✓
   ↓                        Toggle like ✓
   ↓                        Emite: post:like-update
   ←←←←←←←←←←←←←←←←←←←←←←←←← [broadcast para todos]
Recebe: post:like-update
   ↓
Atualiza botão local (♥ vermelho)
   ↓
Incrementa contador de likes
   ↓
Mostra notificação "você curtiu"
```

---

## 🧪 TESTE COM POSTMAN

### 1. Conectar ao WebSocket (Socket.IO Client)

```
URL: http://localhost:3000/socket.io/
Headers: {
  "Authorization": "Bearer {seu_jwt_token}"
}
```

### 2. Emitir Evento Manualmente

**Evento: `post:typing`**
```json
{
  "postId": 42
}
```

**Evento: `category:join`**
```json
{
  "category": "Eletrônicos"
}
```

---

## 📊 ESTRUTURA DE DADOS

### Conectado User
```javascript
{
  userId: 1,
  socketId: "abc123...",
  username: "joao",
  connectedAt: Date
}
```

### Category Room
```javascript
{
  "category:Eletrônicos": Set<socketId>,
  "category:Moda": Set<socketId>,
  ...
}
```

---

## 🔐 SEGURANÇA

✅ **Autenticação JWT obrigatória**
- Token validado na conexão
- Desconexão automática se inválido

✅ **Isolamento de dados**
- Usuários só veem dados públicos
- Salas de categoria limitam escopo

✅ **Rate limiting**
- Herdado do Express (6 req/15min)
- Pode ser aplicado também ao WebSocket

---

## 📈 ARQUITETURA

```
┌─────────────────────────────────────┐
│        Cliente (Frontend)            │
│  Socket.IO Client (JavaScript)       │
└──────────────┬──────────────────────┘
               │
        ╔══════╩══════╗
        │ socket:io   │
        ╚══════╤══════╝
               │
┌──────────────▼──────────────────────┐
│     Backend (Node.js)                │
│  ├─ server.js                        │
│  ├─ src/websocket/socketHandler.js  │
│  ├─ src/routes/posts.js             │
│  └─ Socket.IO Server                │
└──────────────┬──────────────────────┘
               │
        ╔══════╩══════╗
        │  MySQL DB   │
        ╚═════════════╝
```

---

## 🎯 CASOS DE USO

### 1. **Feed em Tempo Real**
- Post criado → Aparece instantaneamente para todos
- Sem refresh necessário

### 2. **Interação ao Vivo**
- Curtida adicionada → Contador atualiza para todos
- Vários usuários veem updates simultâneos

### 3. **Colaboração em Comentários**
- Novo comentário → Todos veem ao mesmo tempo
- Typing indicator mostra quem está respondendo

### 4. **Status de Online**
- User conecta → Aparece na lista de online
- User sai → Desaparece da lista

### 5. **Categorias Específicas**
- Usuário entra em categoria
- Recebe posts dessa categoria em tempo real
- Pode filtrar por interesse

---

## 📝 EXEMPLO COMPLETO - FRONTEND REACT

```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

function Timeline() {
  const [posts, setPosts] = useState([]);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(0);

  useEffect(() => {
    // Conectar WebSocket
    const newSocket = io('http://localhost:3000', {
      auth: {
        token: localStorage.getItem('token')
      }
    });

    // Ouvir nova postagem
    newSocket.on('post:created', (data) => {
      setPosts(prev => [data.post, ...prev]);
    });

    // Ouvir curtida
    newSocket.on('post:like-update', (data) => {
      setPosts(prev => prev.map(post => 
        post.id_post === data.postId 
          ? { ...post, isLiked: data.action === 'liked' }
          : post
      ));
    });

    // Ouvir status online
    newSocket.on('user:online', (data) => {
      setOnlineUsers(data.totalOnline);
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  return (
    <div>
      <h1>Timeline 📝</h1>
      <p>Online: {onlineUsers} 👥</p>
      {posts.map(post => (
        <PostCard key={post.id_post} post={post} socket={socket} />
      ))}
    </div>
  );
}

export default Timeline;
```

---

## ✅ CHECKLIST

- [x] Socket.IO instalado
- [x] Server integrado com WebSocket
- [x] Autenticação JWT no WebSocket
- [x] Broadcast de novas postagens
- [x] Broadcast de curtidas
- [x] Broadcast de comentários
- [x] Typing indicator
- [x] Salas por categoria
- [x] Status de usuários online
- [x] Documentação completa

---

## 🚀 PRÓXIMAS MELHORIAS

1. **Notificações Push**
   - Alertar quando mencionado
   - Quando post recebe curtida

2. **Presença em Tempo Real**
   - Mostrar quem está vendo post
   - Avatares de usuários online

3. **Edição/Deleção ao Vivo**
   - Post deletado → Desaparece para todos
   - Post editado → Atualiza para todos

4. **Reações (Emoji)**
   - Além de curtida, usar emojis
   - Broadcast de reações

5. **Mensagens Diretas**
   - Chat privado via WebSocket
   - Typing indicator para DM

---

**Data:** 24 de Novembro de 2025  
**Status:** ✅ Implementado e Pronto  
**Versão:** 1.1.0 (com WebSocket)

