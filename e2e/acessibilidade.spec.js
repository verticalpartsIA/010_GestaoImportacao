'use strict';
/* Acessibilidade (WCAG 2.2 A/AA) com axe-core — PR 1 da spec
   docs/superpowers/specs/2026-11-08-qualidade-acessibilidade-hub.md.

   O que faz: abre cada tela da lista num Chromium real, roda o axe e separa as
   violações de gravidade crítica/séria em CONHECIDAS (listadas em
   acessibilidade-conhecidas.json) e NOVAS (qualquer outra).

   Modo (variável A11Y_MODO):
     aviso (padrão) — mostra as novas no relatório e NÃO reprova;
     falha          — reprova se houver violação nova.
   A virada para `falha` é decisão do Gelson (spec, tarefa T006).

   LIMITES (dizer sempre, Art. 4): o Supabase aqui é simulado e vazio
   (helpers.js), então só se mede o estado inicial da tela, sem tabela
   preenchida, modal aberto ou erro. O axe cobre só parte do WCAG; teclado,
   leitor de tela, zoom e celular não são testados. */
const fs = require('fs');
const path = require('path');
const { AxeBuilder } = require('@axe-core/playwright');
const { test, expect } = require('./fixtures');
const { coletarErros } = require('./helpers');

const MODO = (process.env.A11Y_MODO || 'aviso').toLowerCase();
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const GRAVES = ['critical', 'serious'];
const ERRO_BOUNDARY = 'Erro ao carregar o VP Gestão';

/* Só telas que abrem SEM token e dentro do shell do hub (spec, ANALYZE A7).
   `/assinar` e o Login ficam de fora de propósito. */
const TELAS = [
  { id: 'dashboard', rotulo: 'Dashboard' },
  { id: 'decisoes', rotulo: 'Central de Decisões' },
  { id: 'formulario-elevador', rotulo: 'Formulário de Elevador' },
  { id: 'formulario-quadro-comando', rotulo: 'Formulário do Quadro de Comando' },
  { id: 'propostas', rotulo: 'Propostas' },
  { id: 'aval-financeiro', rotulo: 'Aval Financeiro' },
  { id: 'cadastro-clientes', rotulo: 'Cadastros › Clientes' },
  { id: 'separacao', rotulo: 'Separação (pedidos a separar)' },
];

const ARQ_CONHECIDAS = path.join(__dirname, 'acessibilidade-conhecidas.json');
const DIR_SAIDA = path.join(__dirname, '..', 'test-results', 'a11y');

function lerConhecidas() {
  try { return JSON.parse(fs.readFileSync(ARQ_CONHECIDAS, 'utf8')).conhecidas || []; }
  catch (_) { return []; }
}

/* Uma violação é conhecida se a lista tem {tela, regra} e o alvo bate
   exatamente, ou alvo "*" (qualquer elemento daquela regra naquela tela). */
function ehConhecida(conhecidas, tela, regra, alvo) {
  return conhecidas.some((c) => c.tela === tela && c.regra === regra && (c.alvo === '*' || c.alvo === alvo));
}

test.describe('Acessibilidade — axe (WCAG 2.2 A/AA)', () => {
  // A 1ª tela de cada worker compila todos os .jsx (~20 a 45 s) e ainda espera o
  // vídeo de abertura sair; com os 60 s padrão o Dashboard estourou o tempo em
  // 1 de cada 2 execuções (medido em 08/11/2026) e só passava na repetição.
  test.describe.configure({ timeout: 120_000 });
  for (const tela of TELAS) {
    test(`${tela.id}: sem violação grave nova`, async ({ page }) => {
      const erros = coletarErros(page);
      await page.goto(`/geral/${tela.id}`);
      const main = page.locator('.app .main');
      const boundary = page.getByText(ERRO_BOUNDARY);
      await expect(main.or(boundary).first()).toBeVisible({ timeout: 45_000 });
      // Telas com atualização periódica (Dashboard) quase nunca ficam "ociosas":
      // não vale gastar os 30 s padrão esperando isso.
      await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
      expect(await boundary.count(), `Tela caiu no ErrorBoundary.\n${erros.join('\n')}`).toBe(0);
      // O vídeo de abertura (#vp-boot) é um overlay temporário: some quando o
      // vídeo termina ou em 12 s (src/app.jsx). Espera sair e, por garantia,
      // não o mede: não faz parte da tela testada (o contraste dele não é
      // medido aqui — pendência registrada na spec).
      await page.locator('#vp-boot').waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {});

      const r = await new AxeBuilder({ page }).withTags(TAGS).exclude('#vp-boot').analyze();
      const graves = r.violations.filter((v) => GRAVES.includes(v.impact));
      const conhecidas = lerConhecidas();

      const achados = [];
      for (const v of graves) {
        for (const n of v.nodes) {
          const alvo = n.target.join(' ');
          achados.push({ regra: v.id, impacto: v.impact, alvo, ajuda: v.help, conhecida: ehConhecida(conhecidas, tela.id, v.id, alvo) });
        }
      }
      const novas = achados.filter((a) => !a.conhecida);

      fs.mkdirSync(DIR_SAIDA, { recursive: true });
      fs.writeFileSync(path.join(DIR_SAIDA, `${tela.id}.json`), JSON.stringify({
        tela: tela.id, rotulo: tela.rotulo, rota: `/geral/${tela.id}`,
        violacoes: achados.length, novas: novas.length, achados,
        regrasAvaliadas: r.passes.length + r.violations.length,
      }, null, 1));

      if (novas.length) {
        const linhas = novas.map((a) => `  - [${a.impacto}] ${a.regra}: ${a.alvo.slice(0, 120)}`).join('\n');
        const texto = `${novas.length} violação(ões) grave(s) NOVA(S) em ${tela.id}:\n${linhas}`;
        console.log(`[a11y][${MODO}] ${texto}`);
        test.info().annotations.push({ type: 'a11y-novas', description: texto });
      }
      if (MODO === 'falha') {
        expect(novas, `Violações novas de acessibilidade em ${tela.id}`).toEqual([]);
      }
    });
  }
});
