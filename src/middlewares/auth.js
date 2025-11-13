const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'SEU_SEGREDO_AQUI';

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    console.log('Token recebido:', token);
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Token não fornecido' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    
    next();
  } catch (error) {
    logger.error('Erro de autenticação:', error);
    return res.status(401).json({ 
      error: 'Token inválido' 
    });
  }
};

module.exports = authMiddleware;