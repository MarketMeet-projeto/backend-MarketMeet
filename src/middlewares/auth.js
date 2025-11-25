const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'SEU_SEGREDO_AQUI';

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('🔍 [Auth] Header Authorization:', authHeader ? authHeader.substring(0, 30) + '...' : 'não encontrado');
    
    const token = authHeader?.split(' ')[1];
    console.log('🔍 [Auth] Token extraído:', token ? token.substring(0, 20) + '...' : 'não encontrado');
    
    if (!token) {
      console.log('❌ [Auth] Erro: Token não fornecido');
      return res.status(401).json({ 
        error: 'Token não fornecido' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    console.log('✅ [Auth] Token verificado com sucesso. id_user:', decoded.id_user);
    
    next();
  } catch (error) {
    console.error('❌ [Auth] Erro de autenticação:', error.message);
    logger.error('Erro de autenticação:', error);
    return res.status(401).json({ 
      error: 'Token inválido',
      details: error.message
    });
  }
};

module.exports = authMiddleware;