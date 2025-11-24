# 🧪 TESTE DE REQUISIÇÕES - TIMELINE, CURTIDAS E POSTAGENS

## 📌 PRÉ-REQUISITOS

1. Backend rodando: `npm run dev`
2. JWT Token válido (obtenha fazendo login)
3. Substitua `YOUR_JWT_TOKEN` pelos seus tokens reais
4. Substitua `USER_ID` e `POST_ID` pelos valores reais

---

## 🔐 1️⃣ AUTENTICAÇÃO (Obter JWT)

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@example.com",
    "password": "senha123"
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id_user": 1,
    "username": "joao",
    "email": "usuario@example.com"
  }
}
```

**Copie o token para usar nas próximas requisições!**

---

## 📝 2️⃣ CRIAR POSTAGEM

### Requisição
```bash
curl -X POST http://localhost:3000/api/posts/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "rating": 5,
    "caption": "Produto excelente! Recomendo muito.",
    "category": "Eletrônicos",
    "product_photo": "https://example.com/photo.jpg",
    "product_url": "https://example.com/product"
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Review criado com sucesso!",
  "postId": 42
}
```

**✅ Validações:**
- Rating entre 1-5 ✓
- Campos opcionais (photo, url) ✓
- id_user vem do JWT ✓

---

## 📊 3️⃣ BUSCAR TIMELINE (Com campo isLiked)

### Requisição
```bash
curl -X GET http://localhost:3000/api/posts/timeline \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Resposta esperada:**
```json
{
  "success": true,
  "posts": [
    {
      "id_post": 42,
      "rating": 5,
      "caption": "Produto excelente!",
      "category": "Eletrônicos",
      "product_photo": "https://example.com/photo.jpg",
      "product_url": "https://example.com/product",
      "created_at": "2025-11-23T10:30:00.000Z",
      "username": "joao",
      "id_user": 1,
      "likes_count": 3,
      "comments_count": 1,
      "isLiked": false              ← NOVO CAMPO! ✨
    },
    {
      "id_post": 41,
      "rating": 4,
      "caption": "Muito bom!",
      "likes_count": 5,
      "comments_count": 2,
      "isLiked": true               ← Você já curtiu este
    }
  ]
}
```

**✅ Verificar:**
- [x] Campo `isLiked` presente
- [x] Valor correto (true/false)
- [x] Ordenado por data (DESC)
- [x] Contagem de likes correta

---

## ❤️ 4️⃣ CURTIR UM POST

### Requisição (primeira vez - curtir)
```bash
curl -X POST http://localhost:3000/api/posts/42/like \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Review curtido",
  "action": "liked"
}
```

**Banco de dados:**
```
Tabela: likes
┌────────┬─────────┬────────────────────────┐
│ id_like│ id_post │ id_user │ created_at  │
├────────┼─────────┼─────────┼─────────────┤
│ 100    │ 42      │ 1       │ 2025-11-23  │ ← Novo registro!
└────────┴─────────┴─────────┴─────────────┘
```

### Requisição (segunda vez - descurtir)
```bash
curl -X POST http://localhost:3000/api/posts/42/like \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Curtida removida",
  "action": "unliked"
}
```

**Banco de dados:**
```
Tabela: likes
│ id_like│ id_post │ id_user │ created_at  │
├────────┼─────────┼─────────┼─────────────┤
│ (vazio - registro deletado!)
```

---

## 🔍 5️⃣ VERIFICAR STATUS DE CURTIDA

### Requisição
```bash
curl -X GET "http://localhost:3000/api/posts/42/like-status?id_user=1"
```

**Resposta esperada (se não curtiu):**
```json
{
  "success": true,
  "isLiked": false
}
```

**Resposta esperada (se curtiu):**
```json
{
  "success": true,
  "isLiked": true
}
```

---

## 👥 6️⃣ LISTAR USUÁRIOS QUE CURTIRAM

### Requisição
```bash
curl -X GET http://localhost:3000/api/posts/42/likes
```

**Resposta esperada:**
```json
{
  "success": true,
  "likes": [
    {
      "id_user": 1,
      "username": "joao",
      "created_at": "2025-11-23T10:45:00.000Z"
    },
    {
      "id_user": 2,
      "username": "maria",
      "created_at": "2025-11-23T11:00:00.000Z"
    }
  ]
}
```

---

## 💬 7️⃣ ADICIONAR COMENTÁRIO

### Requisição
```bash
curl -X POST http://localhost:3000/api/posts/42/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "comment_text": "Realmente recomendo!"
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Comentário adicionado com sucesso!",
  "commentId": 15
}
```

---

## 🗨️ 8️⃣ BUSCAR COMENTÁRIOS

### Requisição
```bash
curl -X GET http://localhost:3000/api/posts/42/comments
```

**Resposta esperada:**
```json
{
  "success": true,
  "comments": [
    {
      "id_comment": 15,
      "comment_text": "Realmente recomendo!",
      "created_at": "2025-11-23T12:00:00.000Z",
      "username": "joao",
      "id_user": 1
    }
  ]
}
```

---

## 📈 9️⃣ ESTATÍSTICAS DO POST

### Requisição
```bash
curl -X GET http://localhost:3000/api/posts/42/stats
```

**Resposta esperada:**
```json
{
  "success": true,
  "stats": {
    "likes_count": 3,
    "comments_count": 2
  }
}
```

---

## 🏷️ 🔟 BUSCAR POR CATEGORIA

### Requisição
```bash
curl -X GET http://localhost:3000/api/posts/category/Eletrônicos \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Resposta esperada:**
```json
{
  "success": true,
  "posts": [
    {
      "id_post": 42,
      "category": "Eletrônicos",
      "likes_count": 3,
      "isLiked": true,           ← Campo isLiked presente!
      // ... outros campos
    }
  ]
}
```

---

## ⭐ 1️⃣1️⃣ BUSCAR POR RATING

### Requisição
```bash
curl -X GET http://localhost:3000/api/posts/rating/5 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Resposta esperada:**
```json
{
  "success": true,
  "posts": [
    {
      "id_post": 42,
      "rating": 5,
      "likes_count": 3,
      "isLiked": true,           ← Campo isLiked presente!
      // ... outros campos
    }
  ]
}
```

---

## 👤 1️⃣2️⃣ BUSCAR POSTS DE UM USUÁRIO

### Requisição
```bash
curl -X GET http://localhost:3000/api/posts/user/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Resposta esperada:**
```json
{
  "success": true,
  "posts": [
    {
      "id_post": 42,
      "username": "joao",
      "id_user": 1,
      "likes_count": 3,
      "isLiked": false,          ← Campo isLiked presente!
      // ... outros campos
    }
  ]
}
```

---

## 🧹 1️⃣3️⃣ DELETAR POST

### Requisição
```bash
curl -X DELETE http://localhost:3000/api/posts/42 \
  -H "Content-Type: application/json" \
  -d '{
    "id_user": 1
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Review deletado com sucesso!"
}
```

**Banco de dados:**
```
- Post deletado
- Todos os likes associados deletados (CASCADE)
- Todos os comentários deletados (CASCADE)
```

---

## ❌ ERROS COMUNS E SOLUÇÕES

### ❌ Erro: "Token não fornecido"
```json
{
  "error": "Token não fornecido"
}
```
**Solução:** Adicione o header:
```bash
-H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### ❌ Erro: "Usuário não autenticado"
```json
{
  "error": "Usuário não autenticado"
}
```
**Solução:** Token inválido ou expirado, faça login novamente

---

### ❌ Erro: "Rating deve estar entre 1 e 5"
```json
{
  "error": "Rating deve estar entre 1 e 5"
}
```
**Solução:** Envie rating com valor 1-5:
```json
{
  "rating": 5
}
```

---

### ❌ Erro: "Banco de dados indisponível"
```json
{
  "error": "Banco de dados indisponível",
  "message": "O serviço está temporariamente indisponível..."
}
```
**Solução:** 
1. Verifique se MySQL está rodando
2. Verifique credenciais em `.env`
3. Verifique conexão de rede

---

## 📊 FLUXO COMPLETO DE TESTE

```
1. ✅ Fazer login e obter JWT
   └→ Copiar token

2. ✅ Criar postagem
   └→ Copiar post_id

3. ✅ Buscar timeline
   └→ Verificar se isLiked = false

4. ✅ Curtir post
   └→ Verificar se success = true

5. ✅ Buscar timeline novamente
   └→ Verificar se isLiked = true

6. ✅ Descurtir post
   └→ Verificar se success = true

7. ✅ Buscar timeline novamente
   └→ Verificar se isLiked = false
```

---

## 🎯 CHECKLIST DE VALIDAÇÃO

- [ ] Timeline carrega ao abrir tela
- [ ] Campo `isLiked` aparece (true/false)
- [ ] Curtir adiciona à contagem de likes
- [ ] Descurtir remove da contagem
- [ ] Campo `isLiked` muda após curtir/descurtir
- [ ] Compartilhamento funciona (se implementado)
- [ ] Dados persistem no banco de dados
- [ ] Autorização funciona (só pode deletar próprio post)
- [ ] Rate limit funciona (tenta 100x em 15 min)
- [ ] Erros retornam status code correto

---

**📝 Nota:** Execute cada requisição e valide as respostas

