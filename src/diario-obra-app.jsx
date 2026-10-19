/* ============================================================
   diario-obra-app.jsx — página pública do Diário de Obra (04/09)
   Rota: /diario-obra/<token> (server.js entrega diario-obra.html, token
   lido do path aqui). Sem SSO — link fixo, mandado ao Montador junto
   com o contrato. Qualquer um com o link VÊ o status; só quem preenche
   consegue FLEGAR (com foto obrigatória) — nunca desmarcar. Desmarcar é
   ação exclusiva do operador, de dentro do sistema (Dossiê da Obra →
   aba Acompanhamento de Obra).
   ============================================================ */
(function () {
  'use strict';

  function tokenDoPath() {
    const m = window.location.pathname.match(/\/diario-obra\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function fmtDataHora(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR') + ', ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  /* ---- Foto só da câmera (19/10/2026): já apareceram obras com foto de outra obra.
     Camada 2: captura dentro da página (getUserMedia → canvas), sem caminho para arquivo guardado.
     Camada 3 (fallback do <input capture>): confere a data do EXIF — foto antiga/sem data é recusada. */
  const TOLERANCIA_FOTO_MIN = 10;

  let _geoCache = null;
  function obterLocalizacao() {
    if (_geoCache && Date.now() - _geoCache.t < 60000) return Promise.resolve(_geoCache.v);
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => { const v = { lat: p.coords.latitude, lng: p.coords.longitude, precisao_m: Math.round(p.coords.accuracy) }; _geoCache = { t: Date.now(), v }; resolve(v); },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
      );
    });
  }

  // Data/hora local gravada pela câmera (EXIF DateTimeOriginal); null se o arquivo não tiver.
  // Lê a tag 0x9003 (DateTimeOriginal) do bloco Exif do JPEG — não qualquer data solta no arquivo,
  // senão imagem antiga reexportada (com DateTime recente) passaria pela conferência.
  function lerExifTiff(dv, base) {
    const little = dv.getUint16(base) === 0x4949;
    const u16 = (o) => dv.getUint16(o, little);
    const u32 = (o) => dv.getUint32(o, little);
    if (u16(base + 2) !== 42) return null;
    const achar = (ifd, tag) => {
      const n = u16(ifd);
      for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (u16(e) === tag) return { tipo: u16(e + 2), cont: u32(e + 4), val: e + 8 }; }
      return null;
    };
    const ptr = achar(base + u32(base + 4), 0x8769);
    if (!ptr) return null;
    const t = achar(base + u32(ptr.val), 0x9003);
    if (!t || t.tipo !== 2 || t.cont < 19) return null;
    const o = base + u32(t.val);
    let s = ''; for (let i = 0; i < 19; i++) s += String.fromCharCode(dv.getUint8(o + i));
    const m = s.match(/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)$/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
  }
  async function lerDataExif(file) {
    try {
      const dv = new DataView(await file.slice(0, 262144).arrayBuffer());
      if (dv.getUint16(0) !== 0xFFD8) return null;
      let off = 2;
      while (off + 10 < dv.byteLength) {
        if (dv.getUint8(off) !== 0xFF) return null;
        const marker = dv.getUint8(off + 1);
        if (marker === 0xDA) return null;
        if (marker === 0xE1 && dv.getUint32(off + 4) === 0x45786966 && dv.getUint16(off + 8) === 0) return lerExifTiff(dv, off + 10);
        off += 2 + dv.getUint16(off + 2);
      }
      return null;
    } catch (e) { return null; }
  }

  function CameraCaptura({ qtd, onFoto, onConcluir, onIndisponivel }) {
    const videoRef = React.useRef(null);
    const streamRef = React.useRef(null);
    const [pronto, setPronto] = React.useState(false);
    React.useEffect(() => {
      let vivo = true;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { onIndisponivel(); return undefined; }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false })
        .then((stream) => {
          if (!vivo) { stream.getTracks().forEach((t) => t.stop()); return; }
          streamRef.current = stream;
          const v = videoRef.current;
          if (v) { v.srcObject = stream; v.play().then(() => { if (vivo) setPronto(true); }).catch(() => { if (vivo) onIndisponivel(); }); }
        })
        .catch(() => { if (vivo) onIndisponivel(); });
      return () => { vivo = false; if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop()); };
    }, []);
    const capturar = () => {
      const v = videoRef.current;
      if (!v || !v.videoWidth) return;
      const c = document.createElement('canvas');
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0);
      c.toBlob((blob) => { if (blob) onFoto(blob); }, 'image/jpeg', 0.85);
    };
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
        <video ref={videoRef} playsInline muted style={{ flex: 1, width: '100%', objectFit: 'cover', minHeight: 0 }} />
        <div style={{ padding: 14, display: 'flex', gap: 10, alignItems: 'center', background: '#111' }}>
          <button type="button" onClick={onConcluir}
            style={{ flex: 1, background: '#333', color: '#fff', border: 'none', borderRadius: 8, padding: 14, fontSize: 14 }}>Concluir{qtd ? ` (${qtd})` : ''}</button>
          <button type="button" onClick={capturar} disabled={!pronto}
            style={{ flex: 2, background: '#22c55e', color: '#04240f', border: 'none', borderRadius: 8, padding: 14, fontSize: 15, fontWeight: 800, opacity: pronto ? 1 : 0.5 }}>📷 Tirar foto</button>
        </div>
      </div>
    );
  }

  function fmtDia(iso) { return iso ? iso.split('-').reverse().join('/') : '—'; }

  function ItemLinha({ item, status, selecionado, fotos, observacao, enviando, dataConclusao, dataMinima, dataMaxima, onToggle, onAbrirCamera, onObservacao, onData }) {
    const flegado = status && status.flegado;
    return (
      <div style={{
        border: '1px solid ' + (flegado ? '#10b981' : selecionado ? '#0066cc' : '#ddd'),
        background: flegado ? '#f0fdf4' : selecionado ? '#f0f8ff' : '#fff',
        borderRadius: 8, padding: 12, marginBottom: 8,
      }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: flegado ? 'default' : 'pointer' }}>
          <input type="checkbox" checked={!!flegado || selecionado} disabled={!!flegado || enviando}
            onChange={() => onToggle(item.id)} style={{ marginTop: 3, width: 18, height: 18 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{item.texto}</div>
            {flegado && (
              <div style={{ fontSize: 11.5, color: '#0a7a3d', marginTop: 2 }}>
                ✓ {status.concluido_em ? `Concluído em ${fmtDia(status.concluido_em)} · enviado ${fmtDataHora(status.flegado_em)}` : `Feito em ${fmtDataHora(status.flegado_em)}`}
              </div>
            )}
            {flegado && status.fotos && status.fotos.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {status.fotos.map((url, i) => <img key={i} src={url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4 }} />)}
              </div>
            )}
            {flegado && status.observacao && (
              <div style={{ fontSize: 12, color: '#555', marginTop: 6 }}>📝 {status.observacao}</div>
            )}
            {!flegado && selecionado && (
              <div style={{ marginTop: 8 }}>
                <button type="button" disabled={enviando} onClick={() => onAbrirCamera(item.id)}
                  style={{ fontSize: 12, color: '#0066cc', background: '#fff', border: '1px solid #0066cc', borderRadius: 6, padding: '6px 10px', display: 'inline-block', cursor: 'pointer' }}>
                  📷 {fotos.length > 0 ? `${fotos.length} foto(s) — tirar outra` : 'Tirar foto (obrigatório)'}
                </button>
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Só vale foto tirada agora pela câmera.</div>
                <label style={{ display: 'block', marginTop: 8, fontSize: 12, color: '#444' }}>
                  Dia em que concluiu esta etapa
                  <input type="date" value={dataConclusao} disabled={enviando}
                    min={dataMinima} max={dataMaxima}
                    onChange={(e) => onData(item.id, e.target.value)}
                    style={{ display: 'block', marginTop: 4, fontSize: 14, padding: 6, border: '1px solid #ddd', borderRadius: 6 }} />
                </label>
                {fotos.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {fotos.map((f, i) => <img key={i} src={f.preview} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4 }} />)}
                  </div>
                )}
                <textarea
                  value={observacao}
                  onChange={(e) => onObservacao(item.id, e.target.value)}
                  disabled={enviando}
                  placeholder="Observação (opcional) — descreva se teve alguma dificuldade nessa tarefa"
                  rows={2}
                  style={{ marginTop: 8, width: '100%', fontSize: 13, padding: 8, border: '1px solid #ddd', borderRadius: 6, resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            )}
          </div>
        </label>
      </div>
    );
  }

  function DiarioObraApp() {
    const [token] = React.useState(tokenDoPath);
    const [estado, setEstado] = React.useState(undefined);
    const [selecionados, setSelecionados] = React.useState({});
    const [fotos, setFotos] = React.useState({});
    const [observacoes, setObservacoes] = React.useState({});
    const [enviando, setEnviando] = React.useState(false);
    const [datas, setDatas] = React.useState({});
    const [cameraItem, setCameraItem] = React.useState(null);
    const fallbackInput = React.useRef(null);
    const fallbackItem = React.useRef(null);
    const [fallbackPendente, setFallbackPendente] = React.useState(null);

    const carregar = React.useCallback(() => {
      if (!token || !window.AcompanhamentoObraStore) return;
      window.AcompanhamentoObraStore.obterEstadoPorToken(token).then(setEstado).catch(() => setEstado(null));
    }, [token]);
    React.useEffect(() => { carregar(); }, [carregar]);

    if (!token) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Link inválido.</div>;
    if (estado === undefined) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Carregando…</div>;
    if (estado === null) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Link não encontrado ou expirado.</div>;

    const hoje = window.AcompanhamentoObraStore.hojeSP();
    const dataMinima = new Date(Date.parse(hoje + 'T00:00:00Z') - window.AcompanhamentoObraStore.CONCLUIDO_EM_JANELA_DIAS * 864e5).toISOString().slice(0, 10);
    const statusPorItem = {};
    (estado.status || []).forEach((s) => { statusPorItem[s.item_id] = s; });
    const itens = (estado.status || [])
      .map((s) => s.acompanhamento_obra_itens)
      .filter(Boolean)
      .sort((a, b) => a.ordem - b.ordem);
    const total = itens.length;
    const feitos = (estado.status || []).filter((s) => s.flegado).length;
    // Mesma conta ponderada do sistema (resumoProgresso) para o montador e o operador verem o mesmo número.
    const pct = total ? window.AcompanhamentoObraStore.resumoProgresso(estado.status || []).pct : 0;

    const toggle = (itemId) => {
      setSelecionados((p) => { const n = { ...p }; if (n[itemId]) delete n[itemId]; else n[itemId] = true; return n; });
      setDatas((p) => (p[itemId] ? p : { ...p, [itemId]: hoje }));
    };

    const aparelho = () => (navigator.userAgent || '').slice(0, 140);
    const addFoto = (itemId, entrada) => setFotos((p) => ({ ...p, [itemId]: [...(p[itemId] || []), entrada] }));

    // Foto tirada pela câmera da própria página (camada 2).
    const onCapturada = async (itemId, blob) => {
      const geo = await obterLocalizacao();
      const file = new File([blob], 'camera.jpg', { type: 'image/jpeg' });
      addFoto(itemId, {
        file, preview: URL.createObjectURL(blob),
        meta: { origem: 'camera', capturado_em: new Date().toISOString(), aparelho: aparelho(), lat: geo ? geo.lat : null, lng: geo ? geo.lng : null, precisao_m: geo ? geo.precisao_m : null },
      });
    };

    // Plano B quando a câmera da página não abre: abre o seletor com capture e confere a data do EXIF (camada 3).
    const abrirCamera = (itemId) => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) setCameraItem(itemId);
      else usarFallback(itemId);
    };
    const usarFallback = (itemId) => {
      setCameraItem(null); setFallbackPendente(null);
      fallbackItem.current = itemId;
      if (fallbackInput.current) { fallbackInput.current.value = ''; fallbackInput.current.click(); }
    };
    // A câmera da página falhou depois do toque original: o seletor só abre com um novo toque do usuário.
    const camaraFalhou = (itemId) => { setCameraItem(null); setFallbackPendente(itemId); };
    const onFallbackArquivos = async (e) => {
      const itemId = fallbackItem.current;
      const files = Array.from(e.target.files || []);
      if (!itemId || !files.length) return;
      const geo = await obterLocalizacao();
      const recusadas = [];
      for (const f of files) {
        const quando = await lerDataExif(f);
        const idadeMin = quando ? Math.abs(Date.now() - quando.getTime()) / 60000 : null;
        if (idadeMin === null || idadeMin > TOLERANCIA_FOTO_MIN) { recusadas.push(f.name); continue; }
        addFoto(itemId, {
          file: f, preview: URL.createObjectURL(f),
          meta: { origem: 'camera-exif', capturado_em: quando.toISOString(), aparelho: aparelho(), lat: geo ? geo.lat : null, lng: geo ? geo.lng : null, precisao_m: geo ? geo.precisao_m : null },
        });
      }
      if (recusadas.length) window.alert('Foto não aceita: só vale foto tirada agora, pela câmera. Não é possível enviar imagem da galeria.\n\nRecusadas: ' + recusadas.join(', '));
    };

    const onObservacao = (itemId, texto) => {
      setObservacoes((p) => ({ ...p, [itemId]: texto }));
    };

    const enviar = async () => {
      const idsSelecionados = Object.keys(selecionados);
      if (!idsSelecionados.length) { window.alert('Marque ao menos 1 atividade feita hoje.'); return; }
      const semFoto = idsSelecionados.find((id) => !(fotos[id] || []).length);
      if (semFoto) { window.alert('Toda atividade marcada precisa de pelo menos 1 foto.'); return; }

      setEnviando(true);
      try {
        const itensHoje = [];
        for (const itemId of idsSelecionados) {
          const urls = []; const fotosMeta = [];
          for (const f of fotos[itemId]) {
            const url = await window.AcompanhamentoObraStore.uploadFoto(estado.link.dossier_id, itemId, f.file);
            urls.push(url); fotosMeta.push({ url, ...(f.meta || {}) });
          }
          itensHoje.push({ item_id: itemId, fotos: urls, fotos_meta: fotosMeta, concluido_em: datas[itemId] || hoje, observacao: (observacoes[itemId] || '').trim() || null });
        }
        await window.AcompanhamentoObraStore.registrarLancamento(estado.link.dossier_id, itensHoje, null);
        window.alert('Enviado! Obrigado — até amanhã.');
        setSelecionados({}); setFotos({}); setObservacoes({}); setDatas({});
        carregar();
      } catch (e) {
        window.alert('Erro ao enviar: ' + e.message);
      } finally {
        setEnviando(false);
      }
    };

    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 14px 90px', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif' }}>
        <div style={{ background: '#0b1220', color: '#fff', borderRadius: 10, padding: '18px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Diário de Obra</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{estado.dossier?.building_name || estado.dossier?.client_name || '—'}</div>
          {(estado.equipamentos || []).length > 0 && (
            <div style={{ marginTop: 8, display: 'inline-block', background: '#22c55e', color: '#04240f', fontWeight: 800, fontSize: 14, padding: '5px 12px', borderRadius: 6 }}>
              Nº do Equipamento: {estado.equipamentos.map((e) => e.numero_serie || '—').join(' + ')}
            </div>
          )}
          <div style={{ marginTop: 10, background: 'rgba(255,255,255,.15)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ background: '#22c55e', height: '100%', width: pct + '%' }} />
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>{feitos}/{total} atividades feitas</div>
        </div>

        <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
          Marque o que você fez <b>hoje</b> e anexe uma foto de cada item. O que já está feito fica travado — só o pessoal da VerticalParts consegue desmarcar.
        </div>

        {itens.map((item) => (
          <ItemLinha key={item.id} item={item} status={statusPorItem[item.id]}
            selecionado={!!selecionados[item.id]} fotos={fotos[item.id] || []} observacao={observacoes[item.id] || ''} enviando={enviando}
            dataConclusao={datas[item.id] || hoje} dataMinima={dataMinima} dataMaxima={hoje}
            onData={(id, v) => setDatas((p) => ({ ...p, [id]: v }))}
            onToggle={toggle} onAbrirCamera={abrirCamera} onObservacao={onObservacao} />
        ))}

        <input ref={fallbackInput} type="file" accept="image/*" capture="environment" multiple hidden onChange={onFallbackArquivos} />
        {cameraItem && (
          <CameraCaptura qtd={(fotos[cameraItem] || []).length}
            onFoto={(blob) => onCapturada(cameraItem, blob)}
            onConcluir={() => setCameraItem(null)}
            onIndisponivel={() => camaraFalhou(cameraItem)} />
        )}
        {fallbackPendente && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 10, padding: 18, maxWidth: 360, textAlign: 'center' }}>
              <div style={{ fontSize: 14, marginBottom: 12 }}>A câmera não abriu dentro da página. Use a câmera do aparelho — só vale foto tirada agora.</div>
              <button type="button" onClick={() => usarFallback(fallbackPendente)}
                style={{ width: '100%', background: '#0066cc', color: '#fff', border: 'none', borderRadius: 8, padding: 12, fontSize: 15, fontWeight: 700 }}>📷 Abrir câmera do aparelho</button>
              <button type="button" onClick={() => setFallbackPendente(null)}
                style={{ marginTop: 8, background: 'none', border: 'none', color: '#666', fontSize: 13 }}>Cancelar</button>
            </div>
          </div>
        )}

        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: '1px solid #ddd', padding: 12 }}>
          <button onClick={enviar} disabled={enviando || !Object.keys(selecionados).length}
            style={{ width: '100%', maxWidth: 480, margin: '0 auto', display: 'block', background: '#0066cc', color: '#fff', border: 'none', borderRadius: 8, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: enviando ? 0.6 : 1 }}>
            {enviando ? 'Enviando…' : `Enviar (${Object.keys(selecionados).length})`}
          </button>
        </div>
      </div>
    );
  }

  const root = ReactDOM.createRoot(document.getElementById('do-root'));
  root.render(<DiarioObraApp />);
}());
