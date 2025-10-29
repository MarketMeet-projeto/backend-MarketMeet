const { body } = require('express-validator');

const userValidations = {
  create: [
    body('username')
      .trim()
      .isLength({ min: 3 })
      .withMessage('Username deve ter no mínimo 3 caracteres'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Email inválido'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Senha deve ter no mínimo 6 caracteres'),
    body('birth_date')
      .matches(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      .withMessage('Data deve estar no formato DD/MM/YYYY')
  ],
  
  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Email inválido'),
    body('password')
      .exists()
      .withMessage('Senha é obrigatória')
  ],

  updateName: [
    body('userId')
      .exists()
      .withMessage('ID do usuário é obrigatório'),
    body('novoNome')
      .trim()
      .isLength({ min: 3 })
      .withMessage('Novo nome deve ter no mínimo 3 caracteres')
  ]
};

module.exports = userValidations;