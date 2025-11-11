# 🔥 Refatoração do Backend com RxJS

## 📋 Alterações Realizadas

### 1. ✅ Serviço de Autenticação com RxJS
**Arquivo:** `src/services/auth.service.js`

- Pipeline de login com RxJS para validação, busca de usuário e geração de JWT
- Utiliza `mergeMap` para operações sequenciais (buscar usuário → validar senha → gerar token)
- Tratamento centralizado de erros com `catchError`
- Logs automáticos com `tap`

```typescript
loginUser(email, password)
  → Validar email/senha
  → Buscar usuário no banco
  → Validar senha com bcrypt
  → Gerar JWT
  → Log de sucesso/erro
```

### 2. ✅ Serviço de Posts com RxJS
**Arquivo:** `src/services/post.service.js`

#### Métodos Implementados:
- **createPost**: Cria novo post com validação de rating
- **getPostsTimeline**: Carrega timeline com dados do autor usando `combineLatest`
- **toggleLike**: Curtir/descurtir com verificação
- **addComment**: Adicionar comentário com validação

Pipeline exemplo (createPost):
```
of(postData)
  → tap: Validar userId
  → tap: Validar rating (1-5)
  → mergeMap: Encontrar usuário
  → mergeMap: Salvar no banco
  → tap: Log de sucesso
  → catchError: Tratamento de erro
```

### 3. ✅ Atualização da Rota de Login
**Arquivo:** `src/routes/users.js`

```javascript
// Antes: Promises/Callbacks
// Depois: RxJS
app.post('/api/users/login', checkDB, (req, res) => {
  authService.loginUser(email, password).subscribe({
    next: (result) => { res.json({...}) },
    error: (err) => { res.status(401).json({...}) }
  });
});
```

### 4. ✅ Nova Rota de Posts com RxJS
**Arquivo:** `src/routes/posts-rxjs.js`

Rotas refatoradas para usar RxJS:
- ✅ POST `/api/posts/create` - Autenticado, cria post com validação
- ✅ GET `/api/posts/timeline` - Carrega timeline com dados enriquecidos
- ✅ POST `/api/posts/:postId/like` - Curtir/descurtir com RxJS
- ✅ POST `/api/posts/:postId/comments` - Adicionar comentário autenticado

### 5. ✅ Atualização do Server
**Arquivo:** `server.js`

```javascript
const userRoutes = require('./src/routes/users');
const postRoutes = require('./src/routes/posts-rxjs');

userRoutes(app);
postRoutes(app);
```

---

## 🎯 Benefícios da Implementação RxJS

### ✅ Legibilidade
Pipelines claros e fáceis de entender a sequência de operações

### ✅ Composição
Operadores reutilizáveis (mergeMap, tap, map, filter)

### ✅ Error Handling
Centralizado em `catchError` - sem try/catch espalhados

### ✅ Transformações de Dados
- `map`: Transformar dados
- `filter`: Filtrar dados
- `tap`: Side effects (logs)
- `mergeMap`: Operações assíncronas

### ✅ Logging Automático
O `tap` permite logs sem impactar a lógica principal

### ✅ Assincronismo
Gerenciamento elegante de Promises e callbacks

---

## 🔐 Fluxo de Autenticação

```
LOGIN
  ↓
Email + Senha
  ↓
AuthService.loginUser()
  ↓
  1. Validar credenciais
  2. Buscar usuário no banco
  3. Validar senha (bcrypt)
  4. Gerar JWT
  5. Retornar token
  ↓
Front armazena token em localStorage
  ↓
Em cada requisição protegida:
  - Enviar header: Authorization: Bearer TOKEN
  ↓
Middleware authMiddleware verifica token
  ↓
Se válido: Permite criar posts, comentar, curtir
Se inválido: Retorna 401 Unauthorized
```

---

## 📊 Fluxo de Criação de Post

```
POST /api/posts/create
{ id_user, rating, caption, ... }
  ↓
authMiddleware (valida JWT)
  ↓
PostService.createPost()
  ↓
  1. Validar userId
  2. Validar rating (1-5)
  3. Encontrar usuário (mergeMap)
  4. Salvar post no banco (mergeMap)
  5. Log de sucesso (tap)
  ↓
subscribe {
  next: Retorna 201 + postId
  error: Retorna 400 + mensagem
}
```

---

## 🧪 Testando as Rotas

### 1. Login e obter Token
```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"senha123"}'
```

Resposta:
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": { "id_user": 1, "username": "user", ... }
}
```

### 2. Criar Post (com token)
```bash
curl -X POST http://localhost:3000/api/posts/create \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rating":5,"caption":"Ótimo!","category":"Eletrônicos"}'
```

### 3. Buscar Timeline
```bash
curl http://localhost:3000/api/posts/timeline
```

### 4. Curtir Post (com token)
```bash
curl -X POST http://localhost:3000/api/posts/1/like \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json"
```

---

## ⚠️ Considerações

✅ **RxJS** adiciona padrão reativo consistente entre front e back
✅ **Composição** de operadores reutilizáveis
✅ **Error handling** centralizado
✅ **Logging** integrado sem poluir lógica
✅ **Transformações** de dados elegantes

⚠️ **Overhead**: RxJS adiciona bundle size (considere trade-offs)
⚠️ **Curva de aprendizado**: Equipe precisa conhecer RxJS
⚠️ **Subscribers**: Precisam sempre ter error handling

---

## 🚀 Próximos Passos

1. Instalar RxJS no backend: `npm install rxjs`
2. Testar login e obter token
3. Testar criação de posts com autenticação
4. Implementar refresh token (opcional)
5. Adicionar logs detalhados com sentry/logging

---

**Seu backend agora usa RxJS com padrão reativo! 🎉**
