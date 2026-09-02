/* ============================================================
   pdf-bundle/vite.config.js — build isolado dos documentos em react-pdf
   (Caminho B da migração — plano aprovado 20/08)

   NÃO É o build do app inteiro. O resto do projeto continua 100%
   sem build step (React UMD + Babel Standalone via CDN, ver
   CLAUDE.md). Este Vite roda só quando alguém edita um dos
   *.entry.js e precisa gerar de novo o .bundle.js estático
   correspondente em src/, que depois é servido como um <script>
   comum — igual jsPDF/html2canvas hoje.

   Um config, N entradas — escolhida por PDF_ENTRY (ver scripts no
   package.json: `npm run build:pdf` = RFQ, `npm run build:pdf:proposta`
   = Proposta). Cada fase nova só precisa adicionar uma linha em ENTRIES
   e um script novo — não um vite.config.js novo.

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

const ENTRIES = {
  pedido: { file: 'pedido-fornecedor-reactpdf.entry.js', name: 'PFReactPdfBundle', out: 'pedido-fornecedor-reactpdf.bundle.js' },
  proposta: { file: 'proposta-reactpdf.entry.js', name: 'PropostaReactPdfBundle', out: 'proposta-reactpdf.bundle.js' },
  vistoria: { file: 'vistoria-reactpdf.entry.js', name: 'VistoriaReactPdfBundle', out: 'vistoria-reactpdf.bundle.js' },
};
const chave = process.env.PDF_ENTRY || 'pedido';
const entrada = ENTRIES[chave];
if (!entrada) throw new Error(`PDF_ENTRY desconhecido: "${chave}". Use um de: ${Object.keys(ENTRIES).join(', ')}`);

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
      entry: resolve(__dirname, entrada.file),
      name: entrada.name,
      formats: ['iife'],
      fileName: () => entrada.out,
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: { react: 'React', 'react-dom': 'ReactDOM' },
      },
    },
  },
});
