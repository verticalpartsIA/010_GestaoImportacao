/* ============================================================
   etiquetas.jsx — Logística Interna · Etiquetas (fase 1: Endereço e Item; teste de bancada; histórico).
   Spec: docs/superpowers/specs/2026-10-17-modulo-etiquetas-design.md · regras em etiquetas-calc.js, impressoras em
   etiquetas-impressoras.js, dados em etiquetas-store.js.
   Regras que existem por motivo:
   - Só quem tem a alçada etiquetas.imprimir imprime; reimprimir exige etiquetas.reimprimir E um motivo. O banco confere de novo (RLS).
   - O modelo tem tamanho próprio (100 × 50 ou 100 × 100): se o rolo informado para a impressora não confere, NÃO imprime (evita
     etiqueta cortada ou fora de posição).
   - Impressora Zebra (Browser Print) com perfil ZPL imprime em ZPL nativo; qualquer outra (ou perfil sem renderizador) cai no
     diálogo de impressão do navegador, com uma página por etiqueta no tamanho exato.
   - O DV do endereço nasce DESLIGADO: a fórmula é proposta e ainda não foi aprovada; só ligue depois da aprovação, antes de imprimir as 236.
   - Aba e etiqueta em edição ficam na URL (useRouteTab): /logistica/etiquetas/gerar/<tipo> | modelos | historico.
   ============================================================ */

const ETQ_CALC = () => window.EtiquetasCalc;
const ETQ_IMP = () => window.EtiquetasImpressoras;
const ETQ_STORE = () => window.EtiquetasStore;

/* Biblioteca de código de barras (bwip-js 4.5.1, ~1 MB): carregada só quando esta tela precisa, com SRI. */
let etqBwipPromise = null;
function etqCarregarBwip() {
  if (window.bwipjs) return Promise.resolve(window.bwipjs);
  if (!etqBwipPromise) {
    etqBwipPromise = new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/bwip-js/4.5.1/bwip-js-min.js';
      s.integrity = 'sha384-dq+q79ChfpjqVAKSnJQTHOKU7UnrQWyGu44+Cl6xngUgnJ9kEUsjS3U/vRF420By';
      s.crossOrigin = 'anonymous';
      s.onload = () => ok(window.bwipjs);
      s.onerror = () => { etqBwipPromise = null; no(new Error('Não consegui carregar a biblioteca de código de barras (verifique a internet).')); };
      document.head.appendChild(s);
    });
  }
  return etqBwipPromise;
}
function etqBarcode(tipo, texto) {
  const b = window.bwipjs;
  if (!b) return null;
  try {
    return tipo === 'qr' ? b.toSVG({ bcid: 'qrcode', text: texto, eclevel: 'M' }) : b.toSVG({ bcid: 'code128', text: texto, includetext: false, height: 10 });
  } catch (e) { return null; }
}
/* Modelos girados (Expedição): o desenho (SVG, o mesmo da prévia e do navegador) é rasterizado em preto e branco no tamanho exato da
   etiqueta em pontos da impressora e vai como imagem (^GFA). Devolve { bits, largura, altura }. */
function etqRasterizar(svg, largura, altura) {
  return new Promise((ok, no) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      try {
        const cv = document.createElement('canvas');
        cv.width = largura; cv.height = altura;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.fillStyle = '#fff'; cx.fillRect(0, 0, largura, altura);
        cx.drawImage(img, 0, 0, largura, altura);
        const px = cx.getImageData(0, 0, largura, altura).data;
        const bits = new Uint8Array(largura * altura);
        for (let i = 0; i < bits.length; i++) {
          const lum = px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114;
          bits[i] = lum < 170 ? 1 : 0;
        }
        URL.revokeObjectURL(url);
        ok({ bits, largura, altura });
      } catch (e) { URL.revokeObjectURL(url); no(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error('Não consegui desenhar a etiqueta para enviar à impressora.')); };
    img.src = url;
  });
}
/* Junta os formatos ZPL em envios de até ~1,5 MB e 100 etiquetas (limite de 2 MB do Browser Print). */
function etqLotes(blocos) {
  const lotes = []; let atual = [], tam = 0;
  for (const b of blocos) {
    if (atual.length && (atual.length >= 100 || tam + b.length > 1500000)) { lotes.push(atual); atual = []; tam = 0; }
    atual.push(b); tam += b.length;
  }
  if (atual.length) lotes.push(atual);
  return lotes;
}
function useEtqBwip() {
  const [pronto, setPronto] = React.useState(!!window.bwipjs);
  const [erro, setErro] = React.useState(null);
  React.useEffect(() => {
    let vivo = true;
    etqCarregarBwip().then(() => { if (vivo) setPronto(true); }).catch((e) => { if (vivo) setErro(e.message); });
    return () => { vivo = false; };
  }, []);
  return { pronto, erro };
}

const ETQ_TIPOS = [
  { id: 'ENDERECO', nome: 'Endereço', modelo: 'ENDERECO_VIGA_100x50', desc: 'Posição do porta-palete (QR END:R2A4)' },
  { id: 'ITEM', nome: 'Item', modelo: 'ITEM_100x50', desc: 'Produto: QR e Code 128 com o código' },
  { id: 'RECEBIMENTO', nome: 'Recebimento', modelo: 'RECEBIMENTO_100x50', desc: 'Carga que chegou: P.I., fornecedor, item e quantidade' },
  { id: 'SEPARACAO', nome: 'Separação', modelo: 'SEPARACAO_100x100', desc: 'Volume n/N de um pedido de venda (100 × 50, 100 × 100 ou 100 × 150)' },
  { id: 'EXPEDICAO', nome: 'Expedição (NF)', modelo: 'EXPEDICAO_100x150', desc: 'Volumes 1/N de uma NF emitida (rolo 100 × 150): destinatário, transportadora, nº do pedido' },
  { id: 'PALETE', nome: 'Palete', modelo: 'PALETE_100x50', desc: 'Palete inteiro: código, P.I. e itens com quantidade' },
  { id: 'IDTAG_EQUIPAMENTO', nome: 'ID-TAG', modelo: 'IDTAG_100x50', desc: 'Identifica cada elevador (VPEL-EL0985-1…)' },
  { id: 'OP_QUADRO', nome: 'OP / série do quadro', modelo: 'OP_QUADRO_100x50', desc: 'OP do PCP e nº de série do quadro de comando' },
  { id: 'AVARIA', nome: 'Avaria', modelo: 'AVARIA_100x50', desc: 'Material danificado, retido' },
  { id: 'FABRICACAO_OP', nome: 'Fabricação (OP do PCP)', modelo: 'FABRICACAO_50x30', desc: 'Peça cortada/fabricada no PCP: cabo de aço, corrimão, cabo elétrico e de manobra (50 × 30, só texto)' },
  { id: 'CHICOTE_QUADRO', nome: 'Chicote do quadro', modelo: 'CHICOTE_50x30', desc: 'Fiação que acompanha o quadro: "FAN | 1212 Modernização" (50 × 30, só texto)' },
];
// Endereço de cada tipo na URL: /logistica/etiquetas/gerar/<slug>
const ETQ_SLUG_TIPO = { ENDERECO: 'endereco', ITEM: 'item', RECEBIMENTO: 'recebimento', SEPARACAO: 'separacao', EXPEDICAO: 'expedicao-nf', PALETE: 'palete', IDTAG_EQUIPAMENTO: 'id-tag', OP_QUADRO: 'op-serie-quadro', AVARIA: 'avaria', CHICOTE_QUADRO: 'chicote-quadro', FABRICACAO_OP: 'fabricacao-op' };
const ETQ_TIPO_SLUG = Object.fromEntries(Object.entries(ETQ_SLUG_TIPO).map(([k, v]) => [v, k]));
const etqHoje = () => new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
// Valores crus dos campos do rolo (podem estar vazios enquanto a pessoa digita); sem eles, vale o formato antigo "100x50".
function etqEntradaRolo(cfg) {
  const leg = ETQ_CALC().geometriaRolo({ rolo: cfg && cfg.rolo });
  const tem = (v) => v !== undefined && v !== null;
  const c = cfg || {};
  return { largura: tem(c.largura_mm) ? c.largura_mm : leg.largura, altura: tem(c.altura_mm) ? c.altura_mm : leg.altura, colunas: tem(c.colunas) ? c.colunas : 1, espaco: tem(c.espaco_mm) ? c.espaco_mm : 3, deslX: tem(c.desl_x_mm) ? c.desl_x_mm : 0, deslY: tem(c.desl_y_mm) ? c.desl_y_mm : 0 };
}
const etqChaveGirar = 'vp_etiquetas_girar';
const etqLerGirar = () => { try { return localStorage.getItem(etqChaveGirar) === '270' ? 270 : 90; } catch (e) { return 90; } };
const etqChaveDv = 'vp_etiquetas_dv';
const etqLerDv = () => { try { return localStorage.getItem(etqChaveDv) === '1'; } catch (e) { return false; } };
const etqSalvarDv = (v) => { try { localStorage.setItem(etqChaveDv, v ? '1' : '0'); } catch (e) { /* vale só nesta sessão */ } };
const etqData = (iso) => { try { return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso || ''; } };
const etqToast = (m) => { if (window.toast) window.toast(m); };

/* Pré-visualização: SVG em mm do próprio modelo, com os mesmos dados que vão para a impressora. */
function EtqPreview({ modelo, dados, lista, largura, colunas, espaco, nota, girar }) {
  const { pronto, erro } = useEtqBwip();
  const cols = colunas || 1;
  const html = React.useMemo(() => (modelo && dados ? ETQ_CALC().renderSVGLinha(modelo, (lista && lista.length ? lista.slice(0, cols) : Array.from({ length: cols }, () => dados)), { barcode: pronto ? etqBarcode : null, colunas: cols, espaco, fluido: true, moldura: cols > 1, girar: modelo.girar ? etqLerGirar() : undefined }) : ''), [modelo, dados, lista, pronto, cols, espaco, girar]);
  if (!modelo || !dados) return <div style={{ color: 'var(--fg3)', fontSize: 13 }}>Selecione algo para ver a etiqueta.</div>;
  // Mesma proporção do rolo real: a largura da prévia acompanha o formato (rolo alto fica estreito) em vez de esticar.
  const Wtot = cols * modelo.largura_mm + (cols - 1) * (cols > 1 ? Number(espaco) || 0 : 0);
  const larg = largura || Math.min(380, Math.round(420 * Wtot / modelo.altura_mm));
  return (
    <div>
      <div style={{ width: larg, maxWidth: '100%', border: '1px solid var(--line, #ccc)', boxShadow: '0 1px 4px rgba(0,0,0,.12)', background: '#fff' }} dangerouslySetInnerHTML={{ __html: html }}/>
      <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 4 }}>
        {modelo.nome} · etiqueta {modelo.largura_mm} × {modelo.altura_mm} mm{cols > 1 ? ` · ${cols} por linha (rolo de ${Math.round(Wtot * 100) / 100} mm)` : ''} · prévia aproximada (a fonte real é a da impressora)
        {nota ? <div>{nota}</div> : null}
        {erro ? <span style={{ color: 'var(--vp-danger)' }}> · {erro}</span> : null}
      </div>
    </div>
  );
}

/* ---------- Impressora ---------- */
function EtqPainelImpressora({ cfg, setCfg, podeImprimir, aoTestar, ocupado }) {
  const EI = ETQ_IMP();
  const [det, setDet] = React.useState({ impressoras: [], erros: {}, lendo: false, lido: false });
  const detectar = React.useCallback(async () => {
    setDet((d) => ({ ...d, lendo: true }));
    const r = await EI.detectarTodas();
    setDet({ ...r, lendo: false, lido: true });
    // Reconhece sozinha: sem escolha salva, a primeira impressora real detectada vira a escolhida, já com o perfil casado.
    // Escolha AUTOMÁTICA (auto: true) que caiu no navegador porque a impressora ainda não tinha sido detectada vale só até aparecer uma
    // impressora real; escolha feita pela pessoa nunca é trocada sozinha.
    setCfg((atual) => {
      const real = r.impressoras.find((i) => i.adaptador !== 'navegador');
      const ainda = atual && r.impressoras.find((i) => i.adaptador === atual.adaptador && i.id === atual.id);
      const trocarAuto = !!(atual && atual.auto && real && real.adaptador !== atual.adaptador);
      if (!trocarAuto) {
        if (ainda) return { ...atual, bruto: ainda.bruto, nome: ainda.nome };
        if (atual && atual.id) return atual;   // escolha salva que não aparece agora (impressora desligada): mantém, o envio avisa
      }
      const alvo = real || r.impressoras[0];
      const perfil = EI.perfilDaImpressora(alvo);
      return { adaptador: alvo.adaptador, id: alvo.id, nome: alvo.nome, bruto: alvo.bruto, perfilId: perfil.id, utf8: atual ? atual.utf8 !== false : true, rolo: (atual && atual.rolo) || '100x50', auto: true };
    });
  }, []);
  React.useEffect(() => {
    detectar();
    const f = () => { if (document.visibilityState === 'visible') detectar(); };
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [detectar]);

  const opcoes = det.impressoras.slice();
  if (cfg && cfg.id && !opcoes.find((i) => i.adaptador === cfg.adaptador && i.id === cfg.id)) opcoes.unshift({ adaptador: cfg.adaptador, id: cfg.id, nome: cfg.nome + ' (não detectada agora)', bruto: cfg.bruto });
  const perfil = cfg ? EI.perfilPorId(cfg.perfilId) : null;
  const escolher = (valor) => {
    const imp = opcoes.find((i) => i.adaptador + '|' + i.id === valor);
    if (!imp) return;
    const p = EI.perfilDaImpressora(imp);
    setCfg({ ...(cfg || {}), adaptador: imp.adaptador, id: imp.id, nome: imp.nome.replace(' (não detectada agora)', ''), bruto: imp.bruto, perfilId: p.id, utf8: cfg ? cfg.utf8 !== false : true, rolo: (cfg && cfg.rolo) || '100x50', auto: false });
  };
  const usaZpl = cfg && cfg.adaptador === 'zebra-browser-print' && perfil && perfil.implementado;
  const geo = { ...ETQ_CALC().geometriaRolo(cfg, perfil), entrada: etqEntradaRolo(cfg) };
  return (
    <div className="card" style={{ padding: 14, marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontSize: 12, display: 'grid', gap: 3, minWidth: 260 }}>Impressora
          <select className="input" aria-label="Impressora" style={{ width: 'auto', minWidth: 260 }} value={cfg ? cfg.adaptador + '|' + cfg.id : ''} onChange={(e) => escolher(e.target.value)}>
            {opcoes.map((i) => <option key={i.adaptador + '|' + i.id} value={i.adaptador + '|' + i.id}>{i.nome}{i.conexao ? ` — ${i.conexao}` : ''}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, display: 'grid', gap: 3 }}>Perfil
          <select className="input" aria-label="Perfil da impressora" style={{ width: 'auto' }} value={cfg ? cfg.perfilId : ''} onChange={(e) => { EI.lembrarPerfil(cfg, e.target.value); setCfg({ ...cfg, perfilId: e.target.value }); }}>
            {EI.PERFIS.map((p) => <option key={p.id} value={p.id}>{p.marca !== '—' ? p.marca + ' ' : ''}{p.modelo}</option>)}
          </select>
        </label>
        <div style={{ fontSize: 12, display: 'grid', gap: 3 }}>
          <span title="Tamanho de UMA etiqueta. Largura = o lado que passa pela cabeça de impressão; Comprimento = o sentido em que o rolo sai.">Rolo carregado — tamanho da etiqueta (mm)</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <div style={{ display: 'grid', gap: 2 }}>
              <input className="input" type="number" min="10" max="200" step="0.5" aria-label="Largura da etiqueta (mm)" title="Largura (mm)" placeholder="Largura" style={{ width: 84 }}
                value={geo.entrada.largura} onChange={(e) => setCfg({ ...cfg, largura_mm: e.target.value })}/>
              <span style={{ fontSize: 11, color: 'var(--fg3)' }}><b style={{ fontWeight: 600 }}>Largura</b> ↔</span>
            </div>
            <span style={{ paddingTop: 8 }}>×</span>
            <div style={{ display: 'grid', gap: 2 }}>
              <input className="input" type="number" min="10" max="400" step="0.5" aria-label="Comprimento da etiqueta (mm)" title="Altura / comprimento (mm)" placeholder="Altura" style={{ width: 96 }}
                value={geo.entrada.altura} onChange={(e) => setCfg({ ...cfg, altura_mm: e.target.value })}/>
              <span style={{ fontSize: 11, color: 'var(--fg3)' }}><b style={{ fontWeight: 600 }}>Altura</b> / Comprimento ↕</span>
            </div>
            <span style={{ color: 'var(--fg3)', paddingTop: 8 }}>mm</span>
          </div>
        </div>
        <label style={{ fontSize: 12, display: 'grid', gap: 3 }} title="Quantas etiquetas ficam lado a lado no rolo (ex.: 30 × 50 mm, 2 por linha).">Etiquetas por linha
          <input className="input" type="number" min="1" max="6" step="1" aria-label="Etiquetas por linha" style={{ width: 90 }}
            value={geo.entrada.colunas} onChange={(e) => setCfg({ ...cfg, colunas: e.target.value })}/>
        </label>
        <label style={{ fontSize: 12, display: 'grid', gap: 3 }} title="Calibração: se a impressão sai colada à esquerda, aumente este valor. Negativo move para a esquerda. Use a etiqueta de teste para ajustar.">Ajuste → (mm)
          <input className="input" type="number" min="-10" max="10" step="0.5" aria-label="Deslocar para a direita (mm)" style={{ width: 84 }}
            value={geo.entrada.deslX} onChange={(e) => setCfg({ ...cfg, desl_x_mm: e.target.value })}/>
        </label>
        <label style={{ fontSize: 12, display: 'grid', gap: 3 }} title="Calibração: se a impressão sai colada ao topo, aumente este valor. Negativo move para cima. Use a etiqueta de teste para ajustar.">Ajuste ↓ (mm)
          <input className="input" type="number" min="-10" max="10" step="0.5" aria-label="Deslocar para baixo (mm)" style={{ width: 84 }}
            value={geo.entrada.deslY} onChange={(e) => setCfg({ ...cfg, desl_y_mm: e.target.value })}/>
        </label>
        {geo.colunas > 1 ? (
          <label style={{ fontSize: 12, display: 'grid', gap: 3 }} title="Vão entre uma etiqueta e a do lado, medido no rolo.">Espaço entre colunas (mm)
            <input className="input" type="number" min="0" max="20" step="0.5" aria-label="Espaço entre colunas (mm)" style={{ width: 90 }}
              value={geo.entrada.espaco} onChange={(e) => setCfg({ ...cfg, espaco_mm: e.target.value })}/>
          </label>
        ) : null}
        <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center', paddingBottom: 8 }} title="Desligue se a impressora imprimir acento errado: o acento é removido (ç vira c).">
          <input type="checkbox" checked={cfg ? cfg.utf8 !== false : true} onChange={(e) => setCfg({ ...cfg, utf8: e.target.checked })}/>acentos na impressora
        </label>
        <button className="btn btn--sm" onClick={detectar} disabled={det.lendo}>{det.lendo ? 'Procurando…' : 'Detectar de novo'}</button>
        <button className="btn btn--sm" onClick={aoTestar} disabled={!podeImprimir || ocupado || !cfg} title="Imprime uma etiqueta com borda, acentos, QR, código de barras e réguas de 10 e 50 mm">Etiqueta de teste</button>
      </div>
      {geo.erro ? <div style={{ fontSize: 12, color: 'var(--vp-danger)', marginTop: 8 }}>{geo.erro}</div> : null}
      <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 8 }}>
        {usaZpl
          ? <>Imprime direto na impressora (ZPL pelo Zebra Browser Print). </>
          : <>Imprime pelo diálogo do navegador (uma página por etiqueta). Para imprimir direto, instale o Zebra Browser Print e use uma Zebra. </>}
        {perfil ? <>Perfil {perfil.marca} {perfil.modelo}: {perfil.dpi} dpi. {perfil.obs}</> : null}
        {det.erros['zebra-browser-print'] ? <div style={{ color: 'var(--vp-danger)', marginTop: 4 }}>Zebra Browser Print: {det.erros['zebra-browser-print']}</div> : null}
      </div>
    </div>
  );
}

/* ---------- Aba Gerar ---------- */
function EtqGerar({ cfg, caps, imprimir, ocupado }) {
  const C = ETQ_CALC(), S = ETQ_STORE();
  const [segTipo, setSegTipo] = window.useRotaItem('etiquetas', 'gerar');
  const tipo = ETQ_TIPO_SLUG[segTipo] || 'ENDERECO';
  const setTipo = (id, opts) => setSegTipo(ETQ_SLUG_TIPO[id] || 'endereco', opts);
  React.useEffect(() => { if (!ETQ_TIPO_SLUG[segTipo]) setSegTipo('endereco', { replace: true }); }, [segTipo]);
  const [copias, setCopias] = React.useState(1);
  const [usarDv, setUsarDv] = React.useState(etqLerDv());
  const tipoInfo = ETQ_TIPOS.find((t) => t.id === tipo);
  const opcoesModelo = C.modelosDoTipo(tipo);
  const [modeloEscolhido, setModeloEscolhido] = React.useState({});
  const perfil = cfg ? ETQ_IMP().perfilPorId(cfg.perfilId) : null;
  // O modelo se ajusta ao rolo carregado (escala única, centralizado); só não imprime se o rolo é inválido ou não cabe na impressora.
  const geo = C.geometriaRolo(cfg, perfil);
  // Modelo escolhido à mão; senão o que tem exatamente o tamanho da etiqueta carregada (aproveita a etiqueta toda); senão o padrão do tipo.
  const modeloManual = C.modeloPorId(modeloEscolhido[tipo]);
  const modelo = modeloManual && modeloManual.tipo === tipo && modeloManual.ativo !== false ? modeloManual
    : (opcoesModelo.find((m) => Number(m.largura_mm) === geo.largura && Number(m.altura_mm) === geo.altura) || C.modeloPorId(tipoInfo.modelo));
  const avisoRolo = geo.erro;
  const ajuste = modelo ? C.adaptarModelo(modelo, geo.largura, geo.altura) : null;
  const modeloRolo = ajuste ? ajuste.modelo : modelo;
  const notaAjuste = ajuste && ajuste.ajustado
    ? `Modelo desenhado para ${modelo.largura_mm} × ${modelo.altura_mm} mm, ajustado à etiqueta de ${geo.largura} × ${geo.altura} mm (${Math.round(ajuste.escala * 100)}% do tamanho, centralizado).` + (ajuste.escala < 0.6 ? ' Fica bem reduzida: confira se o QR e o código de barras continuam legíveis.' : '') : null;

  /* Endereço */
  const [ends, setEnds] = React.useState(null);
  const [origemEnds, setOrigemEnds] = React.useState('banco');
  const [rua, setRua] = React.useState('todas');
  const [lado, setLado] = React.useState('todos');
  const [busca, setBusca] = React.useState('');
  const [selEnd, setSelEnd] = React.useState(() => new Set());
  React.useEffect(() => { S.listarEnderecos().then((r) => { setEnds(r.enderecos); setOrigemEnds(r.origem); }); }, []);
  const filtrados = React.useMemo(() => (ends || []).filter((e) => {
    if (rua !== 'todas' && (rua === 'EXP' ? e.tipo !== 'expedicao' : String(e.rua) !== rua)) return false;
    if (lado !== 'todos' && e.lado !== lado) return false;
    if (busca && !e.codigo.toLowerCase().includes(busca.trim().toLowerCase())) return false;
    return true;
  }), [ends, rua, lado, busca]);
  const todosMarcados = filtrados.length > 0 && filtrados.every((e) => selEnd.has(e.codigo));
  const alternarTodos = () => setSelEnd((s) => { const n = new Set(s); if (todosMarcados) filtrados.forEach((e) => n.delete(e.codigo)); else filtrados.forEach((e) => n.add(e.codigo)); return n; });
  const alternarUm = (cod) => setSelEnd((s) => { const n = new Set(s); n.has(cod) ? n.delete(cod) : n.add(cod); return n; });

  /* Item */
  const [qItem, setQItem] = React.useState('');
  const [achados, setAchados] = React.useState({ itens: [], erro: null });
  const [selItem, setSelItem] = React.useState(() => new Map());
  React.useEffect(() => {
    const t = setTimeout(() => { S.buscarItens(qItem).then(setAchados); }, 350);
    return () => clearTimeout(t);
  }, [qItem]);
  const alternarItem = (p) => setSelItem((m) => { const n = new Map(m); n.has(p.codigo) ? n.delete(p.codigo) : n.set(p.codigo, p); return n; });

  /* Recebimento: escolhe a P.I., marca os itens, ajusta quantidade e NF */
  const [qPi, setQPi] = React.useState('');
  const [pis, setPis] = React.useState({ pis: [], erro: null });
  const [piSel, setPiSel] = React.useState(null);
  const [recQtd, setRecQtd] = React.useState({});
  const [recSel, setRecSel] = React.useState(() => new Set());
  const [recNf, setRecNf] = React.useState('');
  React.useEffect(() => {
    if (tipo !== 'RECEBIMENTO') return undefined;
    const t = setTimeout(() => { S.listarPIs(qPi).then(setPis); }, 300);
    return () => clearTimeout(t);
  }, [tipo, qPi]);
  const escolherPi = (p) => {
    setPiSel(p); setRecSel(new Set());
    const q = {}; (p.itens || []).forEach((i) => { q[i.codigo_produto] = i.quantidade; }); setRecQtd(q);
  };
  const itensPi = (piSel && piSel.itens || []).filter((i) => i.codigo_produto);
  const recDados = (i) => C.dadosRecebimento({ data: etqHoje(), embarque: piSel.embarque, pi: piSel.numero_pi, fornecedor: piSel.fornecedor, codigo: i.codigo_produto, descricao: i.descricao, quantidade: recQtd[i.codigo_produto], unidade: i.unidade, nf: recNf });

  /* Separação: escolhe o pedido e quantos volumes; imprime 1..N */
  const [qPed, setQPed] = React.useState('');
  const [peds, setPeds] = React.useState({ pedidos: [], erro: null });
  const [pedSel, setPedSel] = React.useState(null);
  const [sepTotal, setSepTotal] = React.useState(1);
  const [sepDe, setSepDe] = React.useState(1);
  const [sepPor, setSepPor] = React.useState('');
  const [sepAguarda, setSepAguarda] = React.useState('');   // etiqueta AGUARDA (pedido parcial); vem da tela Separação
  React.useEffect(() => {
    let pre = null;
    try { pre = JSON.parse(sessionStorage.getItem('vp_etq_prefill') || 'null'); sessionStorage.removeItem('vp_etq_prefill'); } catch (e) { pre = null; }
    if (!pre || pre.tipo !== 'SEPARACAO') return;
    setTipo('SEPARACAO', { replace: true }); setQPed(pre.pedido || ''); setSepAguarda(pre.aguarda || ''); setSepTotal(1); setSepDe(1);
    S.listarPedidos(pre.pedido || '').then((r) => { setPeds(r); const achou = (r.pedidos || []).find((p) => String(p.numero_pedido) === String(pre.pedido)); if (achou) setPedSel(achou); });
  }, []);
  React.useEffect(() => {
    if (tipo !== 'SEPARACAO') return undefined;
    const t = setTimeout(() => { S.listarPedidos(qPed).then(setPeds); }, 300);
    return () => clearTimeout(t);
  }, [tipo, qPed]);
  /* Expedição: escolhe a NF já emitida; o nº de volumes vem da NF (editável) e imprime 1..N */
  const [qNf, setQNf] = React.useState('');
  const [nfs, setNfs] = React.useState({ notas: [], erro: null });
  const [nfSel, setNfSel] = React.useState(null);
  const [expTotal, setExpTotal] = React.useState(1);
  const [expDe, setExpDe] = React.useState(1);
  const [girarSentido, setGirarSentido] = React.useState(etqLerGirar());
  const mudarGirar = (v) => { setGirarSentido(v); try { localStorage.setItem(etqChaveGirar, String(v)); } catch (e) { /* vale só nesta sessão */ } };
  React.useEffect(() => {
    if (tipo !== 'EXPEDICAO') return undefined;
    const t = setTimeout(() => { S.listarNotasFaturadas(qNf).then(setNfs); }, 300);
    return () => clearTimeout(t);
  }, [tipo, qNf]);
  /* Palete: reaproveita a escolha da P.I. e dos itens do Recebimento */
  const [palCod, setPalCod] = React.useState('');
  const palCodigo = (palCod.trim() || (piSel ? `PAL-${piSel.numero_pi}-1` : '')).toUpperCase();
  const palDados = () => C.dadosPalete({ codigo: palCodigo, pi: piSel.numero_pi, embarque: piSel.embarque, data: etqHoje(), itens: itensPi.filter((i) => recSel.has(i.codigo_produto)).map((i) => ({ codigo: i.codigo_produto, quantidade: recQtd[i.codigo_produto], unidade: i.unidade })) });
  /* ID-TAG */
  const [qCot, setQCot] = React.useState('');
  const [obraTag, setObraTag] = React.useState({ obra: null, erro: null, buscou: false });
  const [tagSel, setTagSel] = React.useState(() => new Set());
  const buscarTag = async () => { const r = await S.buscarEquipamentos(qCot.trim()); setObraTag({ ...r, buscou: true }); setTagSel(new Set(r.obra ? r.obra.equipamentos : [])); };
  const tagDados = (cod) => C.dadosIdTag({ codigo: cod, cliente: obraTag.obra.clienteNome, predio: obraTag.obra.predio, cidade: obraTag.obra.cidade, uf: obraTag.obra.uf, cotacao: obraTag.obra.numeroCotacao });
  /* OP / série do quadro */
  const [qOp, setQOp] = React.useState('');
  const [ops, setOps] = React.useState({ ops: [], erro: null });
  const [opSel, setOpSel] = React.useState(null);
  const [opSerie, setOpSerie] = React.useState('');
  React.useEffect(() => {
    if (tipo !== 'OP_QUADRO') return undefined;
    const t = setTimeout(() => { S.listarOPsQuadro(qOp).then(setOps); }, 300);
    return () => clearTimeout(t);
  }, [tipo, qOp]);
  const opDados = () => C.dadosOpQuadro({ numero: opSel.numero, produto: opSel.produto, titulo: opSel.titulo, cliente: opSel.cliente, serie: opSerie, data: etqHoje() });
  /* Chicote do quadro */
  const [qChi, setQChi] = React.useState('');
  const [pedsChi, setPedsChi] = React.useState({ pedidos: [], erro: null });
  // Ordem da lista de pedidos: clicar nas setas do título da coluna (▲ menor→maior, ▼ maior→menor).
  const [chiOrd, setChiOrd] = React.useState({ col: '', dir: 1 });
  const chiValor = (p, col) => col === 'ops' ? (p.ops || []).length : col === 'obra' ? (C.chicoteTipoObra ? C.chicoteTipoObra(p.novo_ou_modernizacao) : '') : col === 'aplic' ? (p.tipo_aplicacao || '') : String(p[col === 'pedido' ? 'numero_pedido' : 'cliente'] == null ? '' : p[col === 'pedido' ? 'numero_pedido' : 'cliente']);
  const chiPedidosOrd = chiOrd.col ? pedsChi.pedidos.slice().sort((a, b) => { const x = chiValor(a, chiOrd.col), y = chiValor(b, chiOrd.col); return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR', { numeric: true, sensitivity: 'base' })) * chiOrd.dir; }) : pedsChi.pedidos;
  const chiTh = (col, rotulo) => (
    <th>{rotulo} <span style={{ whiteSpace: 'nowrap' }}>
      <button type="button" aria-label={`${rotulo}: menor para maior`} title="Menor → maior" onClick={() => setChiOrd({ col, dir: 1 })} style={{ border: 0, background: 'none', cursor: 'pointer', padding: '0 1px', fontSize: 10, color: chiOrd.col === col && chiOrd.dir === 1 ? 'var(--fg1, #000)' : 'var(--fg3)' }}>▲</button>
      <button type="button" aria-label={`${rotulo}: maior para menor`} title="Maior → menor" onClick={() => setChiOrd({ col, dir: -1 })} style={{ border: 0, background: 'none', cursor: 'pointer', padding: '0 1px', fontSize: 10, color: chiOrd.col === col && chiOrd.dir === -1 ? 'var(--fg1, #000)' : 'var(--fg3)' }}>▼</button>
    </span></th>
  );
  const [chiPedSel, setChiPed] = React.useState(null);
  // Pedido avulso: número e cliente digitados à mão (não precisa existir no sistema).
  const [chiManual, setChiManual] = React.useState({ ativo: false, numero: '', cliente: '', obra: '' });
  const chiPed = chiManual.ativo ? { id: 'manual', numero_pedido: chiManual.numero.trim(), cliente: chiManual.cliente.trim(), novo_ou_modernizacao: chiManual.obra, tipo_aplicacao: null, ops: [], manual: true } : chiPedSel;
  const chiPronto = !!(chiPed && String(chiPed.numero_pedido).trim());
  // Chicotes acrescentados à mão (como o DZ): ficam guardados neste navegador.
  const [chiExtras, setChiExtras] = React.useState(() => { try { return JSON.parse(localStorage.getItem('vp_etiquetas_chicotes_extra') || '[]').filter((x) => !C.CHICOTES.some((c) => c.codigo === x.codigo)); } catch (e) { return []; } });
  const [chiNovo, setChiNovo] = React.useState({ codigo: '', descricao: '' });
  const gravarExtras = (l) => { setChiExtras(l); try { localStorage.setItem('vp_etiquetas_chicotes_extra', JSON.stringify(l)); } catch (e) { /* sem armazenamento */ } };
  const addChiExtra = () => {
    const codigo = chiNovo.codigo.trim().toUpperCase().replace(/\s+/g, '');
    if (!codigo || codigo.length > 12) return;
    if (C.CHICOTES.some((c) => c.codigo === codigo) || chiExtras.some((c) => c.codigo === codigo)) { setChiSel((a) => new Set(a).add(codigo)); setChiNovo({ codigo: '', descricao: '' }); return; }
    gravarExtras(chiExtras.concat([{ codigo, descricao: chiNovo.descricao.trim() }]));
    setChiSel((a) => new Set(a).add(codigo)); setChiNovo({ codigo: '', descricao: '' });
  };
  const [chiSel, setChiSel] = React.useState(() => new Set());
  React.useEffect(() => {
    if (tipo !== 'CHICOTE_QUADRO') return undefined;
    const t = setTimeout(() => { S.listarPedidosQuadro(qChi).then(setPedsChi); }, 300);
    return () => clearTimeout(t);
  }, [tipo, qChi]);
  const [chiCasa, setChiCasa] = React.useState(false);
  const [chiPorta, setChiPorta] = React.useState(false);   // porta oposta: acrescenta GS2, EDP2, DC2 e DEN2
  const chiAplic = chiPed ? (chiPed.tipo_aplicacao || (chiCasa ? 'MR' : null)) : null;
  // Todos os chicotes ficam SEMPRE visíveis; marcar/desmarcar só decide quais imprimem (casa de máquinas e porta oposta apenas pré-marcam).
  const chiLista = chiPed ? (chiPed.sem_quadro ? [] : C.CHICOTES).concat(chiExtras.map((c) => ({ ...c, extra: true }))) : [];
  // Cabos do pedido (PCP): cada um com quantas etiquetas imprimir (peças = 1 por peça; cabo por metro = 1).
  const [chiCabos, setChiCabos] = React.useState({ itens: [], erro: null });
  const [caboSel, setCaboSel] = React.useState(() => new Map());
  const escolherPedidoChi = (p) => {
    setChiManual((m) => ({ ...m, ativo: false })); setChiPed(p); setChiCasa(false); setChiPorta(false);
    setChiSel(new Set((p.sem_quadro ? [] : C.CHICOTES.filter((c) => C.chicoteDisponivel(c, p.tipo_aplicacao, false)).map((c) => c.codigo)).concat(chiExtras.map((c) => c.codigo))));
    setChiCabos({ itens: [], erro: null }); setCaboSel(new Map());
    S.listarCabosDoPedido(p.numero_pedido).then((r) => {
      setChiCabos(r);
      setCaboSel(new Map(r.itens.map((i) => [i.codigo, /^(M|MT|METRO)$/i.test(String(i.unidade || '').trim()) ? 1 : Math.max(1, Math.min(99, Math.round(i.quantidade) || 1))])));
    });
  };
  const caboLinhas = () => chiPed ? chiCabos.itens.filter((i) => caboSel.has(i.codigo)).flatMap((i) => Array.from({ length: Math.max(1, Math.min(99, Math.floor(Number(caboSel.get(i.codigo)) || 1))) }, (_, k) => ({ ref: `${i.codigo} ${k + 1}`, dados: C.dadosCaboPedido({ codigo: i.codigo, descricao: i.descricao, quantidade: i.quantidade, unidade: i.unidade, pedido: chiPed.numero_pedido, cliente: chiPed.cliente, op: i.op }) }))) : [];
  const mudarPortaChi = (v) => { setChiPorta(v); setChiSel((a) => { const n = new Set(a); C.CHICOTES.filter((c) => c.soPortaOposta).forEach((c) => { if (v) n.add(c.codigo); else n.delete(c.codigo); }); return n; }); };
  const mudarCasaChi = (v) => { setChiCasa(v); setChiSel((a) => { const n = new Set(a); if (v) n.add('POW1'); else n.delete('POW1'); return n; }); };
  const chiDados = (c) => C.dadosChicote({ chicote: c.codigo, pedido: chiPed.numero_pedido, tipo_obra: chiPed.novo_ou_modernizacao, cliente: chiPed.cliente, op: chiPed.ops && chiPed.ops.length === 1 ? chiPed.ops[0] : '' });
  /* Fabricação (OP do PCP) */
  const [qFab, setQFab] = React.useState('');
  const [opsFab, setOpsFab] = React.useState({ ops: [], erro: null });
  const [fabOp, setFabOp] = React.useState(null);
  const [fabPecas, setFabPecas] = React.useState('1');
  const [fabComp, setFabComp] = React.useState('');
  React.useEffect(() => {
    if (tipo !== 'FABRICACAO_OP') return undefined;
    const t = setTimeout(() => { S.listarOPsFabricacao(qFab).then(setOpsFab); }, 300);
    return () => clearTimeout(t);
  }, [tipo, qFab]);
  const fabMat = fabOp ? ((fabOp.materiais || [])[0] || null) : null;
  const fabN = Math.max(1, Math.min(200, Math.floor(Number(fabPecas) || 1)));
  const fabTotal = fabMat ? Number(fabMat.necessario) || 0 : 0;
  const fabQtd = Number(String(fabComp).replace(',', '.')) > 0 ? Number(String(fabComp).replace(',', '.')) : (fabTotal > 0 ? Math.round((fabTotal / fabN) * 100) / 100 : 0);
  const fabDados = (k) => C.dadosFabricacao({ codigo: fabMat ? fabMat.codigo : fabOp.produto, descricao: fabMat ? fabMat.descricao : (fabOp.titulo || ''), quantidade: fabQtd, unidade: fabMat ? fabMat.unidade : '', op: fabOp.numero, pedido: fabOp.numero_pedido, cliente: fabOp.cliente, peca: k, total_pecas: fabN });
  /* Avaria */
  const [avQtd, setAvQtd] = React.useState('');
  const [avMotivo, setAvMotivo] = React.useState('');
  const avItem = Array.from(selItem.values())[0] || null;
  const avDados = () => C.dadosAvaria({ codigo: avItem.codigo, descricao: avItem.descricao, quantidade: avQtd, unidade: avItem.unidade, motivo: avMotivo, responsavel: (window.__VP_USER && (window.__VP_USER.name || window.__VP_USER.email || '')).split('@')[0], data: etqHoje() });

  const sepN = Math.max(1, Math.min(99, Math.floor(Number(sepTotal) || 1)));
  const sepDados = (v) => C.dadosSeparacao({ pedido: pedSel.numero_pedido, volume: v, total_volumes: sepN, cliente: pedSel.cliente_nome, separador: sepPor, aguarda: sepAguarda, data: etqHoje() });

  const expN = Math.max(1, Math.min(99, Math.floor(Number(expTotal) || 1)));
  const expIni = Math.max(1, Math.min(expN, Math.floor(Number(expDe) || 1)));
  const expDados = (v) => C.dadosExpedicaoVolume({ nf: nfSel.numero_nf, pedido: nfSel.numero_pedido, volume: v, total_volumes: expN, destinatario: nfSel.cliente_nome, transportadora: nfSel.transportadora_nome, endereco: nfSel.cliente_endereco });

  const linhasParaImprimir = () => {
    if (tipo === 'EXPEDICAO') return Array.from({ length: expN - expIni + 1 }, (_, k) => expIni + k).map((v) => ({ ref: `NF ${nfSel.numero_nf} vol ${v}/${expN}`, dados: expDados(v), copias }));
    if (tipo === 'PALETE') return [{ ref: palCodigo, dados: palDados(), copias }];
    if (tipo === 'IDTAG_EQUIPAMENTO') return obraTag.obra.equipamentos.filter((c) => tagSel.has(c)).map((c) => ({ ref: c, dados: tagDados(c), copias }));
    if (tipo === 'OP_QUADRO') return [{ ref: opSel.numero, dados: opDados(), copias }];
    if (tipo === 'CHICOTE_QUADRO') return chiLista.filter((c) => chiSel.has(c.codigo)).map((c) => ({ ref: `${c.codigo} ${chiPed.numero_pedido}`, dados: chiDados(c), copias })).concat(caboLinhas().map((l) => ({ ...l, copias })));
    if (tipo === 'FABRICACAO_OP') return Array.from({ length: fabN }, (_, k) => k + 1).map((k) => ({ ref: fabOp.numero, dados: fabDados(k), copias }));
    if (tipo === 'AVARIA') return [{ ref: avItem.codigo, dados: avDados(), copias }];
    if (tipo === 'RECEBIMENTO') return itensPi.filter((i) => recSel.has(i.codigo_produto)).map((i) => ({ ref: i.codigo_produto, dados: recDados(i), copias }));
    if (tipo === 'SEPARACAO') {
      const ini = Math.max(1, Math.min(sepN, Math.floor(Number(sepDe) || 1)));
      return Array.from({ length: sepN - ini + 1 }, (_, k) => ini + k).map((v) => ({ ref: `${pedSel.numero_pedido} vol ${v}/${sepN}`, dados: sepDados(v), copias }));
    }
    if (tipo === 'ENDERECO') {
      const ordem = (ends || []).filter((e) => selEnd.has(e.codigo));
      return ordem.map((e) => ({ ref: e.codigo, dados: C.dadosEndereco(e.codigo, { dv: usarDv }), copias }));
    }
    return Array.from(selItem.values()).map((p) => ({ ref: p.codigo, dados: C.dadosItem(p), copias }));
  };
  const nSel = tipo === 'PALETE' ? (piSel && recSel.size && palCodigo ? 1 : 0) : tipo === 'IDTAG_EQUIPAMENTO' ? tagSel.size : tipo === 'OP_QUADRO' ? (opSel ? 1 : 0) : tipo === 'CHICOTE_QUADRO' ? (chiPronto ? chiLista.filter((c) => chiSel.has(c.codigo)).length + caboLinhas().length : 0) : tipo === 'FABRICACAO_OP' ? (fabOp && fabMat ? fabN : 0) : tipo === 'AVARIA' ? (avItem && Number(avQtd) > 0 && avMotivo.trim().length >= 3 ? 1 : 0) : tipo === 'RECEBIMENTO' ? recSel.size : tipo === 'SEPARACAO' ? (pedSel ? sepN - Math.max(1, Math.min(sepN, Math.floor(Number(sepDe) || 1))) + 1 : 0) : tipo === 'EXPEDICAO' ? (nfSel ? expN - expIni + 1 : 0) : tipo === 'ENDERECO' ? selEnd.size : selItem.size;
  const primeiraRef = tipo === 'ENDERECO'
    ? (Array.from(selEnd)[0] || (filtrados[0] && filtrados[0].codigo))
    : (Array.from(selItem.keys())[0] || (achados.itens[0] && achados.itens[0].codigo));
  const dadosPrevia = React.useMemo(() => {
    try {
      if (tipo === 'PALETE') return piSel && recSel.size && palCodigo ? palDados() : null;
      if (tipo === 'IDTAG_EQUIPAMENTO') { const c = obraTag.obra && (obraTag.obra.equipamentos.find((x) => tagSel.has(x)) || obraTag.obra.equipamentos[0]); return c ? tagDados(c) : null; }
      if (tipo === 'OP_QUADRO') return opSel ? opDados() : null;
      if (tipo === 'CHICOTE_QUADRO') { const c = chiLista.find((x) => chiSel.has(x.codigo)); if (!chiPronto) return null; if (c) return chiDados(c); const cl = caboLinhas(); return cl[0] ? cl[0].dados : null; }
      if (tipo === 'FABRICACAO_OP') return fabOp && fabMat ? fabDados(1) : null;
      if (tipo === 'AVARIA') return avItem ? avDados() : null;
      if (tipo === 'RECEBIMENTO') { const i = itensPi.find((x) => recSel.has(x.codigo_produto)) || itensPi[0]; return piSel && i ? recDados(i) : null; }
      if (tipo === 'EXPEDICAO') return nfSel ? expDados(expIni) : null;
      if (tipo === 'SEPARACAO') return pedSel ? sepDados(Math.max(1, Math.min(sepN, Math.floor(Number(sepDe) || 1)))) : null;
      if (!primeiraRef) return null;
      if (tipo === 'ENDERECO') return C.dadosEndereco(primeiraRef, { dv: usarDv });
      const p = selItem.get(primeiraRef) || achados.itens.find((x) => x.codigo === primeiraRef);
      return p ? C.dadosItem(p) : null;
    } catch (e) { return null; }
  }, [tipo, primeiraRef, usarDv, selItem, achados, piSel, recSel, recQtd, recNf, pedSel, sepN, sepDe, sepPor, sepAguarda, nfSel, expN, expIni, palCod, obraTag, tagSel, opSel, opSerie, chiPed, chiSel, avQtd, avMotivo]);

  const copiasValidas = Math.max(1, Math.min(50, Math.floor(Number(copias) || 1)));
  // Prévia com várias colunas: cada coluna mostra a PRÓXIMA etiqueta da fila (a impressão também preenche as colunas em sequência),
  // não a mesma etiqueta repetida.
  const listaPrevia = (() => {
    try {
      if (!nSel || geo.colunas < 2) return null;
      const out = [];
      for (const l of linhasParaImprimir()) for (let i = 0; i < copiasValidas && out.length < geo.colunas; i++) out.push(l.dados);
      return out.length ? out : null;
    } catch (e) { return null; }
  })();
  const totalEtiquetas = nSel * copiasValidas;
  const disparar = () => imprimir({ tipo, modeloId: modelo.id, itens: linhasParaImprimir().map((l) => ({ ...l, copias: copiasValidas })), opcoes: { dv: usarDv } });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {ETQ_TIPOS.map((t) => (
          <button key={t.id} className={'btn btn--sm' + (tipo === t.id ? ' btn--primary' : '')} onClick={() => setTipo(t.id)} title={t.desc}>{t.nome}</button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--fg3)', alignSelf: 'center' }}>Os tipos novos de QR (PED, PAL, EQP, OP) estão registrados na issue #862.</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(300px, 1fr)', gap: 16, alignItems: 'start' }}>
        <div>
          {tipo === 'IDTAG_EQUIPAMENTO' ? (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input className="input" placeholder="Nº da cotação (ex.: 985)" value={qCot} onChange={(e) => setQCot(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') buscarTag(); }} style={{ width: 200 }}/>
                <button className="btn btn--sm" onClick={buscarTag} disabled={!(Number(qCot) > 0)}>Buscar equipamentos</button>
              </div>
              {obraTag.erro ? <div style={{ fontSize: 12, color: 'var(--vp-danger)', marginBottom: 6 }}>{obraTag.erro}</div> : null}
              {obraTag.buscou && !obraTag.obra && !obraTag.erro ? <div style={{ fontSize: 12, color: 'var(--fg3)' }}>Nenhuma cotação com esse número.</div> : null}
              {obraTag.obra ? (
                <>
                  <div style={{ fontSize: 12, marginBottom: 6 }}><b style={{ fontWeight: 600 }}>{obraTag.obra.clienteNome || '—'}</b> · {obraTag.obra.predio || '—'} · {obraTag.obra.cidade}/{obraTag.obra.uf}</div>
                  <div className="card table-wrap" style={{ maxHeight: 280, overflow: 'auto' }}>
                    <table className="t pcp-grid">
                      <thead><tr><th style={{ width: 34 }}><input type="checkbox" aria-label="Marcar todos" checked={obraTag.obra.equipamentos.length > 0 && obraTag.obra.equipamentos.every((c) => tagSel.has(c))} onChange={(e) => setTagSel(e.target.checked ? new Set(obraTag.obra.equipamentos) : new Set())}/></th><th>Equipamento</th></tr></thead>
                      <tbody>
                        {obraTag.obra.equipamentos.map((c) => (
                          <tr key={c}><td><input type="checkbox" checked={tagSel.has(c)} onChange={() => setTagSel((s) => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; })}/></td><td><b style={{ fontWeight: 600 }}>{c}</b></td></tr>
                        ))}
                        {!obraTag.obra.equipamentos.length ? <tr><td colSpan={2} style={{ color: 'var(--fg3)' }}>Esta cotação ainda não tem equipamentos com código (Proposta/Precificação).</td></tr> : null}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </>
          ) : tipo === 'OP_QUADRO' ? (
            <>
              <input className="input" placeholder="Buscar OP por número, produto ou cliente…" value={qOp} onChange={(e) => setQOp(e.target.value)} style={{ width: '100%', marginBottom: 8 }}/>
              {ops.erro ? <div style={{ fontSize: 12, color: 'var(--vp-danger)', marginBottom: 6 }}>Não consegui buscar: {ops.erro}</div> : null}
              <div className="card table-wrap" style={{ maxHeight: 240, overflow: 'auto', marginBottom: 10 }}>
                <table className="t pcp-grid">
                  <thead><tr><th>OP</th><th>Produto</th><th>Cliente</th><th>Série (MES)</th></tr></thead>
                  <tbody>
                    {ops.ops.map((o) => (
                      <tr key={o.id} onClick={() => { setOpSel(o); setOpSerie(o.serie || ''); }} style={{ cursor: 'pointer', background: opSel && opSel.id === o.id ? 'var(--vp-yellow-soft, #fff6c2)' : undefined }}>
                        <td><b style={{ fontWeight: 600 }}>{o.numero_pedido ? `${o.numero}-${o.numero_pedido}` : o.numero}</b></td><td>{o.produto || o.titulo || '—'}</td><td>{o.cliente || '—'}</td><td>{o.serie || '—'}</td>
                      </tr>
                    ))}
                    {!ops.ops.length ? <tr><td colSpan={4} style={{ color: 'var(--fg3)' }}>Nenhuma OP de quadro encontrada.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              {opSel ? <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>Nº de série <input className="input" value={opSerie} onChange={(e) => setOpSerie(e.target.value)} style={{ width: 220 }}/><span style={{ color: 'var(--fg3) ' }}>Em branco imprime a linha para escrever à mão. Se a OP já tem série no MES, ela vem preenchida.</span></label> : null}
            </>
          ) : tipo === 'CHICOTE_QUADRO' ? (
            <>
              <div className="card" style={{ padding: 10, marginBottom: 10 }}>
                <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginBottom: chiManual.ativo ? 8 : 0 }}>
                  <input type="checkbox" checked={chiManual.ativo} onChange={(e) => { const ativo = e.target.checked; setChiManual((m) => ({ ...m, ativo })); if (ativo) { setChiCasa(false); setChiPorta(false); setChiCabos({ itens: [], erro: null }); setCaboSel(new Map()); setChiSel(new Set(C.CHICOTES.filter((c) => !c.soCasaMaquinas && !c.soPortaOposta).map((c) => c.codigo).concat(chiExtras.map((c) => c.codigo)))); } }}/>
                  <b style={{ fontWeight: 600 }}>Etiqueta avulsa</b> <span style={{ color: 'var(--fg3)' }}>— digitar o pedido e o cliente à mão (não precisa existir no sistema)</span>
                </label>
                {chiManual.ativo ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ fontSize: 12 }}>Nº do pedido <input className="input" value={chiManual.numero} maxLength={20} onChange={(e) => setChiManual((m) => ({ ...m, numero: e.target.value }))} style={{ width: 130 }}/></label>
                    <label style={{ fontSize: 12 }}>Cliente <input className="input" value={chiManual.cliente} maxLength={60} onChange={(e) => setChiManual((m) => ({ ...m, cliente: e.target.value }))} style={{ width: 260 }}/></label>
                    <label style={{ fontSize: 12 }}>Obra <select className="input" value={chiManual.obra} onChange={(e) => setChiManual((m) => ({ ...m, obra: e.target.value }))}><option value="">—</option><option value="novo">Novo</option><option value="modernizacao">Modernização</option></select></label>
                  </div>
                ) : null}
              </div>
              <input className="input" placeholder="Buscar o pedido do quadro por número ou cliente…" value={qChi} onChange={(e) => setQChi(e.target.value)} style={{ width: '100%', marginBottom: 8 }}/>
              {pedsChi.erro ? <div style={{ fontSize: 12, color: 'var(--vp-danger)', marginBottom: 6 }}>Não consegui buscar: {pedsChi.erro}</div> : null}
              <div className="card table-wrap" style={{ maxHeight: 220, overflow: 'auto', marginBottom: 10 }}>
                <table className="t pcp-grid">
                  <thead><tr>{chiTh('pedido', 'Pedido')}{chiTh('obra', 'Obra')}{chiTh('aplic', 'Aplicação')}{chiTh('cliente', 'Cliente')}{chiTh('ops', 'Quadros (OP)')}</tr></thead>
                  <tbody>
                    {chiPedidosOrd.map((p) => (
                      <tr key={p.id} onClick={() => escolherPedidoChi(p)} style={{ cursor: 'pointer', background: chiPed && chiPed.id === p.id ? 'var(--vp-yellow-soft, #fff6c2)' : undefined }}>
                        <td><b style={{ fontWeight: 600 }}>{p.numero_pedido}</b></td><td>{C.chicoteTipoObra ? C.chicoteTipoObra(p.novo_ou_modernizacao) || '—' : (p.novo_ou_modernizacao || '—')}</td><td>{p.tipo_aplicacao === 'MR' ? 'Com casa de máquinas' : p.tipo_aplicacao === 'MRL' ? 'Sem casa de máquinas' : '—'}</td><td>{p.cliente || '—'}</td><td>{p.ops && p.ops.length ? `${p.ops.length} · ${p.ops.slice(0, 3).join(', ')}${p.ops.length > 3 ? '…' : ''}` : '—'}</td>
                      </tr>
                    ))}
                    {!pedsChi.pedidos.length ? <tr><td colSpan={5} style={{ color: 'var(--fg3)' }}>Nenhum pedido de quadro encontrado. A etiqueta só pode ser criada para um pedido que existe no sistema.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              {chiPed ? (
                <div className="card" style={{ padding: 10 }}>
                  {chiPed.manual && !chiPronto ? <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--vp-danger)' }}>Digite o número do pedido para liberar as etiquetas.</div> : null}
                  {chiPed.sem_quadro ? <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--fg3)' }}>Pedido {chiPed.numero_pedido} sem quadro de comando: só os cabos dele, abaixo.</div> : null}
                  {chiPed.sem_quadro ? null : <div style={{ fontSize: 12, marginBottom: 6 }}><b>Chicotes do pedido {chiPed.numero_pedido}</b> — uma etiqueta por chicote marcado.{chiAplic === 'MR' ? ' Elevador com casa de máquinas: POW1 já vem marcado.' : ' O POW1 só vem marcado em elevador com casa de máquinas; marque se precisar.'}</div>}
                  {!chiPed.tipo_aplicacao && !chiPed.sem_quadro ? <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}><input type="checkbox" checked={chiCasa} onChange={(e) => mudarCasaChi(e.target.checked)}/> Este elevador tem casa de máquinas (inclui o POW1) <span style={{ color: 'var(--fg3)' }}>— o cadastro deste pedido não informa a aplicação</span></label> : null}
                  {!chiPed.sem_quadro ? <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}><input type="checkbox" checked={chiPorta} onChange={(e) => mudarPortaChi(e.target.checked)}/> Este elevador tem porta oposta (inclui GS2, EDP2, DC2 e DEN2)</label> : null}
                  {chiPed.ops && chiPed.ops.length > 1 && !chiPed.sem_quadro ? <div style={{ fontSize: 12, color: 'var(--fg3)', marginBottom: 6 }}>Este pedido tem {chiPed.ops.length} quadros: o jogo de etiquetas é o mesmo para todos. Use <b>Cópias = {chiPed.ops.length}</b> para imprimir um jogo por quadro.</div> : null}
                  {chiPed.sem_quadro ? null : <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setChiSel(new Set(chiLista.map((c) => c.codigo)))}>Marcar todos</button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setChiSel(new Set())}>Limpar</button>
                  </div>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 4 }}>
                    {chiLista.map((c) => (
                      <label key={c.codigo} style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'baseline' }}>
                        <input type="checkbox" checked={chiSel.has(c.codigo)} onChange={(e) => setChiSel((a) => { const n = new Set(a); if (e.target.checked) n.add(c.codigo); else n.delete(c.codigo); return n; })}/>
                        <span><b style={{ fontWeight: 600 }}>{c.codigo}</b> <span style={{ color: 'var(--fg3)' }}>{c.descricao}</span>{c.extra ? <button type="button" className="btn btn--ghost btn--sm" title="Tirar este chicote da lista" onClick={(e) => { e.preventDefault(); gravarExtras(chiExtras.filter((x) => x.codigo !== c.codigo)); setChiSel((s0) => { const n = new Set(s0); n.delete(c.codigo); return n; }); }} style={{ marginLeft: 6 }}>×</button> : null}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                    <span style={{ fontSize: 12 }}><b>Acrescentar chicote:</b></span>
                    <input className="input" placeholder="Código (ex. DZ2)" value={chiNovo.codigo} maxLength={12} onChange={(e) => setChiNovo((n) => ({ ...n, codigo: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') addChiExtra(); }} style={{ width: 130 }}/>
                    <input className="input" placeholder="Descrição (opcional)" value={chiNovo.descricao} maxLength={60} onChange={(e) => setChiNovo((n) => ({ ...n, descricao: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') addChiExtra(); }} style={{ width: 240 }}/>
                    <button type="button" className="btn btn--sm" onClick={addChiExtra} disabled={!chiNovo.codigo.trim()}>Acrescentar</button>
                    <span style={{ fontSize: 11, color: 'var(--fg3)' }}>Fica guardado neste computador para os próximos pedidos.</span>
                  </div>
                  {chiCabos.itens.length ? (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12, marginBottom: 6 }}><b>Cabos do pedido {chiPed.numero_pedido} (PCP)</b> — marque o cabo e diga quantas etiquetas (1 por peça; cabo por metro, 1 por lance).</div>
                      {chiCabos.itens.map((i) => (
                        <label key={i.codigo} style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                          <input type="checkbox" checked={caboSel.has(i.codigo)} onChange={(e) => setCaboSel((m) => { const n = new Map(m); if (e.target.checked) n.set(i.codigo, /^(M|MT|METRO)$/i.test(String(i.unidade || '').trim()) ? 1 : Math.max(1, Math.min(99, Math.round(i.quantidade) || 1))); else n.delete(i.codigo); return n; })}/>
                          <span style={{ flex: 1 }}><b style={{ fontWeight: 600 }}>{i.codigo}</b> <span style={{ color: 'var(--fg3)' }}>{i.descricao}</span> — {C.textoQtdFabricacao(i.quantidade, i.unidade) || i.quantidade}{i.op ? ` · ${i.op}` : ''}</span>
                          {caboSel.has(i.codigo) ? <input className="input" type="number" min="1" max="99" value={caboSel.get(i.codigo)} onChange={(e) => setCaboSel((m) => new Map(m).set(i.codigo, e.target.value))} style={{ width: 64 }} title="Quantas etiquetas"/> : null}
                        </label>
                      ))}
                    </div>
                  ) : chiPed.sem_quadro ? <div style={{ fontSize: 12, color: 'var(--fg3)' }}>Este pedido não tem cabo cadastrado como item do PCP.</div> : null}
                </div>
              ) : null}
            </>
          ) : tipo === 'FABRICACAO_OP' ? (
            <>
              <input className="input" placeholder="Buscar OP por número, código do material, pedido ou cliente…" value={qFab} onChange={(e) => setQFab(e.target.value)} style={{ width: '100%', marginBottom: 8 }}/>
              {opsFab.erro ? <div style={{ fontSize: 12, color: 'var(--vp-danger)', marginBottom: 6 }}>Não consegui buscar: {opsFab.erro}</div> : null}
              <div className="card table-wrap" style={{ maxHeight: 240, overflow: 'auto', marginBottom: 10 }}>
                <table className="t pcp-grid">
                  <thead><tr><th>OP</th><th>Material</th><th>Qtd. total</th><th>Pedido</th><th>Cliente</th><th>Etiqueta</th></tr></thead>
                  <tbody>
                    {opsFab.ops.map((o) => {
                      const m = (o.materiais || [])[0];
                      return (
                        <tr key={o.id} onClick={() => { setFabOp(o); setFabPecas('1'); setFabComp(''); }} style={{ cursor: 'pointer', background: fabOp && fabOp.id === o.id ? 'var(--vp-yellow-soft, #fff6c2)' : undefined }}>
                          <td><b style={{ fontWeight: 600 }}>{o.numero}</b></td><td>{m ? `${m.codigo} — ${m.descricao || ''}` : (o.produto || o.titulo || '—')}</td><td>{m ? C.textoQtdFabricacao(m.necessario, m.unidade) || '—' : '—'}</td><td>{o.numero_pedido || '—'}</td><td>{o.cliente || '—'}</td>
                          <td>{o.etiquetada ? <span style={{ color: 'var(--vp-success, #2e7d32)' }}>✓ impressa {new Date(o.etiquetada).toLocaleDateString('pt-BR')}</span> : <span style={{ color: 'var(--fg3)' }}>ainda não</span>}</td>
                        </tr>
                      );
                    })}
                    {!opsFab.ops.length ? <tr><td colSpan={6} style={{ color: 'var(--fg3)' }}>Nenhuma OP de fabricação aberta no PCP.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              {fabOp ? (
                <div className="card" style={{ padding: 10, fontSize: 12 }}>
                  {!fabMat ? <div style={{ color: 'var(--vp-danger)' }}>Esta OP não tem material cadastrado; não há o que etiquetar.</div> : (
                    <>
                      <div style={{ marginBottom: 6 }}><b>{fabOp.numero}</b> — uma etiqueta por peça. Total da OP: <b>{C.textoQtdFabricacao(fabTotal, fabMat.unidade) || '—'}</b>.</div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        <label>Nº de peças <input className="input" type="number" min="1" max="200" value={fabPecas} onChange={(e) => setFabPecas(e.target.value)} style={{ width: 80 }}/></label>
                        <label>Comprimento/quantidade por peça <input className="input" value={fabComp} placeholder={fabTotal > 0 ? String(Math.round((fabTotal / fabN) * 100) / 100) : ''} onChange={(e) => setFabComp(e.target.value)} style={{ width: 110 }}/></label>
                      </div>
                      <div style={{ color: 'var(--fg3)', marginTop: 6 }}>O PCP guarda só o total da OP; o nº de peças e o tamanho de cada uma você informa aqui. Em branco, o total é dividido igualmente.</div>
                    </>
                  )}
                </div>
              ) : null}
            </>
          ) : tipo === 'AVARIA' ? (
            <>
              <input className="input" placeholder="Buscar produto por código ou descrição (mín. 2 letras)…" value={qItem} onChange={(e) => setQItem(e.target.value)} style={{ width: '100%', marginBottom: 8 }}/>
              <div className="card table-wrap" style={{ maxHeight: 200, overflow: 'auto', marginBottom: 10 }}>
                <table className="t pcp-grid">
                  <thead><tr><th>Código</th><th>Descrição</th><th>Un.</th></tr></thead>
                  <tbody>
                    {achados.itens.map((p) => (
                      <tr key={p.codigo} onClick={() => setSelItem(new Map([[p.codigo, p]]))} style={{ cursor: 'pointer', background: selItem.has(p.codigo) ? 'var(--vp-yellow-soft, #fff6c2)' : undefined }}>
                        <td><b style={{ fontWeight: 600 }}>{p.codigo}</b></td><td>{p.descricao}</td><td>{p.unidade}</td>
                      </tr>
                    ))}
                    {!achados.itens.length ? <tr><td colSpan={3} style={{ color: 'var(--fg3)' }}>{qItem.trim().length < 2 ? 'Digite para buscar.' : 'Nenhum produto ativo encontrado.'}</td></tr> : null}
                  </tbody>
                </table>
              </div>
              {avItem ? (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <label style={{ fontSize: 12, display: 'grid', gap: 3 }}>Quantidade avariada<input className="input" type="number" min="0" value={avQtd} onChange={(e) => setAvQtd(e.target.value)} style={{ width: 120 }}/></label>
                  <label style={{ fontSize: 12, display: 'grid', gap: 3, flex: 1, minWidth: 240 }}>Motivo (obrigatório)<input className="input" value={avMotivo} onChange={(e) => setAvMotivo(e.target.value)} placeholder="ex.: caixa amassada, peça trincada"/></label>
                </div>
              ) : <div style={{ fontSize: 12, color: 'var(--fg3)' }}>Escolha o produto, informe a quantidade e o motivo.</div>}
            </>
          ) : null}
          {tipo === 'RECEBIMENTO' || tipo === 'PALETE' ? (
            <>
              <input className="input" placeholder="Buscar P.I. por número ou fornecedor…" value={qPi} onChange={(e) => setQPi(e.target.value)} style={{ width: '100%', marginBottom: 8 }}/>
              {pis.erro ? <div style={{ fontSize: 12, color: 'var(--vp-danger)', marginBottom: 6 }}>Não consegui buscar: {pis.erro}</div> : null}
              <div className="card table-wrap" style={{ maxHeight: 180, overflow: 'auto', marginBottom: 10 }}>
                <table className="t pcp-grid">
                  <thead><tr><th>P.I.</th><th>Fornecedor</th><th>Embarque</th><th>Itens</th></tr></thead>
                  <tbody>
                    {pis.pis.map((p) => (
                      <tr key={p.id} onClick={() => escolherPi(p)} style={{ cursor: 'pointer', background: piSel && piSel.id === p.id ? 'var(--vp-yellow-soft, #fff6c2)' : undefined }}>
                        <td><b style={{ fontWeight: 600 }}>{p.numero_pi}</b></td><td>{p.fornecedor || '—'}</td><td>{p.embarque || '—'}</td><td>{(p.itens || []).length}</td>
                      </tr>
                    ))}
                    {!pis.pis.length ? <tr><td colSpan={4} style={{ color: 'var(--fg3)' }}>Nenhuma P.I. com itens encontrada.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              {piSel ? (
                <>
                  {tipo === 'RECEBIMENTO' ? (
                    <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>NF de entrada (opcional)
                      <input className="input" value={recNf} onChange={(e) => setRecNf(e.target.value)} style={{ width: 160 }}/>
                    </label>
                  ) : (
                    <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>Código do palete
                      <input className="input" value={palCod} placeholder={`PAL-${piSel.numero_pi}-1`} onChange={(e) => setPalCod(e.target.value)} style={{ width: 220 }}/>
                      <span style={{ color: 'var(--fg3)' }}>1 etiqueta com os itens marcados. Mais de 6 itens: os demais saem como "+N".</span>
                    </label>
                  )}
                  <div className="card table-wrap" style={{ maxHeight: 260, overflow: 'auto' }}>
                    <table className="t pcp-grid">
                      <thead><tr><th style={{ width: 34 }}><input type="checkbox" aria-label="Marcar todos os itens" checked={itensPi.length > 0 && itensPi.every((i) => recSel.has(i.codigo_produto))} onChange={(e) => setRecSel(e.target.checked ? new Set(itensPi.map((i) => i.codigo_produto)) : new Set())}/></th><th>Código</th><th>Descrição</th><th>Qtd. recebida</th></tr></thead>
                      <tbody>
                        {itensPi.map((i) => (
                          <tr key={i.codigo_produto}>
                            <td><input type="checkbox" checked={recSel.has(i.codigo_produto)} onChange={() => setRecSel((s) => { const n = new Set(s); n.has(i.codigo_produto) ? n.delete(i.codigo_produto) : n.add(i.codigo_produto); return n; })}/></td>
                            <td><b style={{ fontWeight: 600 }}>{i.codigo_produto}</b></td><td>{i.descricao}</td>
                            <td><input className="input" type="number" min="0" style={{ width: 90 }} value={recQtd[i.codigo_produto] ?? ''} onChange={(e) => setRecQtd((q) => ({ ...q, [i.codigo_produto]: e.target.value }))}/> {i.unidade || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 6 }}>Itens da P.I. sem código de produto não aparecem. A quantidade vem da P.I.; ajuste para o que de fato chegou.</div>
                </>
              ) : <div style={{ fontSize: 12, color: 'var(--fg3)' }}>Escolha uma P.I. para listar os itens.</div>}
            </>
          ) : tipo === 'EXPEDICAO' ? (
            <>
              <input className="input" placeholder="Buscar NF, pedido ou cliente…" value={qNf} onChange={(e) => setQNf(e.target.value)} style={{ width: '100%', marginBottom: 8 }}/>
              {nfs.erro ? <div style={{ fontSize: 12, color: 'var(--vp-danger)', marginBottom: 6 }}>Não consegui buscar: {nfs.erro}</div> : null}
              <div className="card table-wrap" style={{ maxHeight: 260, overflow: 'auto', marginBottom: 10 }}>
                <table className="t pcp-grid">
                  <thead><tr><th>NF</th><th>Pedido</th><th>Cliente</th><th>Transportadora</th><th>Volumes</th><th>Faturada em</th></tr></thead>
                  <tbody>
                    {nfs.notas.map((n) => (
                      <tr key={n.codigo_pedido} onClick={() => { setNfSel(n); setExpTotal(n.volumes || 1); setExpDe(1); }} style={{ cursor: 'pointer', background: nfSel && nfSel.codigo_pedido === n.codigo_pedido ? 'var(--vp-yellow-soft, #fff6c2)' : undefined }}>
                        <td><b style={{ fontWeight: 600 }}>{n.numero_nf}</b></td><td>{n.numero_pedido}</td><td>{n.cliente_nome || '—'}</td><td>{n.transportadora_nome || '—'}</td><td>{n.volumes ?? '—'}</td><td>{n.data_faturamento ? n.data_faturamento.split('-').reverse().join('/') : '—'}</td>
                      </tr>
                    ))}
                    {!nfs.notas.length ? <tr><td colSpan={6} style={{ color: 'var(--fg3)' }}>Nenhuma NF faturada encontrada.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              {nfSel ? (
                <>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <label style={{ fontSize: 12, display: 'grid', gap: 3 }}>Total de volumes da NF<input className="input" type="number" min="1" max="99" value={expTotal} onChange={(e) => setExpTotal(e.target.value)} style={{ width: 110 }}/></label>
                    <label style={{ fontSize: 12, display: 'grid', gap: 3 }}>Imprimir a partir do volume<input className="input" type="number" min="1" max="99" value={expDe} onChange={(e) => setExpDe(e.target.value)} style={{ width: 110 }}/></label>
                  </div>
                  {!nfSel.volumes ? <div style={{ fontSize: 12, color: 'var(--vp-danger)', marginTop: 6 }}>Esta NF não tem o número de volumes no Omie. Informe o total acima antes de imprimir.</div> : null}
                  {nfSel.volumes && Number(expTotal) !== nfSel.volumes ? <div style={{ fontSize: 12, color: 'var(--vp-danger)', marginTop: 6 }}>Atenção: a NF tem {nfSel.volumes} volume(s) no Omie e você está imprimindo para {expN}.</div> : null}
                </>
              ) : <div style={{ fontSize: 12, color: 'var(--fg3)' }}>Escolha uma NF. O total de volumes vem do Omie e imprime 1/N … N/N.</div>}
              <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 6 }}>Feita para o rolo de 100 × 150 mm (informe-o em "Rolo carregado"). Só NF já emitida aparece aqui (pedido faturado no Omie). O destinatário e o endereço vêm do cadastro do pedido; confira com a NF. Na Zebra (Browser Print) sai direto, como imagem; nas demais, pelo diálogo do navegador.</div>
            </>
          ) : tipo === 'SEPARACAO' ? (
            <>
              <input className="input" placeholder="Buscar pedido por número ou cliente…" value={qPed} onChange={(e) => setQPed(e.target.value)} style={{ width: '100%', marginBottom: 8 }}/>
              {peds.erro ? <div style={{ fontSize: 12, color: 'var(--vp-danger)', marginBottom: 6 }}>Não consegui buscar: {peds.erro}</div> : null}
              <div className="card table-wrap" style={{ maxHeight: 240, overflow: 'auto', marginBottom: 10 }}>
                <table className="t pcp-grid">
                  <thead><tr><th>Pedido</th><th>Cliente</th><th>Etapa</th><th>Volumes</th></tr></thead>
                  <tbody>
                    {peds.pedidos.map((p) => (
                      <tr key={p.numero_pedido} onClick={() => { setPedSel(p); setSepTotal(p.volumes || 1); setSepDe(1); }} style={{ cursor: 'pointer', background: pedSel && pedSel.numero_pedido === p.numero_pedido ? 'var(--vp-yellow-soft, #fff6c2)' : undefined }}>
                        <td><b style={{ fontWeight: 600 }}>{p.numero_pedido}</b></td><td>{p.cliente_nome || '—'}</td><td>{p.etapa}</td><td>{p.volumes ?? '—'}</td>
                      </tr>
                    ))}
                    {!peds.pedidos.length ? <tr><td colSpan={4} style={{ color: 'var(--fg3)' }}>Nenhum pedido encontrado.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              {pedSel ? (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <label style={{ fontSize: 12, display: 'grid', gap: 3 }}>Total de volumes<input className="input" type="number" min="1" max="99" value={sepTotal} onChange={(e) => setSepTotal(e.target.value)} style={{ width: 90 }}/></label>
                  <label style={{ fontSize: 12, display: 'grid', gap: 3 }}>Imprimir a partir do volume<input className="input" type="number" min="1" max="99" value={sepDe} onChange={(e) => setSepDe(e.target.value)} style={{ width: 90 }}/></label>
                  <label style={{ fontSize: 12, display: 'grid', gap: 3 }}>Separado por<input className="input" value={sepPor} onChange={(e) => setSepPor(e.target.value)} style={{ width: 180 }}/></label>
                  <label style={{ fontSize: 12, display: 'grid', gap: 3 }}>Aviso AGUARDA (pedido parcial)<input className="input" value={sepAguarda} placeholder="vazio = etiqueta de volume" maxLength={70} onChange={(e) => setSepAguarda(e.target.value)} style={{ width: 300 }}/></label>
                </div>
              ) : <div style={{ fontSize: 12, color: 'var(--fg3)' }}>Escolha um pedido. Imprime uma etiqueta por volume (1/N … N/N).</div>}
              <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 6 }}>Modelos para etiqueta de 100 × 50, 100 × 100 e 100 × 150 mm (escolhido pelo tamanho da etiqueta carregada). O QR leva "PED:número" — formato novo, ainda a registrar na issue #862 antes de o app de estoque ler.</div>
            </>
          ) : tipo === 'ENDERECO' ? (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
                <select className="input" style={{ width: 'auto', minWidth: 170 }} value={rua} onChange={(e) => setRua(e.target.value)} aria-label="Rua">
                  <option value="todas">Todas as ruas</option>
                  {[1, 2, 3, 4].map((r) => <option key={r} value={String(r)}>Rua {r}</option>)}
                  <option value="EXP">Expedição (EXP)</option>
                </select>
                <select className="input" style={{ width: 'auto', minWidth: 150 }} value={lado} onChange={(e) => setLado(e.target.value)} aria-label="Lado">
                  <option value="todos">Os dois lados</option><option value="esquerda">Esquerda</option><option value="direita">Direita</option>
                </select>
                <input className="input" placeholder="Buscar (ex.: R2A)" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ width: 160 }}/>
                <span style={{ fontSize: 12, color: 'var(--fg3)' }}>{filtrados.length} posição(ões) na lista · {selEnd.size} marcada(s)</span>
              </div>
              {origemEnds === 'regras' ? <div style={{ fontSize: 12, color: 'var(--vp-danger)', marginBottom: 6 }}>Não consegui ler a tabela de endereços do banco; usando a lista oficial das regras (236 posições + EXP).</div> : null}
              <div className="card table-wrap" style={{ maxHeight: 420, overflow: 'auto' }}>
                <table className="t pcp-grid">
                  <thead><tr>
                    <th style={{ width: 34 }}><input type="checkbox" checked={todosMarcados} onChange={alternarTodos} aria-label="Marcar todos da lista"/></th>
                    <th>Endereço</th><th>Rua</th><th>Vão</th><th>Nível</th><th>Lado</th>{usarDv ? <th>DV</th> : null}
                  </tr></thead>
                  <tbody>
                    {ends === null ? <tr><td colSpan={7} style={{ color: 'var(--fg3)' }}>Carregando…</td></tr> : null}
                    {filtrados.map((e) => (
                      <tr key={e.codigo} onClick={() => alternarUm(e.codigo)} style={{ cursor: 'pointer' }}>
                        <td><input type="checkbox" checked={selEnd.has(e.codigo)} onChange={() => alternarUm(e.codigo)} onClick={(ev) => ev.stopPropagation()}/></td>
                        <td><b style={{ fontWeight: 600 }}>{e.codigo}</b></td>
                        <td>{e.rua ?? '—'}</td><td>{e.vao ?? '—'}</td><td>{e.nivel ?? '—'}</td><td>{e.lado ?? '—'}</td>
                        {usarDv ? <td>{C.dvEndereco(e.codigo) ?? '—'}</td> : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
                <input type="checkbox" checked={usarDv} onChange={(e) => { setUsarDv(e.target.checked); etqSalvarDv(e.target.checked); }}/>
                Imprimir o dígito verificador (DV) ao lado do endereço
              </label>
              {usarDv ? <div style={{ fontSize: 11, color: 'var(--vp-danger)', marginLeft: 22 }}>A fórmula do DV (rua×3 + vão×5 + nível×7, resto por 10) é uma proposta ainda não aprovada. Aprove antes de imprimir as 236 etiquetas: trocar a fórmula depois deixa as etiquetas antigas com o DV da regra velha.</div> : null}
            </>
          ) : (
            <>
              <input className="input" placeholder="Buscar produto por código ou descrição (mín. 2 letras)…" value={qItem} onChange={(e) => setQItem(e.target.value)} style={{ width: '100%', marginBottom: 8 }}/>
              {achados.erro ? <div style={{ fontSize: 12, color: 'var(--vp-danger)', marginBottom: 6 }}>Não consegui buscar: {achados.erro}</div> : null}
              <div className="card table-wrap" style={{ maxHeight: 300, overflow: 'auto' }}>
                <table className="t pcp-grid">
                  <thead><tr><th style={{ width: 34 }}></th><th>Código</th><th>Descrição</th><th>Un.</th><th>Endereço</th></tr></thead>
                  <tbody>
                    {achados.itens.map((p) => (
                      <tr key={p.codigo} onClick={() => alternarItem(p)} style={{ cursor: 'pointer' }}>
                        <td><input type="checkbox" checked={selItem.has(p.codigo)} onChange={() => alternarItem(p)} onClick={(ev) => ev.stopPropagation()}/></td>
                        <td><b style={{ fontWeight: 600 }}>{p.codigo}</b></td><td>{p.descricao}</td><td>{p.unidade}</td><td>{p.endereco || '—'}</td>
                      </tr>
                    ))}
                    {!achados.itens.length ? <tr><td colSpan={5} style={{ color: 'var(--fg3)' }}>{qItem.trim().length < 2 ? 'Digite para buscar.' : 'Nenhum produto ativo encontrado.'}</td></tr> : null}
                  </tbody>
                </table>
              </div>
              {selItem.size ? (
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  <b style={{ fontWeight: 600 }}>Para imprimir ({selItem.size}):</b>{' '}
                  {Array.from(selItem.values()).map((p) => (
                    <span key={p.codigo} className="pcp-tag" style={{ marginRight: 4, cursor: 'pointer' }} title="Tirar da lista" onClick={() => alternarItem(p)}>{p.codigo} ✕</span>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>

        <div style={{ position: 'sticky', top: 12 }}>
          {opcoesModelo.length > 1 ? (
            <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>Modelo
              <select className="input" aria-label="Modelo" style={{ width: 'auto' }} value={modelo.id} onChange={(e) => setModeloEscolhido((m) => ({ ...m, [tipo]: e.target.value }))}>
                {opcoesModelo.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.empresa ? ' (da empresa)' : ' (padrão)'} — {m.largura_mm} × {m.altura_mm}</option>)}
              </select>
            </label>
          ) : null}
          {modelo.girar ? (
            <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>Sentido da impressão
              <select className="input" aria-label="Sentido da impressão" style={{ width: 'auto' }} value={girarSentido} onChange={(e) => mudarGirar(Number(e.target.value))}>
                <option value={90}>Topo da etiqueta à direita</option>
                <option value={270}>Topo da etiqueta à esquerda</option>
              </select>
            </label>
          ) : null}
          <EtqPreview modelo={modeloRolo} dados={dadosPrevia} lista={listaPrevia} colunas={geo.colunas} espaco={geo.espaco} nota={notaAjuste} girar={girarSentido}/>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>Cópias de cada
              <input className="input" type="number" min="1" max="50" value={copias} onChange={(e) => setCopias(e.target.value)} style={{ width: 70 }}/>
            </label>
            <button className="btn btn--primary" disabled={!caps.imprimir || ocupado || !nSel || !!avisoRolo || totalEtiquetas > 500}
              title={!caps.imprimir ? 'Você não tem a alçada para imprimir etiquetas.' : undefined} onClick={disparar}>
              {ocupado ? 'Imprimindo…' : `Imprimir ${totalEtiquetas || ''} etiqueta${totalEtiquetas === 1 ? '' : 's'}`.replace('  ', ' ')}
            </button>
          </div>
          {totalEtiquetas > 500 ? <div style={{ fontSize: 12, color: 'var(--vp-danger)', marginTop: 6 }}>Máximo de 500 etiquetas por impressão. Reduza a seleção ou as cópias.</div> : null}
          {avisoRolo ? <div style={{ fontSize: 12, color: 'var(--vp-danger)', marginTop: 6 }}>{avisoRolo}</div> : null}
          {!caps.imprimir ? <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 6 }}>Você pode ver as etiquetas, mas não imprimir: falta a alçada "Imprime etiquetas" (Administração › Alçadas).</div> : null}
          {perfil && !perfil.implementado && cfg && cfg.adaptador === 'zebra-browser-print' ? <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 6 }}>O perfil escolhido ainda não tem ZPL: vai pelo diálogo do navegador.</div> : null}
        </div>
      </div>
    </div>
  );
}

/* ---------- Aba Modelos ---------- */
const etqExemploDe = (m) => {
  const C = ETQ_CALC();
  const t = m.tipo;
  return t === 'ENDERECO' ? C.dadosEndereco('R2A4', { dv: true })
    : t === 'RECEBIMENTO' ? C.dadosRecebimento({ data: '17/10/2026', embarque: '146', pi: 'SCVP260522-2', fornecedor: 'Ningbo Senchen', codigo: 'VPEL-156', descricao: 'Rolete para correia Poly-V 6PK', quantidade: 40, unidade: 'UN', nf: '11082199' })
    : t === 'SEPARACAO' ? C.dadosSeparacao({ pedido: '30570', volume: 2, total_volumes: 5, cliente: 'AKAI KB MAGAZINE', separador: 'Tiago', data: '17/10/2026 14:32' })
    : t === 'EXPEDICAO' ? C.dadosExpedicaoVolume({ nf: '22019', pedido: '28988', volume: 13, total_volumes: 19, destinatario: 'BAR DO CUSCUZ E RESTAURANTE LTDA', transportadora: 'CLIENTE RETIRA', endereco: 'RUA DOUTOR SEVERINO RIBEIRO CRUZ, 771, CENTRO, CAMPINA GRANDE (PB)/PB, 58400258' })
    : t === 'PALETE' ? C.dadosPalete({ codigo: 'PAL-SCVP260522-1', pi: 'SCVP260522-2', embarque: '146', data: '17/10/2026', itens: [{ codigo: 'VPEL-156', quantidade: 40 }, { codigo: 'VPEL-157', quantidade: 12 }] })
    : t === 'IDTAG_EQUIPAMENTO' ? C.dadosIdTag({ codigo: 'VPEL-EL0985-1', cliente: 'AKAI KB MAGAZINE', predio: 'Loja em Shopping', cidade: 'Praia Grande', uf: 'SP', cotacao: 985 })
    : t === 'OP_QUADRO' ? C.dadosOpQuadro({ numero: 'OP-0001', produto: 'VPEL-709b Quadro 30 kW 380 V', cliente: 'VITALTEC', serie: 'QC-2610-0007', data: '17/10/2026' })
    : t === 'CHICOTE_QUADRO' ? C.dadosChicote({ chicote: 'FAN', pedido: '1212', tipo_obra: 'modernizacao', cliente: 'CONCESSIONARIA DO BLOCO SUL S.A.', op: 'OP-0003-Q1' })
    : t === 'FABRICACAO_OP' ? C.dadosFabricacao({ codigo: 'VPEL-692', descricao: 'Cabo de aço 8 mm', quantidade: 12.5, unidade: 'M', op: 'OP-0007-C1', pedido: '30445', cliente: 'MIHL', peca: 1, total_pecas: 4 })
    : t === 'AVARIA' ? C.dadosAvaria({ codigo: 'VPEL-156', descricao: 'Rolete para correia Poly-V 6PK', quantidade: 2, unidade: 'UN', motivo: 'caixa amassada', responsavel: 'tiago', data: '17/10/2026' })
    : t === 'ITEM' ? C.dadosItem({ codigo: 'VPEL-156', descricao: 'Rolete para correia Poly-V 6PK', unidade: 'UN', familia: 'VPEL', endereco: 'R2A4' }) : C.DADOS_TESTE;
};

/* ---------- Editor visual de modelo da empresa ----------
   Arrastar o elemento na prévia ou digitar x/y/w/h (mm). Elementos QR e Code 128 do padrão não podem ser apagados. */
function EtqEditor({ modeloId, caps, aoSair }) {
  const C = ETQ_CALC(), S = ETQ_STORE();
  const original = C.modeloPorId('C:' + modeloId);
  const padrao = original ? C.modeloPorId(original.base_id) : null;
  const [nome, setNome] = React.useState(original ? original.nome : '');
  const [els, setEls] = React.useState(() => original ? JSON.parse(JSON.stringify(original.elementos)) : []);
  const [sel, setSel] = React.useState(0);
  const [salvando, setSalvando] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const areaRef = React.useRef(null);
  const { pronto } = useEtqBwip();
  if (!original || !padrao) return <div><button className="btn btn--sm" onClick={aoSair}>← Modelos</button><p style={{ color: 'var(--fg3)' }}>Modelo não encontrado (pode ter sido apagado).</p></div>;
  const W = original.largura_mm, H = original.altura_mm;
  const dados = etqExemploDe(original);
  const modeloEdit = { ...original, elementos: els };
  const erros = C.validarModelo(modeloEdit, padrao);
  const html = C.renderSVG(modeloEdit, dados, { barcode: pronto ? etqBarcode : null });
  const alturaEl = (el) => (el.tipo === 'qr' ? el.w : el.tipo === 'linha' ? (el.esp || 0.4) + 1 : el.h);
  const protegido = (el) => (el.tipo === 'qr' || el.tipo === 'code128') && padrao.elementos.some((o) => o.tipo === el.tipo && o.campo === el.campo);
  const mexer = (i, patch) => setEls((l) => l.map((e, k) => (k === i ? { ...e, ...patch } : e)));
  const arrastar = (ev, i) => {
    ev.preventDefault(); setSel(i);
    const rect = areaRef.current.getBoundingClientRect();
    const x0 = ev.clientX, y0 = ev.clientY, ex = Number(els[i].x), ey = Number(els[i].y);
    const mover = (e) => {
      const dx = (e.clientX - x0) * (W / rect.width), dy = (e.clientY - y0) * (H / rect.height);
      mexer(i, { x: Math.max(0, Math.round((ex + dx) * 2) / 2), y: Math.max(0, Math.round((ey + dy) * 2) / 2) });
    };
    const soltar = () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); };
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar);
  };
  const nomeEl = (el, i) => `${i + 1}. ${{ texto: 'Texto', qr: 'QR', code128: 'Barras', caixa: 'Borda', linha: 'Linha' }[el.tipo] || el.tipo} ${el.campo || ''}`;
  const adicionar = (tipoEl, campo) => {
    const base = tipoEl === 'texto' ? { tipo: 'texto', campo, x: 4, y: 4, w: 40, h: 4 } : tipoEl === 'linha' ? { tipo: 'linha', x: 4, y: 4, w: 40, esp: 0.4 } : { tipo: tipoEl, campo, x: 4, y: 4, w: 24, h: 8 };
    setEls((l) => [...l, base]); setSel(els.length);
  };
  const salvar = async () => {
    if (nome.trim().length < 3) { setMsg('Dê um nome de pelo menos 3 letras.'); return; }
    if (erros.length) { setMsg('Corrija antes de salvar: ' + erros[0]); return; }
    setSalvando(true);
    const r = await S.salvarModelo(modeloId, { nome: nome.trim(), elementos: els });
    setSalvando(false);
    if (!r.ok) { setMsg(r.erro); return; }
    etqToast('Modelo salvo.'); aoSair(true);
  };
  const e = els[sel];
  const num = (k, passo) => (
    <label style={{ fontSize: 11, display: 'grid', gap: 2 }}>{k}<input className="input" type="number" step={passo || 0.5} value={e[k] ?? ''} onChange={(ev) => mexer(sel, { [k]: ev.target.value === '' ? '' : Number(ev.target.value) })} style={{ width: 80 }}/></label>
  );
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <button className="btn btn--sm" onClick={() => aoSair(false)}>← Modelos</button>
        <input className="input" aria-label="Nome do modelo" value={nome} onChange={(ev) => setNome(ev.target.value)} style={{ width: 280 }} disabled={!caps.editar_modelos}/>
        <span className="pcp-tag">{original.tipo}</span>
        <span style={{ fontSize: 12, color: 'var(--fg3)' }}>{W} × {H} mm · baseado em {padrao.nome}</span>
        <button className="btn btn--primary btn--sm" onClick={salvar} disabled={!caps.editar_modelos || salvando}>{salvando ? 'Salvando…' : 'Salvar modelo'}</button>
      </div>
      {!caps.editar_modelos ? <div style={{ fontSize: 12, color: 'var(--vp-danger)', marginBottom: 8 }}>Você não tem a alçada para editar modelos; só pode ver.</div> : null}
      {msg ? <div style={{ fontSize: 12, color: 'var(--vp-danger)', marginBottom: 8 }}>{msg}</div> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(300px, 1fr)', gap: 16, alignItems: 'start' }}>
        <div>
          <div ref={areaRef} style={{ position: 'relative', width: 560, maxWidth: '100%', border: '1px solid var(--line, #ccc)', background: '#fff', touchAction: 'none' }}>
            <div dangerouslySetInnerHTML={{ __html: html }}/>
            {els.map((el, i) => (el.tipo === 'caixa' ? null : (
              <div key={i} onPointerDown={(ev) => arrastar(ev, i)} title={nomeEl(el, i)}
                style={{ position: 'absolute', left: `${(el.x / W) * 100}%`, top: `${(el.y / H) * 100}%`, width: `${(el.w / W) * 100}%`, height: `${(alturaEl(el) / H) * 100}%`, outline: i === sel ? '2px solid #e6b800' : '1px dashed rgba(0,0,0,.25)', cursor: 'move', background: i === sel ? 'rgba(230,184,0,.12)' : 'transparent' }}/>
            )))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 4 }}>Arraste o elemento na prévia (passo de 0,5 mm) ou digite as medidas ao lado. A fonte real é a da impressora.</div>
        </div>
        <div>
          <div className="card table-wrap" style={{ maxHeight: 190, overflow: 'auto', marginBottom: 8 }}>
            <table className="t pcp-grid"><tbody>
              {els.map((el, i) => (
                <tr key={i} onClick={() => setSel(i)} style={{ cursor: 'pointer', background: i === sel ? 'var(--vp-yellow-soft, #fff6c2)' : undefined }}>
                  <td>{nomeEl(el, i)}{protegido(el) ? ' 🔒' : ''}</td>
                  <td style={{ width: 70 }}><button className="btn btn--sm" disabled={protegido(el)} title={protegido(el) ? 'Elemento obrigatório do tipo: pode mudar de lugar, não ser apagado.' : 'Apagar elemento'} onClick={(ev) => { ev.stopPropagation(); setEls((l) => l.filter((_, k) => k !== i)); setSel(0); }}>Apagar</button></td>
                </tr>
              ))}
            </tbody></table>
          </div>
          {e ? (
            <div className="card" style={{ padding: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {num('x')}{num('y')}{num('w')}
                {e.tipo === 'texto' || e.tipo === 'code128' ? num('h') : null}
                {e.tipo === 'caixa' || e.tipo === 'linha' ? num('esp', 0.1) : null}
                {e.tipo === 'texto' ? num('linhas', 1) : null}
              </div>
              {e.tipo === 'texto' ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <label style={{ fontSize: 11, display: 'grid', gap: 2 }}>Conteúdo (campo {'{nome}'} ou texto fixo)
                    <input className="input" value={e.campo || ''} onChange={(ev) => mexer(sel, { campo: ev.target.value })} style={{ width: 230 }}/>
                  </label>
                  <label style={{ fontSize: 11, display: 'grid', gap: 2 }}>Alinhamento
                    <select className="input" value={e.alinhamento || 'esq'} onChange={(ev) => mexer(sel, { alinhamento: ev.target.value === 'esq' ? undefined : ev.target.value })} style={{ width: 90 }}><option value="esq">Esquerda</option><option value="centro">Centro</option><option value="dir">Direita</option></select>
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--fg3)' }}>Adicionar:</span>
            <button className="btn btn--sm" onClick={() => adicionar('texto', 'Texto fixo')}>Texto fixo</button>
            <button className="btn btn--sm" onClick={() => adicionar('linha')}>Linha</button>
            <select className="input" aria-label="Adicionar campo" style={{ width: 'auto' }} value="" onChange={(ev) => { if (ev.target.value) adicionar('texto', '{' + ev.target.value + '}'); }}>
              <option value="">+ campo do tipo…</option>
              {(original.campos || []).filter((c) => c !== 'qr' && c !== 'barras').map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {erros.length ? <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--vp-danger)' }}>{erros.slice(0, 5).map((m, i) => <li key={i}>{m}</li>)}</ul> : <div style={{ fontSize: 12, color: 'var(--fg3)' }}>✓ Modelo válido.</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Aba Modelos ---------- */
function EtqModelos({ caps, empresa, recarregar }) {
  const C = ETQ_CALC(), S = ETQ_STORE();
  const [editando, setEditando] = window.useRotaItem('etiquetas', 'modelos');
  const [copiando, setCopiando] = React.useState(null);   // { base, nome }
  const [apagando, setApagando] = React.useState(null);
  const [msg, setMsg] = React.useState('');
  const copiar = async () => {
    const r = await S.copiarModelo(copiando.base, copiando.nome);
    if (!r.ok) { setMsg(r.erro); return; }
    setCopiando(null); setMsg('');
    await recarregar();
    setEditando(r.modelo.id);
  };
  if (editando) return <EtqEditor key={editando + (C.modeloPorId('C:' + editando) ? '-ok' : '-esperando')} modeloId={editando} caps={caps} aoSair={async (salvou) => { if (salvou) await recarregar(); setEditando(null); }}/>;
  const card = (m, extra) => (
    <div key={m.id} className="card" style={{ padding: 14, opacity: m.empresa && !m.ativo ? 0.6 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <b style={{ fontWeight: 600 }}>{m.nome}</b><span className="pcp-tag">{m.tipo}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--fg2)', marginBottom: 10 }}>{m.proposito}</div>
      <EtqPreview modelo={m} dados={etqExemploDe(m)} largura={360}/>
      <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 8 }}>Campos: {m.campos.join(', ')}</div>
      {extra}
    </div>
  );
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--fg2)', marginTop: 0 }}>Os modelos padrão não mudam. Para personalizar, copie um modelo: a cópia é da empresa, fica na lista do tipo e pode ser editada, desativada ou apagada. O QR e o código de barras do padrão são obrigatórios (o app de estoque lê esses conteúdos).</p>
      {msg ? <div style={{ fontSize: 12, color: 'var(--vp-danger)', marginBottom: 8 }}>{msg}</div> : null}
      {empresa.length ? (
        <>
          <h3 style={{ fontSize: 14, margin: '8px 0' }}>Modelos da empresa</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16, marginBottom: 20 }}>
            {empresa.map((m) => card(m, (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <button className="btn btn--sm" onClick={() => setEditando(m.uuid)}>{caps.editar_modelos ? 'Editar' : 'Ver'}</button>
                <button className="btn btn--sm" disabled={!caps.editar_modelos} onClick={async () => { const r = await S.salvarModelo(m.uuid, { ativo: !m.ativo }); if (!r.ok) setMsg(r.erro); await recarregar(); }}>{m.ativo ? 'Desativar' : 'Ativar'}</button>
                <button className="btn btn--sm" disabled={!caps.editar_modelos} onClick={() => setCopiando({ base: m, nome: m.nome + ' (cópia)' })}>Copiar</button>
                <button className="btn btn--sm" disabled={!caps.editar_modelos} onClick={() => setApagando(m)}>Apagar</button>
                {!m.ativo ? <span style={{ fontSize: 11, color: 'var(--fg3)', alignSelf: 'center' }}>inativo: não aparece em Gerar</span> : null}
              </div>
            )))}
          </div>
        </>
      ) : null}
      <h3 style={{ fontSize: 14, margin: '8px 0' }}>Modelos padrão</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
        {C.MODELOS.map((m) => card(m, m.tipo === 'TESTE' ? null : (
          <div style={{ marginTop: 8 }}>
            <button className="btn btn--sm" disabled={!caps.editar_modelos || !!m.girar} title={m.girar ? 'Este modelo é girado: ainda não pode ser copiado.' : !caps.editar_modelos ? 'Falta a alçada para criar modelos da empresa.' : 'Cria uma cópia editável'} onClick={() => setCopiando({ base: m, nome: m.nome + ' — da empresa' })}>Copiar e personalizar</button>
          </div>
        )))}
      </div>
      {copiando ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'grid', placeItems: 'center', zIndex: 60 }} onClick={() => setCopiando(null)}>
          <div className="card" style={{ padding: 18, width: 420, background: 'var(--bg, #fff)' }} onClick={(e) => e.stopPropagation()}>
            <b style={{ fontWeight: 600 }}>Copiar "{copiando.base.nome}"</b>
            <label style={{ fontSize: 12, display: 'grid', gap: 3, margin: '10px 0' }}>Nome da cópia
              <input className="input" autoFocus value={copiando.nome} onChange={(e) => setCopiando({ ...copiando, nome: e.target.value })}/>
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn--sm" onClick={() => setCopiando(null)}>Cancelar</button>
              <button className="btn btn--sm btn--primary" disabled={copiando.nome.trim().length < 3} onClick={copiar}>Copiar e editar</button>
            </div>
          </div>
        </div>
      ) : null}
      {apagando ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'grid', placeItems: 'center', zIndex: 60 }} onClick={() => setApagando(null)}>
          <div className="card" style={{ padding: 18, width: 420, background: 'var(--bg, #fff)' }} onClick={(e) => e.stopPropagation()}>
            <b style={{ fontWeight: 600 }}>Apagar "{apagando.nome}"?</b>
            <p style={{ fontSize: 13 }}>O histórico de impressões continua guardado. Reimprimir uma etiqueta antiga feita com este modelo deixará de ser possível.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn--sm" onClick={() => setApagando(null)}>Não apagar</button>
              <button className="btn btn--sm btn--primary" onClick={async () => { const r = await S.excluirModelo(apagando.uuid); if (!r.ok) setMsg(r.erro); setApagando(null); await recarregar(); }}>Sim, apagar</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Aba Histórico ---------- */
function EtqHistorico({ caps, reimprimir, ocupado, versao }) {
  const [estado, setEstado] = React.useState({ linhas: null, erro: null });
  const [motivoDe, setMotivoDe] = React.useState(null);
  const [motivo, setMotivo] = React.useState('');
  React.useEffect(() => { ETQ_STORE().listarHistorico(200).then((r) => setEstado({ linhas: r.linhas, erro: r.erro })); }, [versao]);
  if (estado.erro) return <div className="card" style={{ padding: 14, color: 'var(--vp-danger)' }}>Não consegui ler o histórico: {estado.erro}</div>;
  if (estado.linhas === null) return <div style={{ color: 'var(--fg3)' }}>Carregando…</div>;
  return (
    <div className="card table-wrap" style={{ overflowX: 'auto' }}>
      <table className="t pcp-grid">
        <thead><tr><th>Quando</th><th>Quem</th><th>Tipo</th><th>Referência</th><th>Qtd.</th><th>Impressora</th><th>Resultado</th><th></th></tr></thead>
        <tbody>
          {estado.linhas.map((l) => (
            <React.Fragment key={l.id}>
              <tr>
                <td>{etqData(l.impresso_em)}</td><td>{l.usuario}</td><td>{l.tipo}{l.reimpressao ? <span className="pcp-tag" style={{ marginLeft: 6 }}>reimpressão</span> : null}</td>
                <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.referencia || ''}>{l.referencia || '—'}</td>
                <td>{l.quantidade}</td><td>{l.impressora || '—'}</td>
                <td>{l.sucesso ? 'ok' : <span style={{ color: 'var(--vp-danger)' }} title={l.erro || ''}>falhou</span>}{l.motivo ? <div style={{ fontSize: 10, color: 'var(--fg3)' }}>motivo: {l.motivo}</div> : null}</td>
                <td>{l.sucesso && l.dados && Array.isArray(l.dados.itens) ? <button className="btn btn--sm" disabled={!caps.reimprimir || ocupado} title={!caps.reimprimir ? 'Falta a alçada de reimpressão.' : undefined} onClick={() => { setMotivoDe(l.id); setMotivo(''); }}>Reimprimir</button> : null}</td>
              </tr>
              {motivoDe === l.id ? (
                <tr><td colSpan={8} style={{ background: 'var(--bg2, #f6f6f6)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input className="input" placeholder="Motivo da reimpressão (mín. 5 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ minWidth: 320 }}/>
                    <button className="btn btn--sm btn--primary" disabled={motivo.trim().length < 5 || ocupado} onClick={async () => { const ok = await reimprimir(l, motivo.trim()); if (ok) setMotivoDe(null); }}>Reimprimir agora</button>
                    <button className="btn btn--sm" onClick={() => setMotivoDe(null)}>Cancelar</button>
                  </div>
                </td></tr>
              ) : null}
            </React.Fragment>
          ))}
          {!estado.linhas.length ? <tr><td colSpan={8} style={{ color: 'var(--fg3)' }}>Nenhuma impressão registrada ainda.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Página ---------- */
function EtiquetasPage() {
  const C = ETQ_CALC(), EI = ETQ_IMP(), S = ETQ_STORE();
  const [aba, setAba] = window.useRouteTab('etiquetas', 'gerar', ['gerar', 'modelos', 'historico'], false, true);
  const [caps, setCaps] = React.useState({ carregado: false, ver: false, imprimir: false, reimprimir: false, editar_modelos: false });
  const [empresa, setEmpresa] = React.useState([]);
  const [modVersao, setModVersao] = React.useState(0);
  const [cfg, setCfgEstado] = React.useState(() => EI.lerEscolha());
  const [ocupado, setOcupado] = React.useState(false);
  const [versao, setVersao] = React.useState(0);
  // Configuração do rolo lembrada por tipo de etiqueta (por computador). Mudou o rolo na aba Gerar → grava para o tipo que está aberto;
  // abriu outro tipo que já tem configuração salva → ela volta sozinha (a impressora e o perfil não mudam).
  const [segTipoUrl] = window.useRotaItem('etiquetas', 'gerar');
  const tipoGerar = aba === 'gerar' ? (ETQ_TIPO_SLUG[segTipoUrl] || 'ENDERECO') : null;
  const tipoRef = React.useRef(null);
  tipoRef.current = tipoGerar;
  const [salvos, setSalvos] = React.useState(() => EI.lerPorTipo());
  const setCfg = React.useCallback((v) => {
    setCfgEstado((atual) => {
      const novo = typeof v === 'function' ? v(atual) : v;
      if (novo) {
        EI.salvarEscolha(novo);
        const antes = JSON.stringify(EI.camposRolo(atual)), depois = JSON.stringify(EI.camposRolo(novo));
        if (tipoRef.current && antes !== depois) { EI.gravarPorTipo(tipoRef.current, novo); setTimeout(() => setSalvos(EI.lerPorTipo()), 0); }
      }
      return novo;
    });
  }, []);
  React.useEffect(() => {
    if (!tipoGerar) return;
    const salvo = EI.lerPorTipo()[tipoGerar];
    if (!salvo || !Object.keys(salvo).length) return;
    setCfgEstado((atual) => { const novo = { ...(atual || {}), ...salvo }; EI.salvarEscolha(novo); return novo; });
  }, [tipoGerar]);
  const esquecerTipo = () => { EI.esquecerPorTipo(tipoGerar); setSalvos(EI.lerPorTipo()); etqToast('Configuração deste tipo esquecida (o rolo atual continua até você mudar).'); };

  React.useEffect(() => {
    let vivo = true;
    Promise.all([S.temCapacidade('ver'), S.temCapacidade('imprimir'), S.temCapacidade('reimprimir'), S.temCapacidade('editar_modelos')]).then(([ver, imprimir, reimprimir, editar_modelos]) => {
      if (vivo) setCaps({ carregado: true, ver, imprimir, reimprimir, editar_modelos });
    });
    return () => { vivo = false; };
  }, []);
  const recarregarModelos = React.useCallback(async () => {
    const r = await S.listarModelos();
    C.registrarModelos(r.modelos);
    setEmpresa(C.modelosDaEmpresa());
    setModVersao((v) => v + 1);
  }, []);
  React.useEffect(() => { recarregarModelos(); }, []);

  /* Envia as etiquetas e registra no histórico. Devolve true se saiu. */
  const executar = React.useCallback(async ({ tipo, modeloId, itens, opcoes, reimpressao, motivo }) => {
    const modeloBase = C.modeloPorId(modeloId);
    if (!modeloBase) { etqToast('Modelo de etiqueta desconhecido.'); return false; }
    const escolha = cfg || { adaptador: 'navegador', id: 'navegador', nome: EI.NAVEGADOR.nome, perfilId: 'generica', utf8: true, rolo: '100x50' };
    const perfil = EI.perfilPorId(escolha.perfilId) || EI.perfilPorId('generica');
    const geo = C.geometriaRolo(escolha, perfil);
    if (!geo.ok) { etqToast(geo.erro); return false; }
    // O modelo se ajusta ao rolo carregado. A etiqueta de teste nunca é ampliada (as réguas continuam valendo 10 e 50 mm).
    const ajuste = C.adaptarModelo(modeloBase, geo.largura, geo.altura, { ampliar: tipo !== 'TESTE' });
    const modelo = ajuste.modelo;
    const viaZpl = escolha.adaptador === 'zebra-browser-print' && perfil.implementado;   // modelo girado vai como imagem (ver abaixo)
    const total = itens.reduce((n, it) => n + it.copias, 0);
    setOcupado(true);
    let erro = null, avisos = [];
    if (ajuste.ajustado && ajuste.escala < 0.6) avisos.push(`Modelo reduzido a ${Math.round(ajuste.escala * 100)}% para caber em ${geo.largura} × ${geo.altura} mm`);
    try {
      const imp = { adaptador: escolha.adaptador, id: escolha.id, nome: escolha.nome, bruto: escolha.bruto };
      if (viaZpl && modelo.girar) {
        // Modelo girado: gera as mesmas páginas do navegador, rasteriza no tamanho em pontos da impressora e envia como imagem.
        await etqCarregarBwip();
        const lista = [];
        itens.forEach((it) => { for (let i = 0; i < it.copias; i++) lista.push(it.dados); });
        const W = C.mmParaDots(geo.larguraTotal, perfil.dpi), H = C.mmParaDots(geo.altura, perfil.dpi);
        const grupos = [];
        for (let i = 0; i < lista.length; i += geo.colunas) {
          const svg = C.renderSVGLinha(modelo, lista.slice(i, i + geo.colunas), { barcode: etqBarcode, colunas: geo.colunas, espaco: geo.espaco, desl_x_mm: geo.deslX, desl_y_mm: geo.deslY, girar: etqLerGirar() });
          const ult = grupos[grupos.length - 1];
          if (ult && ult.svg === svg) ult.n += 1; else grupos.push({ svg, n: 1 });
        }
        const blocos = [];
        for (const g of grupos) {
          const r = await etqRasterizar(g.svg, W, H);
          blocos.push(C.renderZPLImagem(r.bits, r.largura, r.altura, { copias: g.n }));
        }
        for (const lote of etqLotes(blocos)) await EI.enviarBrowserPrint(imp, lote.join('\n'));
      } else if (viaZpl) {
        let blocos;
        if (geo.colunas > 1) {
          const r = C.renderZPLLinhas(modelo, itens, { dpi: perfil.dpi, utf8: escolha.utf8 !== false, colunas: geo.colunas, espaco: geo.espaco, desl_x_mm: geo.deslX, desl_y_mm: geo.deslY });
          avisos.push(...r.avisos); blocos = r.blocos;
        } else {
          blocos = itens.map((it) => { const r = C.renderZPL(modelo, it.dados, { dpi: perfil.dpi, utf8: escolha.utf8 !== false, copias: it.copias, desl_x_mm: geo.deslX, desl_y_mm: geo.deslY }); avisos.push(...r.avisos); return r.zpl; });
        }
        for (const lote of etqLotes(blocos)) await EI.enviarBrowserPrint(imp, lote.join('\n'));   // lotes de até 100 etiquetas / 1,5 MB (limite de 2 MB do Browser Print)
      } else {
        await etqCarregarBwip();
        const lista = [];
        itens.forEach((it) => { for (let i = 0; i < it.copias; i++) lista.push(it.dados); });
        const paginas = [];
        for (let i = 0; i < lista.length; i += geo.colunas) paginas.push(C.renderSVGLinha(modelo, lista.slice(i, i + geo.colunas), { barcode: etqBarcode, colunas: geo.colunas, espaco: geo.espaco, desl_x_mm: geo.deslX, desl_y_mm: geo.deslY, girar: modelo.girar ? etqLerGirar() : undefined }));
        await EI.imprimirNavegador(C.htmlImpressao(paginas, geo.larguraTotal, geo.altura));
      }
    } catch (e) { erro = e.message || String(e); }
    const ref = itens.length === 1 ? itens[0].ref : `${itens[0] && itens[0].ref} … ${itens[itens.length - 1] && itens[itens.length - 1].ref} (${itens.length} códigos)`;
    const reg = await S.registrarImpressao({
      tipo, modelo: modeloId, referencia: ref, quantidade: total, impressora: escolha.nome, adaptador: viaZpl ? (modelo.girar ? 'zebra-browser-print/imagem' : 'zebra-browser-print/zpl') : 'navegador',
      dados: { itens: itens.map((it) => ({ ref: it.ref, dados: it.dados, copias: it.copias })), opcoes: opcoes || {}, avisos, rolo: { largura_mm: geo.largura, altura_mm: geo.altura, colunas: geo.colunas, espaco_mm: geo.espaco, desl_x_mm: geo.deslX, desl_y_mm: geo.deslY } },
      sucesso: !erro, erro, reimpressao: !!reimpressao, motivo,
    });
    setOcupado(false);
    if (erro) { etqToast('Não imprimiu: ' + erro); }
    else {
      etqToast(`${total} etiqueta${total === 1 ? '' : 's'} enviada${total === 1 ? '' : 's'}` + (viaZpl ? ' à impressora.' : ' ao diálogo de impressão.') + (avisos.length ? ` Atenção: ${avisos[0]}` : ''));
      if (!reg.ok) etqToast('A impressão saiu, mas não consegui gravar no histórico: ' + reg.erro);
    }
    setVersao((v) => v + 1);
    return !erro;
  }, [cfg]);

  const testar = () => executar({ tipo: 'TESTE', modeloId: 'TESTE_100x50', itens: [{ ref: 'teste', dados: C.DADOS_TESTE, copias: 1 }] });
  const reimprimir = (linha, motivo) => executar({
    tipo: linha.tipo, modeloId: linha.modelo, itens: linha.dados.itens.map((it) => ({ ref: it.ref, dados: it.dados, copias: it.copias })),
    opcoes: linha.dados.opcoes, reimpressao: true, motivo,
  });

  if (caps.carregado && !caps.ver) {
    return (
      <div className="page fade-in">
        <div className="page-head"><div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística Interna · Etiquetas</div>
          <h1 className="page-head__title">Etiquetas</h1>
          <p className="page-head__sub">Você não tem acesso a esta tela. Peça ao gestor a alçada "Vê a tela de Etiquetas" em Administração › Alçadas.</p>
        </div></div>
      </div>
    );
  }
  const abas = [['gerar', 'Gerar'], ['modelos', 'Modelos'], ['historico', 'Histórico']];
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Logística Interna · Etiquetas</div>
          <h1 className="page-head__title">Etiquetas</h1>
          <p className="page-head__sub">Gera e imprime as etiquetas do almoxarifado (endereço e item). Escolha a impressora, marque o que imprimir e confira a prévia.</p>
        </div>
      </div>
      <EtqPainelImpressora cfg={cfg} setCfg={setCfg} podeImprimir={caps.imprimir} aoTestar={testar} ocupado={ocupado}/>
      {tipoGerar ? (
        <div style={{ fontSize: 12, color: 'var(--fg3)', margin: '-6px 0 12px' }}>
          {salvos[tipoGerar] && Object.keys(salvos[tipoGerar]).length
            ? <>💾 Rolo e ajuste de posição lembrados para <b>{(ETQ_TIPOS.find((t) => t.id === tipoGerar) || {}).nome}</b> neste computador — ao mudar acima, a configuração deste tipo é atualizada. <button type="button" className="btn btn--ghost btn--sm" onClick={esquecerTipo}>Esquecer</button></>
            : <>Ao ajustar o rolo ou a posição, a configuração fica salva para <b>{(ETQ_TIPOS.find((t) => t.id === tipoGerar) || {}).nome}</b> neste computador.</>}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {abas.map(([id, nome]) => <button key={id} className={'btn btn--sm' + (aba === id ? ' btn--primary' : '')} onClick={() => setAba(id)}>{nome}</button>)}
      </div>
      {aba === 'gerar' ? <EtqGerar key={modVersao} cfg={cfg} caps={caps} ocupado={ocupado} imprimir={executar}/> : null}
      {aba === 'modelos' ? <EtqModelos caps={caps} empresa={empresa} recarregar={recarregarModelos}/> : null}
      {aba === 'historico' ? <EtqHistorico caps={caps} reimprimir={reimprimir} ocupado={ocupado} versao={versao}/> : null}
    </div>
  );
}

Object.assign(window, { EtiquetasPage });
