# 🔐 Correção de Bug de Segurança - JWT Authentication

## 🐛 Bug Encontrado
POST `/api/posts/create` estava rejeitando com 401 porque:
- ❌ Tentava extrair `id_user` do **request body**
- ❌ Não usava o `id_user` vindo do **JWT token**
- ❌ Violava princípio de segurança

## ✅ Solução Implementada

### 1. Rota: POST `/api/posts/create`
**ANTES (INSEGURO):**
```javascript
const { id_user, rating, caption, ... } = req.body;
if (!id_user) {
  return res.status(400).json({ error: 'ID do usuário é obrigatório' });
}
```

**DEPOIS (SEGURO):**
```javascript
const id_user = req.user.id_user;  // ✅ Do JWT!
const { rating, caption, ... } = req.body;
if (!id_user) {
  return res.status(401).json({ error: 'Usuário não autenticado' });
}
```

### 2. Rota: POST `/api/posts/:postId/like`
**ANTES (INSEGURO):**
```javascript
app.post('/api/posts/:postId/like', checkDB, (req, res) => {
  const { id_user } = req.body;  // ❌ Do body!
```

**DEPOIS (SEGURO):**
```javascript
app.post('/api/posts/:postId/like', checkDB, authMiddleware, (req, res) => {
  const id_user = req.user.id_user;  // ✅ Do JWT!
  // ✅ Adicionado authMiddleware!
```

### 3. Rota: POST `/api/posts/:postId/comments`
**ANTES (INSEGURO):**
```javascript
app.post('/api/posts/:postId/comments', checkDB, (req, res) => {
  const { id_user, comment_text } = req.body;  // ❌ Do body!
```

**DEPOIS (SEGURO):**
```javascript
app.post('/api/posts/:postId/comments', checkDB, authMiddleware, (req, res) => {
  const id_user = req.user.id_user;  // ✅ Do JWT!
  const { comment_text } = req.body;
  // ✅ Adicionado authMiddleware!
```

---

## 🛡️ Princípios de Segurança Aplicados

### ✅ 1. Autenticação Obrigatória
```javascript
app.post('/api/posts/create', 
  checkDB, 
  authMiddleware,  // ✅ Valida JWT
  (req, res) => { ... }
);
```

### ✅ 2. Usar Dados do Token, Não do Body
```javascript
// ❌ ERRADO - Confia no frontend
const id_user = req.body.id_user;

// ✅ CORRETO - Valida JWT
const id_user = req.user.id_user;
```

### ✅ 3. Status Code Correto
```javascript
// Sem autenticação
if (!id_user) {
  return res.status(401).json({ error: 'Usuário não autenticado' });
}

// Dado inválido
if (rating < 1 || rating > 5) {
  return res.status(400).json({ error: 'Rating inválido' });
}
```

### ✅ 4. Separação de Responsabilidades
```
Frontend → Envia token no header Authorization
Middleware → Valida token e extrai usuário
Handler → Usa req.user para operações seguras
```

---

## 📋 Fluxo Correto Agora

### Criar Post:
```
1. Frontend faz login
2. Recebe token JWT
3. Faz POST /api/posts/create
   Headers: Authorization: Bearer TOKEN
   Body: { rating: 5, caption: "Bom!" }  // Sem id_user!

4. Backend:
   a. authMiddleware valida token
   b. Extrai id_user de req.user.id_user
   c. Valida dados do body
   d. Cria post com id_user do JWT
   e. Retorna 201
```

### Curtir Post:
```
1. Frontend faz POST /api/posts/1/like
   Headers: Authorization: Bearer TOKEN
   Body: {}  // Vazio! Não precisa enviar id_user

2. Backend:
   a. authMiddleware valida token
   b. Extrai id_user de req.user.id_user
   c. Processa like com id_user do JWT
   d. Retorna 200
```

### Comentar:
```
1. Frontend faz POST /api/posts/1/comments
   Headers: Authorization: Bearer TOKEN
   Body: { comment_text: "Concordo!" }  // Sem id_user!

2. Backend:
   a. authMiddleware valida token
   b. Extrai id_user de req.user.id_user
   c. Cria comentário com id_user do JWT
   d. Retorna 201
```

---

## 🔒 Por que é mais seguro?

### ❌ PROBLEMA ANTERIOR
```
Frontend pode enviar:
{
  "id_user": 999,  // Pode fingir ser outro usuário!
  "caption": "Hack do seu perfil"
}
```

### ✅ SOLUÇÃO ATUAL
```
Frontend NÃO pode enviar id_user:
{
  "caption": "Postagem legítima"
}

Backend valida que veio de usuário autenticado:
const id_user = req.user.id_user;  // Vem do token assinado
```

---

## 🧪 Testando as Correções

### 1. Login para obter token
```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "senha123"
  }'

# Response:
{
  "success": true,
  "token": "eyJhbGc...",
  "user": { "id_user": 1, "username": "user" }
}
```

### 2. Criar post COM autenticação ✅
```bash
curl -X POST http://localhost:3000/api/posts/create \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "caption": "Ótimo produto!",
    "category": "Eletrônicos"
  }'

# Response: 201 Created ✅
{
  "success": true,
  "message": "Review criado com sucesso!",
  "postId": 42
}
```

### 3. Criar post SEM autenticação ❌
```bash
curl -X POST http://localhost:3000/api/posts/create \
  -H "Content-Type: application/json" \
  -d '{
    "id_user": 1,
    "rating": 5,
    "caption": "Hack!"
  }'

# Response: 401 Unauthorized ❌
{
  "error": "Token não fornecido"
}
```

### 4. Curtir post COM autenticação ✅
```bash
curl -X POST http://localhost:3000/api/posts/1/like \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{}'

# Response: 200 OK ✅
{
  "success": true,
  "message": "Review curtido",
  "action": "liked"
}
```

### 5. Comentar SEM autenticação ❌
```bash
curl -X POST http://localhost:3000/api/posts/1/comments \
  -H "Content-Type: application/json" \
  -d '{
    "comment_text": "Hack!"
  }'

# Response: 401 Unauthorized ❌
{
  "error": "Token não fornecido"
}
```

---

## 📝 Resumo das Correções

| Rota | Antes | Depois | Status |
|------|-------|--------|--------|
| POST /api/posts/create | Sem auth | ✅ authMiddleware | ✅ CORRIGIDO |
| POST /api/posts/:id/like | id_user do body | ✅ req.user.id_user | ✅ CORRIGIDO |
| POST /api/posts/:id/comments | Sem auth | ✅ authMiddleware | ✅ CORRIGIDO |
| Extração de usuário | req.body | ✅ req.user | ✅ CORRIGIDO |
| Status code não-auth | 400 | ✅ 401 | ✅ CORRIGIDO |

---

## 🚀 Próximos Passos

1. ✅ Rotas POST protegidas com authMiddleware
2. ✅ id_user vem do JWT, não do body
3. ⏭️ Considerar proteger rotas GET também (privacidade)
4. ⏭️ Implementar rate limiting
5. ⏭️ Adicionar validação de CORS

**Seu backend agora é seguro! 🔐**
