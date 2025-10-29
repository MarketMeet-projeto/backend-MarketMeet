# MarketMeet Backend

Backend da aplicação MarketMeet, uma plataforma de reviews de produtos.

## Requisitos

- Node.js 14+
- MySQL 8+

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/MarketMeet-projeto/backend-MarketMeet.git
cd backend-MarketMeet
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. Inicie o servidor:
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## Scripts Disponíveis

- `npm start` - Inicia o servidor em produção
- `npm run dev` - Inicia o servidor em desenvolvimento com hot-reload
- `npm test` - Executa os testes
- `npm run lint` - Verifica o código com ESLint
- `npm run lint:fix` - Corrige automaticamente problemas de lint

## Endpoints

### Usuários

- `POST /api/users/create` - Criar novo usuário
- `POST /api/users/login` - Login de usuário
- `GET /api/users/:id` - Buscar usuário por ID
- `GET /api/users/profile/:userId` - Buscar perfil do usuário
- `PUT /api/users/update-name` - Atualizar nome do usuário

### Posts (Reviews)

- `POST /api/posts/create` - Criar novo review
- `GET /api/posts/timeline` - Listar todos os reviews
- `GET /api/posts/user/:userId` - Listar reviews de um usuário
- `GET /api/posts/category/:category` - Listar reviews por categoria
- `DELETE /api/posts/:postId` - Deletar review

### Interações

- `POST /api/posts/:postId/like` - Curtir/descurtir review
- `GET /api/posts/:postId/like-status` - Verificar status de curtida
- `POST /api/posts/:postId/comments` - Adicionar comentário
- `GET /api/posts/:postId/comments` - Listar comentários
- `DELETE /api/posts/:postId/comments/:commentId` - Deletar comentário

## Segurança

- Autenticação JWT
- Rate Limiting
- CORS configurável
- Proteção contra ataques comuns (helmet)
- Validação de entrada
- Logs estruturados

## Estrutura do Projeto

```
src/
  ├── config/        # Configurações (DB, segurança)
  ├── controllers/   # Controladores das rotas
  ├── middlewares/   # Middlewares (auth, error handling)
  ├── routes/        # Definição das rotas
  ├── services/      # Lógica de negócio
  ├── utils/         # Utilitários (logger, etc)
  ├── validations/   # Schemas de validação
  ├── app.js         # Configuração do Express
  └── db.js         # Conexão com banco de dados
```

## Contribuindo

1. Fork o projeto
2. Crie sua branch de feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request