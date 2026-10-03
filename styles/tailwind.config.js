/* Tailwind (v3.4.17 — a mesma versão que o antigo cdn.tailwindcss.com servia).
   Substitui o CDN em runtime: o CSS agora é gerado UMA vez e commitado em
   styles/tailwind.css. Sem tema customizado, igual ao CDN (defaults + preflight).

   Regerar depois de usar uma classe Tailwind nova (a partir da raiz do projeto):
     npx tailwindcss@3.4.17 -c styles/tailwind.config.js -i styles/tailwind.input.css -o styles/tailwind.css --minify
   e incrementar o ?v= do <link> em index.html.

   Atenção: o scanner lê o TEXTO dos arquivos. Classe montada por template
   (`bg-${cor}-500`) NÃO é detectada — escreva a classe inteira no código. */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
};
