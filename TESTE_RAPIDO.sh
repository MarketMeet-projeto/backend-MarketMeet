#!/bin/bash

# 🧪 SCRIPT DE TESTE RÁPIDO - TIMELINE, CURTIDAS E POSTAGENS
# Execute: bash TESTE_RAPIDO.sh

echo "================================"
echo "🧪 TESTE RÁPIDO DO BACKEND"
echo "================================"
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificações
echo -e "${YELLOW}1. Verificando se o backend está rodando...${NC}"
if curl -s http://localhost:3000/api/test > /dev/null; then
    echo -e "${GREEN}✓ Backend está online${NC}"
else
    echo -e "${RED}✗ Backend NÃO está respondendo${NC}"
    echo "Execute: npm run dev"
    exit 1
fi

echo ""
echo -e "${YELLOW}2. Verificando status da conexão com banco de dados...${NC}"
STATUS=$(curl -s http://localhost:3000/api/status)
DB_STATUS=$(echo $STATUS | grep -o '"database":"[^"]*"')
echo "Resultado: $DB_STATUS"

if echo $STATUS | grep -q '"database":"connected"'; then
    echo -e "${GREEN}✓ Banco de dados conectado${NC}"
else
    echo -e "${RED}✗ Banco de dados NÃO está conectado${NC}"
    echo "Verifique:"
    echo "  - Credenciais do MySQL em .env"
    echo "  - Se MySQL está rodando"
    echo "  - Se o banco 'MarketMeet' existe"
fi

echo ""
echo -e "${YELLOW}3. Verificando estrutura de rotas...${NC}"
echo "  Rotas esperadas:"
echo "  - POST   /api/posts/create          (criar postagem)"
echo "  - GET    /api/posts/timeline        (listar timeline com isLiked)"
echo "  - POST   /api/posts/:id/like        (curtir/descurtir)"
echo "  - GET    /api/posts/:id/like-status (verificar se curtiu)"
echo ""

echo -e "${YELLOW}4. Verificando pacotes instalados...${NC}"
PACKAGES=("express" "mysql2" "jsonwebtoken" "cors" "helmet")
for pkg in "${PACKAGES[@]}"; do
    if npm list $pkg > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $pkg"
    else
        echo -e "${RED}✗${NC} $pkg NÃO está instalado"
    fi
done

echo ""
echo -e "${YELLOW}5. Testando endpoints sem autenticação...${NC}"

echo "  Testando: GET /api/test"
RESPONSE=$(curl -s http://localhost:3000/api/test)
if echo $RESPONSE | grep -q '"message":"API funcionando!"'; then
    echo -e "${GREEN}✓ Resposta OK${NC}"
else
    echo -e "${RED}✗ Resposta inesperada${NC}"
fi

echo "  Testando: GET /api/status"
RESPONSE=$(curl -s http://localhost:3000/api/status)
if echo $RESPONSE | grep -q '"status":"online"'; then
    echo -e "${GREEN}✓ API está online${NC}"
else
    echo -e "${RED}✗ API não respondeu corretamente${NC}"
fi

echo ""
echo -e "${YELLOW}6. Verificando se routes/posts.js existe...${NC}"
if [ -f "src/routes/posts.js" ]; then
    echo -e "${GREEN}✓ Arquivo exists${NC}"
    LINES=$(wc -l < src/routes/posts.js)
    echo "  Linhas: $LINES"
    
    if grep -q "isLiked" src/routes/posts.js; then
        echo -e "${GREEN}✓ Campo 'isLiked' encontrado no código${NC}"
    else
        echo -e "${RED}✗ Campo 'isLiked' NÃO encontrado${NC}"
    fi
    
    if grep -q "authMiddleware" src/routes/posts.js; then
        echo -e "${GREEN}✓ Autenticação está implementada${NC}"
    else
        echo -e "${RED}✗ Autenticação NÃO encontrada${NC}"
    fi
else
    echo -e "${RED}✗ Arquivo não encontrado${NC}"
fi

echo ""
echo -e "${YELLOW}7. Verificando arquivo .env...${NC}"
if [ -f ".env" ]; then
    echo -e "${GREEN}✓ Arquivo .env existe${NC}"
    echo "  Variáveis encontradas:"
    [ -n "$DB_HOST" ] && echo "    - DB_HOST configurado" || echo -e "${RED}    - DB_HOST não configurado${NC}"
    [ -n "$DB_USER" ] && echo "    - DB_USER configurado" || echo -e "${RED}    - DB_USER não configurado${NC}"
    [ -n "$DB_NAME" ] && echo "    - DB_NAME configurado" || echo -e "${RED}    - DB_NAME não configurado${NC}"
    [ -n "$JWT_SECRET" ] && echo "    - JWT_SECRET configurado" || echo -e "${RED}    - JWT_SECRET não configurado${NC}"
else
    echo -e "${RED}✗ Arquivo .env não encontrado${NC}"
    echo "  Crie um arquivo .env com:"
    echo "    DB_HOST=localhost"
    echo "    DB_USER=root"
    echo "    DB_PASSWORD=root"
    echo "    DB_NAME=MarketMeet"
    echo "    JWT_SECRET=seu_segredo_aqui"
    echo "    CORS_ORIGIN=*"
fi

echo ""
echo "================================"
echo -e "${GREEN}✅ CHECK COMPLETO${NC}"
echo "================================"
echo ""
echo "Próximos passos:"
echo "1. Se algum teste falhou, revise as mensagens acima"
echo "2. Execute o arquivo TESTE_REQUISICOES.md com exemplos de curl"
echo "3. Use Postman para testar endpoints com autenticação"
echo ""

