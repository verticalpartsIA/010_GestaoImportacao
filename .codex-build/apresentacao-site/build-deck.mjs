import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT_DIR = "C:/Users/gelso/A/_RescunhosImportação/Imagens Site";
const INVENTORY = path.join(OUT_DIR, "inventario_telas.json");
const FINAL_PPTX = path.join(OUT_DIR, "Apresentacao_VP_Gestao_Importacao.pptx");
const FINAL_TXT = path.join(OUT_DIR, "Infografico_Ecossistema_VP_Gestao.txt");
const PREVIEW_DIR = path.join(OUT_DIR, "preview_slides");

const W = 1280;
const H = 720;
const C = {
  bg: "#F7F8FA",
  ink: "#121417",
  muted: "#667085",
  line: "#D8DEE8",
  yellow: "#F5C400",
  dark: "#1F242B",
  white: "#FFFFFF",
  blue: "#2153B6",
  green: "#1F8A5B",
};

const modulePurpose = {
  "Geral": "Concentra visão executiva, alertas, decisões e prazos para orientar a rotina diária.",
  "Cadastros": "Mantém a base mestre de clientes, fornecedores, produtos e instaladores usados pelos demais fluxos.",
  "Comercial": "Transforma oportunidades em formulários, cotações, propostas e acompanhamento comercial.",
  "ADM/Financeiro": "Controla cotações de fornecedor, precificação, aval financeiro e comissões.",
  "Jurídico": "Organiza contratos, minutas e documentos jurídicos ligados à venda e instalação.",
  "Importação": "Acompanha importações, embarques e informações logísticas internacionais.",
  "Gestão Importação": "Centraliza P.I., RFQ, IMS, embarques e análise de preços do processo internacional.",
  "Suprimentos": "Acompanha compras nacionais e pedidos depois das decisões comerciais e financeiras.",
  "Engenharia": "Conduz projetos técnicos, ficha técnica, instalação, vistoria, cronograma, ART e entrega final.",
  "Logística": "Organiza almoxarifado e movimentações físicas internas.",
  "Admin": "Controla logs, permissões, parâmetros e saúde operacional do portal.",
};

const screenPurpose = {
  "Dashboard": "Resume a operação em KPIs, projetos em andamento, tarefas, pipeline e alertas.",
  "Notificações": "Lista avisos do sistema, eventos automáticos e pendências recentes.",
  "Central de Decisões": "Reúne aprovações e decisões pendentes por responsável.",
  "Gatilhos & Prazo": "Mostra prazos, gatilhos de etapa e riscos de atraso.",
  "Clientes": "Cadastro central de clientes e dados comerciais/fiscais.",
  "Fornecedores": "Cadastro de fornecedores para cotações, importação e suprimentos.",
  "Produtos": "Catálogo técnico/fiscal de produtos, NCM e apoio ao Siscomex/DUIMP.",
  "Instaladores": "Homologação e acompanhamento de parceiros instaladores.",
  "Leads": "Entrada do funil comercial e qualificação inicial das oportunidades.",
  "Formulários": "Hub dos formulários de coleta técnica e comercial.",
  "Propostas": "Geração e gestão de propostas comerciais.",
  "Controle de Cotações": "Acompanha cotações abertas, fases e histórico de movimentação.",
  "Cotações a Fornecedor": "Gerencia solicitações de preço aos fornecedores.",
  "Precificação": "Calcula preço de venda, impostos, custos e margens.",
  "Aval Financeiro": "Avalia crédito, condições comerciais e liberação financeira.",
  "Comissões": "Calcula e acompanha comissionamento por proposta/venda.",
  "Jurídico": "Painel de contratos, minutas e pendências jurídicas.",
  "Contrato Venda de Equipamentos": "Gera e acompanha o contrato de venda de equipamentos.",
  "Importação": "Lista embarques/importações e seus status principais.",
  "Gestão Importação - Painel": "Visão sintética do fluxo de importação.",
  "P.I.": "Controla Proforma Invoice e dados iniciais da compra internacional.",
  "RFQ": "Gerencia solicitações de cotação internacional.",
  "IMS": "Acompanha registros internos de importação e documentação relacionada.",
  "Embarques": "Controla embarques, navios, BL, containers e status de trânsito.",
  "Análise de Preços": "Compara preços, fornecedores e condições de compra.",
  "Compras Nacional": "Controla compras locais e solicitações nacionais.",
  "Pedidos": "Acompanha pedidos de compra e entregas.",
  "Engenharia": "Painel inicial da área técnica e seus projetos.",
  "Projeto de Elevadores": "Configura dados técnicos e dimensionamento de elevadores.",
  "Projeto de Equipamento": "Configura equipamentos especiais e alternativas técnicas.",
  "Projetos ER/ES": "Acompanha projetos de escadas/esteiras rolantes.",
  "Ficha Técnica": "Consolida especificações técnicas, NCM e publicação de ficha.",
  "Contrato Instalador": "Gera contratos para parceiros instaladores.",
  "Vistorias de Obras": "Registra vistorias, fotos, pendências e status de obra.",
  "Instalação em Campo": "Acompanha checklist e execução da instalação.",
  "Status de Obras": "Mostra o status consolidado das obras em andamento.",
  "Linha do Tempo da Cotação": "Exibe histórico cronológico da cotação e seus eventos.",
  "ART": "Controla documentação de ART de instalação.",
  "Cronograma": "Planeja e acompanha etapas de instalação.",
  "Data Book & Termo": "Organiza documentação final, databook e termo de entrega.",
  "Entrega Final": "Controla handover, pós-venda e encerramento da obra.",
  "Almoxarifado": "Controla estoque, recebimentos e separação interna.",
  "Logs de Atividade": "Audita ações executadas no sistema.",
  "Configurações do Sistema": "Administra parâmetros, usuários e opções do portal.",
};

function truncate(text, max) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

function addText(slide, text, pos, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position: pos,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontSize: style.fontSize || 18,
    bold: !!style.bold,
    color: style.color || C.ink,
    alignment: style.alignment || "left",
  };
  return shape;
}

function addRule(slide, x, y, w, color = C.yellow) {
  slide.shapes.add({
    geometry: "rect",
    position: { left: x, top: y, width: w, height: 5 },
    fill: color,
    line: { style: "solid", fill: color, width: 0 },
  });
}

async function addImage(slide, imagePath, pos) {
  const bytes = await fs.readFile(imagePath);
  slide.images.add({
    blob: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    contentType: "image/png",
    alt: path.basename(imagePath),
    fit: "contain",
    position: pos,
    geometry: "rect",
  });
}

function bullets(items, limit = 6, each = 70) {
  return (items || []).slice(0, limit).map((x) => "• " + truncate(x, each)).join("\n");
}

function fieldsFor(row) {
  const f = row.fields?.length ? row.fields : row.labels || [];
  return f.length ? bullets(f, 8, 82) : "• Sem campos de preenchimento visíveis nesta visão.";
}

function actionsFor(row) {
  return row.buttons?.length ? bullets(row.buttons, 7, 72) : "• Sem botões de ação visíveis nesta visão.";
}

function titleSlide(presentation, inventory) {
  const slide = presentation.slides.add();
  slide.background.fill = C.dark;
  addRule(slide, 74, 88, 190, C.yellow);
  addText(slide, "VP Gestão Importação", { left: 74, top: 140, width: 760, height: 92 }, { fontSize: 54, bold: true, color: C.white });
  addText(slide, "Apresentação completa do ecossistema, propósito das telas, entradas, controles e prints do portal.", { left: 76, top: 248, width: 800, height: 86 }, { fontSize: 24, color: "#D8DEE8" });
  addText(slide, `${inventory.length} telas documentadas\nCapturado em 23/08/2026`, { left: 76, top: 462, width: 420, height: 96 }, { fontSize: 22, color: C.white });
  addText(slide, "VERTICALPARTS", { left: 860, top: 590, width: 300, height: 48 }, { fontSize: 28, bold: true, color: C.yellow, alignment: "right" });
}

function overviewSlide(presentation, inventory) {
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  addText(slide, "O portal conecta venda, engenharia, importação e entrega em um fluxo único", { left: 64, top: 48, width: 1060, height: 86 }, { fontSize: 38, bold: true });
  addRule(slide, 66, 128, 180);
  const modules = [...new Set(inventory.map((x) => x.module))];
  addText(slide, modules.map((m) => `${m}: ${modulePurpose[m] || "Módulo operacional do portal."}`).join("\n\n"),
    { left: 70, top: 168, width: 1120, height: 440 }, { fontSize: 18, color: C.ink });
  addText(slide, "Entrada comercial → cadastros e formulários → cotação/precificação → contrato → importação/suprimentos → engenharia/instalação → entrega/administração.", { left: 70, top: 632, width: 1120, height: 40 }, { fontSize: 20, bold: true, color: C.blue });
}

function flowSlide(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  addText(slide, "Infográfico textual do ecossistema operacional", { left: 64, top: 44, width: 980, height: 54 }, { fontSize: 38, bold: true });
  addRule(slide, 66, 104, 180);
  const steps = [
    ["1", "Base", "Clientes, fornecedores, produtos e instaladores sustentam todos os registros."],
    ["2", "Comercial", "Lead vira formulário, cotação, proposta e contrato."],
    ["3", "Financeiro", "Cotação de fornecedor, precificação, aval e comissão validam a venda."],
    ["4", "Jurídico", "Contratos formalizam venda e instalação."],
    ["5", "Importação", "P.I., RFQ, IMS, embarques e análise de preços acompanham compra internacional."],
    ["6", "Engenharia", "Projeto, ficha técnica, vistoria, instalação, ART, cronograma e entrega fecham a obra."],
    ["7", "Admin", "Logs e configurações garantem governança, auditoria e operação contínua."],
  ];
  let y = 140;
  for (const [n, title, body] of steps) {
    slide.shapes.add({ geometry: "ellipse", position: { left: 78, top: y, width: 46, height: 46 }, fill: C.yellow, line: { style: "solid", fill: C.yellow, width: 0 } });
    addText(slide, n, { left: 78, top: y + 7, width: 46, height: 30 }, { fontSize: 20, bold: true, alignment: "center" });
    addText(slide, title, { left: 150, top: y - 4, width: 260, height: 34 }, { fontSize: 24, bold: true });
    addText(slide, body, { left: 150, top: y + 30, width: 940, height: 35 }, { fontSize: 17, color: C.muted });
    if (n !== "7") slide.shapes.add({ geometry: "rect", position: { left: 99, top: y + 50, width: 4, height: 28 }, fill: C.line, line: { style: "solid", fill: C.line, width: 0 } });
    y += 74;
  }
}

async function moduleIntro(presentation, module, rows) {
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  addText(slide, module, { left: 64, top: 48, width: 760, height: 60 }, { fontSize: 44, bold: true });
  addRule(slide, 66, 112, 170);
  addText(slide, modulePurpose[module] || "Módulo operacional do portal.", { left: 66, top: 146, width: 1040, height: 70 }, { fontSize: 24, color: C.muted });
  const names = rows.map((r) => `${r.index}. ${r.label}`).join("\n");
  addText(slide, names, { left: 74, top: 250, width: 460, height: 350 }, { fontSize: 20 });
  const first = rows.find((r) => r.screenshot);
  if (first) await addImage(slide, first.screenshot, { left: 590, top: 230, width: 560, height: 315 });
}

async function screenSlide(presentation, row) {
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  addText(slide, `${row.index}. ${row.label}`, { left: 48, top: 34, width: 650, height: 50 }, { fontSize: 35, bold: true });
  addText(slide, row.module, { left: 930, top: 42, width: 250, height: 28 }, { fontSize: 18, bold: true, color: C.blue, alignment: "right" });
  addRule(slide, 50, 92, 150);
  addText(slide, "Propósito", { left: 54, top: 126, width: 250, height: 28 }, { fontSize: 24, bold: true });
  addText(slide, screenPurpose[row.label] || modulePurpose[row.module] || "Tela operacional do portal.", { left: 54, top: 162, width: 350, height: 86 }, { fontSize: 17, color: C.muted });
  addText(slide, "Campos / inputs", { left: 54, top: 268, width: 260, height: 28 }, { fontSize: 22, bold: true });
  addText(slide, fieldsFor(row), { left: 54, top: 302, width: 370, height: 142 }, { fontSize: 15, color: C.ink });
  addText(slide, "Ações visíveis", { left: 54, top: 466, width: 260, height: 28 }, { fontSize: 22, bold: true });
  addText(slide, actionsFor(row), { left: 54, top: 500, width: 370, height: 150 }, { fontSize: 15, color: C.ink });
  await addImage(slide, row.screenshot, { left: 456, top: 124, width: 760, height: 510 });
  addText(slide, truncate(row.url || "", 84), { left: 458, top: 648, width: 740, height: 24 }, { fontSize: 12, color: C.muted });
}

function closingSlide(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = C.dark;
  addRule(slide, 74, 92, 190, C.yellow);
  addText(slide, "Como usar esta documentação", { left: 74, top: 146, width: 860, height: 64 }, { fontSize: 44, bold: true, color: C.white });
  addText(slide, "1. Use os slides de ecossistema para explicar o propósito do portal.\n2. Use os slides por tela para treinamento e validação com usuários.\n3. Use o TXT complementar como checklist de campos, botões e módulos.\n4. Atualize os prints sempre que o menu ou fluxo mudar.", { left: 80, top: 250, width: 860, height: 260 }, { fontSize: 24, color: "#E9ECF2" });
  addText(slide, "Entrega salva em: C:/Users/gelso/A/_RescunhosImportação/Imagens Site", { left: 82, top: 612, width: 980, height: 34 }, { fontSize: 18, color: C.yellow });
}

async function writeTextInventory(inventory) {
  const lines = [];
  lines.push("VP Gestão Importação - Infográfico textual completo do ecossistema");
  lines.push("Capturado em 23/08/2026");
  lines.push("");
  lines.push("Fluxo macro:");
  lines.push("Cadastros -> Comercial -> Financeiro/ADM -> Jurídico -> Importação/Suprimentos -> Engenharia/Instalação -> Logística/Admin.");
  lines.push("");
  for (const module of [...new Set(inventory.map((x) => x.module))]) {
    lines.push(`## ${module}`);
    lines.push(modulePurpose[module] || "Módulo operacional do portal.");
    for (const row of inventory.filter((x) => x.module === module)) {
      lines.push("");
      lines.push(`${row.index}. ${row.label}`);
      lines.push(`Propósito: ${screenPurpose[row.label] || modulePurpose[row.module] || "Tela operacional do portal."}`);
      lines.push(`URL: ${row.url || ""}`);
      lines.push(`Print: ${row.screenshot || ""}`);
      lines.push("Campos/inputs:");
      lines.push((row.fields?.length ? row.fields : ["Sem campos de preenchimento visíveis nesta visão."]).map((x) => `- ${x}`).join("\n"));
      lines.push("Botões/ações:");
      lines.push((row.buttons?.length ? row.buttons : ["Sem botões de ação visíveis nesta visão."]).map((x) => `- ${x}`).join("\n"));
      if (row.tableHeaders?.length) {
        lines.push("Colunas/tabelas:");
        lines.push(row.tableHeaders.map((x) => `- ${x}`).join("\n"));
      }
    }
    lines.push("");
  }
  await fs.writeFile(FINAL_TXT, lines.join("\n"), "utf8");
}

async function main() {
  await fs.mkdir(PREVIEW_DIR, { recursive: true });
  const inventory = JSON.parse(await fs.readFile(INVENTORY, "utf8"));
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });

  titleSlide(presentation, inventory);
  overviewSlide(presentation, inventory);
  flowSlide(presentation);

  for (const module of [...new Set(inventory.map((x) => x.module))]) {
    const rows = inventory.filter((x) => x.module === module);
    await moduleIntro(presentation, module, rows);
    for (const row of rows) await screenSlide(presentation, row);
  }
  closingSlide(presentation);
  await writeTextInventory(inventory);

  for (const [i, slide] of presentation.slides.items.entries()) {
    const png = await presentation.export({ slide, format: "png", scale: 1 });
    await fs.writeFile(path.join(PREVIEW_DIR, `slide-${String(i + 1).padStart(2, "0")}.png`), new Uint8Array(await png.arrayBuffer()));
  }
  const montage = await presentation.export({ format: "webp", montage: true, scale: 1 });
  await fs.writeFile(path.join(OUT_DIR, "preview_montage.webp"), new Uint8Array(await montage.arrayBuffer()));
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(FINAL_PPTX);
  console.log(JSON.stringify({ pptx: FINAL_PPTX, txt: FINAL_TXT, slides: presentation.slides.items.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
