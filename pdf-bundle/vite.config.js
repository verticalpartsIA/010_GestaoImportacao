/* ============================================================
   pdf-bundle/vite.config.js — build isolado só pro RFQ em react-pdf
   (Fase 1 da migração, Caminho B — plano aprovado 20/08)

   NÃO É o build do app inteiro. O resto do projeto continua 100%
   sem build step (React UMD + Babel Standalone via CDN, ver
   CLAUDE.md). Este Vite roda só quando alguém edita
   pedido-fornecedor-reactpdf.entry.js e precisa gerar de novo o
   arquivo estático `src/pedido-fornecedor-reactpdf.bundle.js`, que
   depois é servido como um <script> comum — igual jsPDF/html2canvas
   hoje. Rodar: `npm run build:pdf`.

   React/ReactDOM ficam como "external", resolvidos em runtime pro
   window.React/window.ReactDOM que o app já carrega via CDN — sem
   isso, o bundle traria sua própria cópia do React, e foi exatamente
   essa duplicidade (entre outras coisas) que quebrou o Caminho A
   (CDN ESM sem bundler, achado 20/08).
   ============================================================ */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  /* saída IIFE roda direto no browser, sem processo Node por trás —
     algumas deps bundladas (via node_modules) checam process.env.NODE_ENV
     sem guarda, e sem isso o bundle quebra com "process is not defined"
     assim que carrega (achado 20/08). */
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}',
  },
  build: {
    outDir: resolve(__dirname, '..', 'src'),
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: resolve(__dirname, 'pedido-fornecedor-reactpdf.entry.js'),
      name: 'PFReactPdfBundle',
      formats: ['iife'],
      fileName: () => 'pedido-fornecedor-reactpdf.bundle.js',
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: { react: 'React', 'react-dom': 'ReactDOM' },
      },
    },
  },
});
