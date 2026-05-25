/* ============================================================
   server.js — VP Gestão · VerticalParts
   Servidor Express mínimo para hospedar o app estático.
   Compatível com Hostinger Node.js (process.env.PORT injetado).
   ============================================================ */

'use strict';

const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

/* Serve todos os arquivos estáticos da raiz do projeto */
app.use(express.static(path.join(__dirname), {
  /* Não expor index.html no listing de pastas */
  index: 'index.html',
  /* Cache leve — 1 hora para CSS/JS, sem cache para HTML */
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  },
}));

/* Catch-all: qualquer rota que não seja um arquivo estático
   retorna index.html (necessário para SPA com rotas no futuro) */
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ VP Gestão rodando na porta ${PORT}`);
});
