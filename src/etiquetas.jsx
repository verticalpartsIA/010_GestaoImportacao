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
   - Aba e etiqueta em edição ficam na URL (useRouteTab): /logistica/etiquetas/gerar | modelos | historico.
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
  { id: 'SEPARACAO', nome: 'Separação', modelo: 'SEPARACAO_100x100', desc: 'Volume n/N de um pedido de venda (rolo 100 × 100)' },
  { id: 'PALETE', nome: 'Palete', modelo: 'PALETE_100x50', desc: 'Palete inteiro: código, P.I. e itens com quantidade' },
  { id: 'IDTAG_EQUIPAMENTO', nome: 'ID-TAG', modelo: 'IDTAG_100x50', desc: 'Identifica cada elevador (VPEL-EL0985-1…)' },
  { id: 'OP_QUADRO', nome: 'OP / série do quadro', modelo: 'OP_QUADRO_100x50', desc: 'OP do PCP e nº de série do quadro de comando' },
  { id: 'AVARIA', nome: 'Avaria', modelo: 'AVARIA_100x50', desc: 'Material danificado, retido' },
];
const etqHoje = () => new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const ETQ_ROLOS = ['100x50', '100x100'];
const etqChaveDv = 'vp_etiquetas_dv';
const etqLerDv = () => { try { return localStorage.getItem(etqChaveDv) === '1'; } catch (e) { return false; } };
const etqSalvarDv = (v) => { try { localStorage.setItem(etqChaveDv, v ? '1' : '0'); } catch (e) { /* vale só nesta sessão */ } };
const etqData = (iso) => { try { return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso || ''; } };
const etqToast = (m) => { if (window.toast) window.toast(m); };

/* Pré-visualização: SVG em mm do próprio modelo, com os mesmos dados que vão para a impressora. */
function EtqPreview({ modelo, dados, largura }) {
  const { pronto, erro } = useEtqBwip();
  const html = React.useMemo(() => (modelo && dados ? ETQ_CALC().renderSVG(modelo, dados, { barcode: pronto ? etqBarcode : null }) : ''), [modelo, dados, pronto]);
  if (!modelo || !dados) return <div style={{ color: 'var(--fg3)', fontSize: 13 }}>Selecione algo para ver a etiqueta.</div>;
  return (
    <div>
      <div style={{ width: largura || 380, maxWidth: '100%', border: '1px solid var(--line, #ccc)', boxShadow: '0 1px 4px rgba(0,0,0,.12)', background: '#fff' }} dangerouslySetInnerHTML={{ __html: html }}/>
      <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 4 }}>
        {modelo.nome} · {modelo.largura_mm} × {modelo.altura_mm} mm · prévia aproximada (a fonte real é a da impressora)
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
      const perfil = EI.casarPerfil(alvo);
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
    const p = EI.casarPerfil(imp);
    setCfg({ ...(cfg || {}), adaptador: imp.adaptador, id: imp.id, nome: imp.nome.replace(' (não detectada agora)', ''), bruto: imp.bruto, perfilId: p.id, utf8: cfg ? cfg.utf8 !== false : true, rolo: (cfg && cfg.rolo) || '100x50', auto: false });
  };
  const usaZpl = cfg && cfg.adaptador === 'zebra-browser-print' && perfil && perfil.implementado;
  return (
    <div className="card" style={{ padding: 14, marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontSize: 12, display: 'grid', gap: 3, minWidth: 260 }}>Impressora
          <select className="input" aria-label="Impressora" style={{ width: 'auto', minWidth: 260 }} value={cfg ? cfg.adaptador + '|' + cfg.id : ''} onChange={(e) => escolher(e.target.value)}>
            {opcoes.map((i) => <option key={i.adaptador + '|' + i.id} value={i.adaptador + '|' + i.id}>{i.nome}{i.conexao ? ` — ${i.conexao}` : ''}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, display: 'grid', gap: 3 }}>Perfil
          <select className="input" aria-label="Perfil da impressora" style={{ width: 'auto' }} value={cfg ? cfg.perfilId : ''} onChange={(e) => setCfg({ ...cfg, perfilId: e.target.value })}>
            {EI.PERFIS.map((p) => <option key={p.id} value={p.id}>{p.marca !== '—' ? p.marca + ' ' : ''}{p.modelo}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, display: 'grid', gap: 3 }}>Rolo carregado
          <select className="input" aria-label="Rolo carregado" style={{ width: 'auto' }} value={cfg ? cfg.rolo : '100x50'} onChange={(e) => setCfg({ ...cfg, rolo: e.target.value })}>
            {ETQ_ROLOS.map((r) => <option key={r} value={r}>{r.replace('x', ' × ')} mm</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center', paddingBottom: 8 }} title="Desligue se a impressora imprimir acento errado: o acento é removido (ç vira c).">
          <input type="checkbox" checked={cfg ? cfg.utf8 !== false : true} onChange={(e) => setCfg({ ...cfg, utf8: e.target.checked })}/>acentos na impressora
        </label>
        <button className="btn btn--sm" onClick={detectar} disabled={det.lendo}>{det.lendo ? 'Procurando…' : 'Detectar de novo'}</button>
        <button className="btn btn--sm" onClick={aoTestar} disabled={!podeImprimir || ocupado || !cfg} title="Imprime uma etiqueta com borda, acentos, QR, código de barras e réguas de 10 e 50 mm">Etiqueta de teste</button>
      </div>
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
  const [tipo, setTipo] = React.useState('ENDERECO');
  const [copias, setCopias] = React.useState(1);
  const [usarDv, setUsarDv] = React.useState(etqLerDv());
  const tipoInfo = ETQ_TIPOS.find((t) => t.id === tipo);
  const modelo = C.modeloPorId(tipoInfo.modelo);
  const perfil = cfg ? ETQ_IMP().perfilPorId(cfg.perfilId) : null;
  const avisoRolo = cfg && modelo && cfg.rolo !== `${modelo.largura_mm}x${modelo.altura_mm}`
    ? `O rolo informado (${cfg.rolo.replace('x', ' × ')} mm) não confere com o modelo (${modelo.largura_mm} × ${modelo.altura_mm} mm). Troque o rolo ou ajuste o campo "Rolo carregado".` : null;

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
  React.useEffect(() => {
    if (tipo !== 'SEPARACAO') return undefined;
    const t = setTimeout(() => { S.listarPedidos(qPed).then(setPeds); }, 300);
    return () => clearTimeout(t);
  }, [tipo, qPed]);
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
  /* Avaria */
  const [avQtd, setAvQtd] = React.useState('');
  const [avMotivo, setAvMotivo] = React.useState('');
  const avItem = Array.from(selItem.values())[0] || null;
  const avDados = () => C.dadosAvaria({ codigo: avItem.codigo, descricao: avItem.descricao, quantidade: avQtd, unidade: avItem.unidade, motivo: avMotivo, responsavel: (window.__VP_USER && (window.__VP_USER.name || window.__VP_USER.email || '')).split('@')[0], data: etqHoje() });

  const sepN = Math.max(1, Math.min(99, Math.floor(Number(sepTotal) || 1)));
  const sepDados = (v) => C.dadosSeparacao({ pedido: pedSel.numero_pedido, volume: v, total_volumes: sepN, cliente: pedSel.cliente_nome, separador: sepPor, data: etqHoje() });

  const linhasParaImprimir = () => {
    if (tipo === 'PALETE') return [{ ref: palCodigo, dados: palDados(), copias }];
    if (tipo === 'IDTAG_EQUIPAMENTO') return obraTag.obra.equipamentos.filter((c) => tagSel.has(c)).map((c) => ({ ref: c, dados: tagDados(c), copias }));
    if (tipo === 'OP_QUADRO') return [{ ref: opSel.numero, dados: opDados(), copias }];
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
  const nSel = tipo === 'PALETE' ? (piSel && recSel.size && palCodigo ? 1 : 0) : tipo === 'IDTAG_EQUIPAMENTO' ? tagSel.size : tipo === 'OP_QUADRO' ? (opSel ? 1 : 0) : tipo === 'AVARIA' ? (avItem && Number(avQtd) > 0 && avMotivo.trim().length >= 3 ? 1 : 0) : tipo === 'RECEBIMENTO' ? recSel.size : tipo === 'SEPARACAO' ? (pedSel ? sepN - Math.max(1, Math.min(sepN, Math.floor(Number(sepDe) || 1))) + 1 : 0) : tipo === 'ENDERECO' ? selEnd.size : selItem.size;
  const primeiraRef = tipo === 'ENDERECO'
    ? (Array.from(selEnd)[0] || (filtrados[0] && filtrados[0].codigo))
    : (Array.from(selItem.keys())[0] || (achados.itens[0] && achados.itens[0].codigo));
  const dadosPrevia = React.useMemo(() => {
    try {
      if (tipo === 'PALETE') return piSel && recSel.size && palCodigo ? palDados() : null;
      if (tipo === 'IDTAG_EQUIPAMENTO') { const c = obraTag.obra && (obraTag.obra.equipamentos.find((x) => tagSel.has(x)) || obraTag.obra.equipamentos[0]); return c ? tagDados(c) : null; }
      if (tipo === 'OP_QUADRO') return opSel ? opDados() : null;
      if (tipo === 'AVARIA') return avItem ? avDados() : null;
      if (tipo === 'RECEBIMENTO') { const i = itensPi.find((x) => recSel.has(x.codigo_produto)) || itensPi[0]; return piSel && i ? recDados(i) : null; }
      if (tipo === 'SEPARACAO') return pedSel ? sepDados(Math.max(1, Math.min(sepN, Math.floor(Number(sepDe) || 1)))) : null;
      if (!primeiraRef) return null;
      if (tipo === 'ENDERECO') return C.dadosEndereco(primeiraRef, { dv: usarDv });
      const p = selItem.get(primeiraRef) || achados.itens.find((x) => x.codigo === primeiraRef);
      return p ? C.dadosItem(p) : null;
    } catch (e) { return null; }
  }, [tipo, primeiraRef, usarDv, selItem, achados, piSel, recSel, recQtd, recNf, pedSel, sepN, sepDe, sepPor, palCod, obraTag, tagSel, opSel, opSerie, avQtd, avMotivo]);

  const copiasValidas = Math.max(1, Math.min(50, Math.floor(Number(copias) || 1)));
  const totalEtiquetas = nSel * copiasValidas;
  const disparar = () => imprimir({ tipo, modeloId: tipoInfo.modelo, itens: linhasParaImprimir().map((l) => ({ ...l, copias: copiasValidas })), opcoes: { dv: usarDv } });

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
                        <td><b style={{ fontWeight: 600 }}>{o.numero}</b></td><td>{o.produto || o.titulo || '—'}</td><td>{o.cliente || '—'}</td><td>{o.serie || '—'}</td>
                      </tr>
                    ))}
                    {!ops.ops.length ? <tr><td colSpan={4} style={{ color: 'var(--fg3)' }}>Nenhuma OP de quadro encontrada.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              {opSel ? <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>Nº de série <input className="input" value={opSerie} onChange={(e) => setOpSerie(e.target.value)} style={{ width: 220 }}/><span style={{ color: 'var(--fg3) ' }}>Em branco imprime a linha para escrever à mão. Se a OP já tem série no MES, ela vem preenchida.</span></label> : null}
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
                </div>
              ) : <div style={{ fontSize: 12, color: 'var(--fg3)' }}>Escolha um pedido. Imprime uma etiqueta por volume (1/N … N/N).</div>}
              <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 6 }}>Rolo de 100 × 100 mm. O QR leva "PED:número" — formato novo, ainda a registrar na issue #862 antes de o app de estoque ler.</div>
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
          <EtqPreview modelo={modelo} dados={dadosPrevia}/>
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
function EtqModelos() {
  const C = ETQ_CALC();
  const exemplo = (m) => (m.tipo === 'ENDERECO' ? C.dadosEndereco('R2A4', { dv: true })
    : m.tipo === 'RECEBIMENTO' ? C.dadosRecebimento({ data: '17/10/2026', embarque: '146', pi: 'SCVP260522-2', fornecedor: 'Ningbo Senchen', codigo: 'VPEL-156', descricao: 'Rolete para correia Poly-V 6PK', quantidade: 40, unidade: 'UN', nf: '11082199' })
    : m.tipo === 'SEPARACAO' ? C.dadosSeparacao({ pedido: '30570', volume: 2, total_volumes: 5, cliente: 'AKAI KB MAGAZINE', separador: 'Tiago', data: '17/10/2026 14:32' })
    : m.tipo === 'PALETE' ? C.dadosPalete({ codigo: 'PAL-SCVP260522-1', pi: 'SCVP260522-2', embarque: '146', data: '17/10/2026', itens: [{ codigo: 'VPEL-156', quantidade: 40 }, { codigo: 'VPEL-157', quantidade: 12 }] })
    : m.tipo === 'IDTAG_EQUIPAMENTO' ? C.dadosIdTag({ codigo: 'VPEL-EL0985-1', cliente: 'AKAI KB MAGAZINE', predio: 'Loja em Shopping', cidade: 'Praia Grande', uf: 'SP', cotacao: 985 })
    : m.tipo === 'OP_QUADRO' ? C.dadosOpQuadro({ numero: 'OP-0001', produto: 'VPEL-709b Quadro 30 kW 380 V', cliente: 'VITALTEC', serie: 'QC-2610-0007', data: '17/10/2026' })
    : m.tipo === 'AVARIA' ? C.dadosAvaria({ codigo: 'VPEL-156', descricao: 'Rolete para correia Poly-V 6PK', quantidade: 2, unidade: 'UN', motivo: 'caixa amassada', responsavel: 'tiago', data: '17/10/2026' })
    : m.tipo === 'ITEM' ? C.dadosItem({ codigo: 'VPEL-156', descricao: 'Rolete para correia Poly-V 6PK', unidade: 'UN', familia: 'VPEL', endereco: 'R2A4' }) : C.DADOS_TESTE);
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--fg2)', marginTop: 0 }}>Modelos padrão (não editáveis). Copiar e personalizar um modelo da empresa chega na fase 3; por ora o layout é o mesmo para qualquer impressora.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
        {C.MODELOS.map((m) => (
          <div key={m.id} className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
              <b style={{ fontWeight: 600 }}>{m.nome}</b><span className="pcp-tag">{m.tipo}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg2)', marginBottom: 10 }}>{m.proposito}</div>
            <EtqPreview modelo={m} dados={exemplo(m)} largura={360}/>
            <div style={{ fontSize: 11, color: 'var(--fg3)', marginTop: 8 }}>Campos: {m.campos.join(', ')}</div>
          </div>
        ))}
      </div>
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
  const [caps, setCaps] = React.useState({ carregado: false, ver: false, imprimir: false, reimprimir: false });
  const [cfg, setCfgEstado] = React.useState(() => EI.lerEscolha());
  const [ocupado, setOcupado] = React.useState(false);
  const [versao, setVersao] = React.useState(0);
  const setCfg = React.useCallback((v) => {
    setCfgEstado((atual) => { const novo = typeof v === 'function' ? v(atual) : v; if (novo) EI.salvarEscolha(novo); return novo; });
  }, []);

  React.useEffect(() => {
    let vivo = true;
    Promise.all([S.temCapacidade('ver'), S.temCapacidade('imprimir'), S.temCapacidade('reimprimir')]).then(([ver, imprimir, reimprimir]) => {
      if (vivo) setCaps({ carregado: true, ver, imprimir, reimprimir });
    });
    return () => { vivo = false; };
  }, []);

  /* Envia as etiquetas e registra no histórico. Devolve true se saiu. */
  const executar = React.useCallback(async ({ tipo, modeloId, itens, opcoes, reimpressao, motivo }) => {
    const modelo = C.modeloPorId(modeloId);
    if (!modelo) { etqToast('Modelo de etiqueta desconhecido.'); return false; }
    const escolha = cfg || { adaptador: 'navegador', id: 'navegador', nome: EI.NAVEGADOR.nome, perfilId: 'generica', utf8: true, rolo: '100x50' };
    if (escolha.rolo !== `${modelo.largura_mm}x${modelo.altura_mm}`) { etqToast(`O rolo informado (${escolha.rolo.replace('x', ' × ')} mm) não confere com o modelo (${modelo.largura_mm} × ${modelo.altura_mm} mm).`); return false; }
    const perfil = EI.perfilPorId(escolha.perfilId) || EI.perfilPorId('generica');
    const viaZpl = escolha.adaptador === 'zebra-browser-print' && perfil.implementado;
    const total = itens.reduce((n, it) => n + it.copias, 0);
    setOcupado(true);
    let erro = null, avisos = [];
    try {
      if (viaZpl) {
        const blocos = itens.map((it) => { const r = C.renderZPL(modelo, it.dados, { dpi: perfil.dpi, utf8: escolha.utf8 !== false, copias: it.copias }); avisos.push(...r.avisos); return r.zpl; });
        const imp = { adaptador: escolha.adaptador, id: escolha.id, nome: escolha.nome, bruto: escolha.bruto };
        for (let i = 0; i < blocos.length; i += 100) await EI.enviarBrowserPrint(imp, blocos.slice(i, i + 100).join('\n'));   // lotes de 100 (limite de 2 MB por envio do Browser Print)
      } else {
        await etqCarregarBwip();
        const paginas = [];
        itens.forEach((it) => { const svg = C.renderSVG(modelo, it.dados, { barcode: etqBarcode }); for (let i = 0; i < it.copias; i++) paginas.push(svg); });
        await EI.imprimirNavegador(C.htmlImpressao(paginas, modelo.largura_mm, modelo.altura_mm));
      }
    } catch (e) { erro = e.message || String(e); }
    const ref = itens.length === 1 ? itens[0].ref : `${itens[0] && itens[0].ref} … ${itens[itens.length - 1] && itens[itens.length - 1].ref} (${itens.length} códigos)`;
    const reg = await S.registrarImpressao({
      tipo, modelo: modeloId, referencia: ref, quantidade: total, impressora: escolha.nome, adaptador: viaZpl ? 'zebra-browser-print/zpl' : 'navegador',
      dados: { itens: itens.map((it) => ({ ref: it.ref, dados: it.dados, copias: it.copias })), opcoes: opcoes || {}, avisos },
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
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {abas.map(([id, nome]) => <button key={id} className={'btn btn--sm' + (aba === id ? ' btn--primary' : '')} onClick={() => setAba(id)}>{nome}</button>)}
      </div>
      {aba === 'gerar' ? <EtqGerar cfg={cfg} caps={caps} ocupado={ocupado} imprimir={executar}/> : null}
      {aba === 'modelos' ? <EtqModelos/> : null}
      {aba === 'historico' ? <EtqHistorico caps={caps} reimprimir={reimprimir} ocupado={ocupado} versao={versao}/> : null}
    </div>
  );
}

Object.assign(window, { EtiquetasPage });
