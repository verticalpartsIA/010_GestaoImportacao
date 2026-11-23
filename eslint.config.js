'use strict';
/* Lint do VP Gestão (ESLint 9, configuração "flat").
   O app principal não tem bundler: são scripts globais (UMD) e JSX compilado
   no navegador. Por isso NÃO usamos `no-undef` (todo `window.X` global
   geraria falso alerta). Só regras que pegam erro real:
   - erro  = falha o CI (npm run lint);
   - aviso = aparece no relatório, não falha. */
// Os arquivos têm comentários `eslint-disable react-hooks/exhaustive-deps`;
// sem a regra registrada o ESLint acusa "regra não encontrada". Regra vazia
// só para o comentário valer (sem instalar o plugin de hooks).
const reactHooksVazio = {
  rules: { 'exhaustive-deps': { meta: { schema: [] }, create: () => ({}) } },
};

module.exports = [
  {
    ignores: [
      'node_modules/**', 'playwright-report/**', 'test-results/**', 'dist/**',
      'TreinamentoVP/**', 'docs/**', '.claude/**', 'research/**', 'supabase/**',
      'src/*.bundle.js', // gerados pelo Vite (npm run build:pdf*)
    ],
  },
  {
    files: ['**/*.js', '**/*.jsx', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooksVazio },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-dupe-else-if': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
      'no-cond-assign': 'error',
      'no-self-assign': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-func-assign': 'error',
      'no-import-assign': 'error',
      'no-sparse-arrays': 'error',
      'no-unsafe-negation': 'error',
      'no-redeclare': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['**/*.mjs', 'pdf-bundle/**'], // módulos ES (Vite)
    languageOptions: { sourceType: 'module' },
  },
];
