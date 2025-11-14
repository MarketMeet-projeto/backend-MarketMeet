// Arquivo legado: redireciona para `src/routes/posts.js` (implementação sem RxJS)
module.exports = (app) => {
  const posts = require('./posts');
  posts(app);
};
