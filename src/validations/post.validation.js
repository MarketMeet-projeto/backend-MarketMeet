const { body } = require('express-validator');

const postValidations = {
  create: [
    body('id_user')
      .exists()
      .withMessage('ID do usuário é obrigatório'),
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating deve estar entre 1 e 5'),
    body('caption')
      .trim()
      .notEmpty()
      .withMessage('Caption é obrigatório'),
    body('category')
      .trim()
      .notEmpty()
      .withMessage('Categoria é obrigatória'),
    body('product_photo')
      .isURL()
      .withMessage('URL da foto é inválida'),
    body('product_url')
      .isURL()
      .withMessage('URL do produto é inválida')
  ],

  comment: [
    body('id_user')
      .exists()
      .withMessage('ID do usuário é obrigatório'),
    body('comment_text')
      .trim()
      .notEmpty()
      .withMessage('Texto do comentário é obrigatório')
  ]
};

module.exports = postValidations;