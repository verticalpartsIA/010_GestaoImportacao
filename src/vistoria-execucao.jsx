/* ============================================================
   vistoria-execucao.jsx
   Portal PÚBLICO de execução de vistoria (Fase 3 de Vistorias de Obras).
   O técnico abre /vistoria/<token> (link mandado pela aba Despachar de
   src/vistorias-envio.jsx), preenche o questionário no celular — com
   foto, assinatura e check-in/checkout por GPS — e ao concluir a
   Atividade vira `concluida`. O resultado agregado (Fase 4) ainda não
   lê essas respostas de volta pra src/vistorias-obras.jsx.

   Sem SSO: token é a única credencial. Reaproveita
   window.VistoriasQuestionariosStore.carregarEstrutura/TIPOS_CAMPO
   (vistorias-questionarios-store.js) — mesma fonte que o builder usa,
   pra nunca divergir do que foi desenhado lá.
   ============================================================ */
const { useState: _veUS, useEffect: _veUE, useRef: _veUR, useMemo: _veUM } = React;

const VE_BUCKET = 'vistorias-anexos';

function veExtractToken() {
  const m = location.pathname.match(/\/vistoria\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function veRespostaPreenchida(tipoCampo, r) {
  if (!r) return false;
  if (tipoCampo === 'multipla_escolha') return Array.isArray(r.valor_lista) && r.valor_lista.length > 0;
  if (tipoCampo === 'foto') return Array.isArray(r.anexos) && r.anexos.length > 0;
  if (tipoCampo === 'assinatura') return !!r.anexo_url;
  return r.valor !== null && r.valor !== undefined && String(r.valor).trim() !== '';
}

function veChave(perguntaId, pav) { return perguntaId + ':' + (pav || 0); }

/* `pav` só importa quando a pergunta-pai também está numa categoria que
   repete por pavimento — nesse caso a condicional é por andar (a
   pergunta do 2º andar só olha a resposta do 2º andar). Se a pergunta-pai
   não tiver resposta nesse `pav` (não repete), cai pro pav 0. */
function vePerguntaVisivel(pergunta, respostas, pav) {
  if (!pergunta.regra_pai_pergunta_id) return true;
  const r = respostas[veChave(pergunta.regra_pai_pergunta_id, pav)] || respostas[veChave(pergunta.regra_pai_pergunta_id, 0)];
  return !!r && r.valor === pergunta.regra_valor_gatilho;
}

async function veUploadArquivo(sb, atividadeId, perguntaId, blob, ext) {
  const path = `${atividadeId}/${perguntaId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await sb.storage.from(VE_BUCKET).upload(path, blob, { upsert: true, contentType: blob.type });
  if (error) throw error;
  const { data } = sb.storage.from(VE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/* ---- Pad de assinatura — canvas com pointer events (mouse + touch) ---- */
function VeAssinaturaPad({ valorAtual, onSalvar, salvando }) {
  const canvasRef = _veUR(null);
  const desenhando = _veUR(false);
  const vazio = _veUR(true);

  const posicao = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const iniciar = (e) => {
    desenhando.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = posicao(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const desenhar = (e) => {
    if (!desenhando.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = posicao(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.stroke();
    vazio.current = false;
  };
  const parar = () => { desenhando.current = false; };

  const limpar = () => {
    const c = canvasRef.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    vazio.current = true;
  };

  const salvar = () => {
    if (vazio.current) return;
    canvasRef.current.toBlob((blob) => onSalvar(blob), 'image/png');
  };

  return (
    <div>
      {valorAtual ? (
        <div className="ve-assinatura-ok">
          <img src={valorAtual} alt="Assinatura salva"/>
          <button type="button" className="ve-btn-ghost" onClick={() => onSalvar(null)}>Assinar de novo</button>
        </div>
      ) : (
        <>
          <canvas ref={canvasRef} width={320} height={140} className="ve-canvas"
            onPointerDown={iniciar} onPointerMove={desenhar} onPointerUp={parar} onPointerLeave={parar}/>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button type="button" className="ve-btn-ghost" onClick={limpar}>Limpar</button>
            <button type="button" className="ve-btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Confirmar assinatura'}</button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---- Anotador — desenha traço livre ou seta sobre uma foto já enviada,
   pra apontar o problema. Achata tudo num PNG novo ao salvar (substitui
   a foto original pela marcada — mantém simples, sem guardar as duas
   versões). ---- */
function VeFotoAnotador({ url, onSalvar, onCancelar, salvando }) {
  const canvasRef = _veUR(null);
  const imgRef = _veUR(null);
  const [ferramenta, setFerramenta] = _veUS('livre');
  const formasRef = _veUR([]);
  const desenhandoRef = _veUR(false);
  const inicioRef = _veUR(null);
  const [pronto, setPronto] = _veUS(false);

  _veUE(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = canvasRef.current;
      const escala = Math.min(1, 340 / img.naturalWidth);
      c.width = img.naturalWidth * escala;
      c.height = img.naturalHeight * escala;
      imgRef.current = img;
      redesenhar();
      setPronto(true);
    };
    img.src = url;
  }, [url]);

  const redesenhar = (extra) => {
    const c = canvasRef.current;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    if (imgRef.current) ctx.drawImage(imgRef.current, 0, 0, c.width, c.height);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    formasRef.current.concat(extra ? [extra] : []).forEach((f) => {
      ctx.beginPath();
      if (f.tipo === 'livre') {
        f.pontos.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
      } else {
        const [x1, y1] = f.de; const [x2, y2] = f.para;
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const ang = Math.atan2(y2 - y1, x2 - x1);
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - 12 * Math.cos(ang - 0.5), y2 - 12 * Math.sin(ang - 0.5));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - 12 * Math.cos(ang + 0.5), y2 - 12 * Math.sin(ang + 0.5));
        ctx.stroke();
      }
    });
  };

  const posicao = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const iniciar = (e) => {
    desenhandoRef.current = true;
    const p = posicao(e);
    inicioRef.current = p;
    if (ferramenta === 'livre') formasRef.current = formasRef.current.concat([{ tipo: 'livre', pontos: [p] }]);
  };
  const mover = (e) => {
    if (!desenhandoRef.current) return;
    const p = posicao(e);
    if (ferramenta === 'livre') {
      formasRef.current[formasRef.current.length - 1].pontos.push(p);
      redesenhar();
    } else {
      redesenhar({ tipo: 'seta', de: inicioRef.current, para: p });
    }
  };
  const soltar = (e) => {
    if (!desenhandoRef.current) return;
    desenhandoRef.current = false;
    if (ferramenta === 'seta') {
      formasRef.current = formasRef.current.concat([{ tipo: 'seta', de: inicioRef.current, para: posicao(e) }]);
      redesenhar();
    }
  };

  const limpar = () => { formasRef.current = []; redesenhar(); };

  const salvar = () => canvasRef.current.toBlob((blob) => onSalvar(blob), 'image/png');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 }}>
      {!pronto && <div style={{ color: '#fff' }}>Carregando…</div>}
      <canvas ref={canvasRef} style={{ maxWidth: '100%', touchAction: 'none', borderRadius: 8, background: '#000' }}
        onPointerDown={iniciar} onPointerMove={mover} onPointerUp={soltar} onPointerLeave={soltar}/>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button type="button" className={'ve-pill' + (ferramenta === 'livre' ? ' is-active' : '')} onClick={() => setFerramenta('livre')}>Traço livre</button>
        <button type="button" className={'ve-pill' + (ferramenta === 'seta' ? ' is-active' : '')} onClick={() => setFerramenta('seta')}>Seta</button>
        <button type="button" className="ve-btn-ghost" style={{ color: '#fff', borderColor: '#fff' }} onClick={limpar}>Limpar marcações</button>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="ve-btn-ghost" style={{ color: '#fff', borderColor: '#fff' }} onClick={onCancelar} disabled={salvando}>Cancelar</button>
        <button type="button" className="ve-btn-primary" onClick={salvar} disabled={salvando || !pronto}>{salvando ? 'Salvando…' : 'Salvar marcação'}</button>
      </div>
    </div>
  );
}

/* ---- Múltiplas fotos por pergunta, cada uma com legenda opcional e
   marcação (VeFotoAnotador). resposta.anexos = [{url, legenda}]. */
function VeFotoMultipla({ pergunta, resposta, onResponder, atividadeId, sb }) {
  const [enviando, setEnviando] = _veUS(false);
  const [anotando, setAnotando] = _veUS(null); // índice da foto sendo marcada
  const anexos = resposta?.anexos || [];

  const salvarAnexos = (novo) => onResponder({ anexos: novo });

  const adicionarFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviando(true);
    try {
      const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const url = await veUploadArquivo(sb, atividadeId, pergunta.id, file, ext);
      salvarAnexos(anexos.concat([{ url, legenda: '' }]));
    } catch (err) { alert('Erro ao enviar a foto: ' + err.message); }
    finally { setEnviando(false); e.target.value = ''; }
  };

  const removerFoto = (i) => salvarAnexos(anexos.filter((_, idx) => idx !== i));
  const mudarLegenda = (i, legenda) => salvarAnexos(anexos.map((a, idx) => (idx === i ? { ...a, legenda } : a)));

  const salvarMarcacao = async (blob) => {
    setEnviando(true);
    try {
      const url = await veUploadArquivo(sb, atividadeId, pergunta.id, blob, 'png');
      salvarAnexos(anexos.map((a, idx) => (idx === anotando ? { ...a, url } : a)));
      setAnotando(null);
    } catch (err) { alert('Erro ao salvar a marcação: ' + err.message); }
    finally { setEnviando(false); }
  };

  return (
    <div>
      {anexos.map((a, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div className="ve-foto-ok">
            <img src={a.url} alt={`Foto ${i + 1}`}/>
          </div>
          <input className="ve-input" style={{ marginTop: 6 }} placeholder="Legenda desta foto (opcional)"
            defaultValue={a.legenda || ''} onBlur={(e) => mudarLegenda(i, e.target.value)}/>
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            <button type="button" className="ve-btn-ghost" onClick={() => setAnotando(i)}>Riscar/marcar foto</button>
            <button type="button" className="ve-btn-ghost" onClick={() => removerFoto(i)}>Remover</button>
          </div>
        </div>
      ))}
      <label className="ve-btn-primary">
        {enviando ? 'Enviando…' : (anexos.length ? 'Adicionar outra foto' : 'Tirar foto')}
        <input type="file" accept="image/*" capture="environment" onChange={adicionarFoto} hidden disabled={enviando}/>
      </label>
      {anotando != null && (
        <VeFotoAnotador url={anexos[anotando].url} salvando={enviando}
          onSalvar={salvarMarcacao} onCancelar={() => setAnotando(null)}/>
      )}
    </div>
  );
}

/* ---- Uma pergunta — escolhe o campo certo pelo tipo_campo ---- */
function VePergunta({ pergunta, resposta, onResponder, atividadeId, sb }) {
  const [enviandoArquivo, setEnviandoArquivo] = _veUS(false);
  const [textoLocal, setTextoLocal] = _veUS(resposta?.valor ?? '');

  _veUE(() => { setTextoLocal(resposta?.valor ?? ''); }, [pergunta.id]);

  if (pergunta.tipo_campo === 'informativa') {
    return (
      <div className="ve-pergunta ve-pergunta--info">
        <p>{pergunta.texto}</p>
      </div>
    );
  }

  const salvarTexto = () => onResponder({ valor: textoLocal });

  const salvarAssinatura = async (blobOuNull) => {
    if (!blobOuNull) { onResponder({ anexo_url: null }); return; }
    setEnviandoArquivo(true);
    try {
      const url = await veUploadArquivo(sb, atividadeId, pergunta.id, blobOuNull, 'png');
      onResponder({ anexo_url: url });
    } catch (err) { alert('Erro ao salvar a assinatura: ' + err.message); }
    finally { setEnviandoArquivo(false); }
  };

  return (
    <div className="ve-pergunta">
      <div className="ve-pergunta__texto">{pergunta.texto}{pergunta.obrigatoria ? <span className="ve-obrig">*</span> : null}</div>

      {(pergunta.tipo_campo === 'texto') && (
        <input className="ve-input" value={textoLocal} onChange={(e) => setTextoLocal(e.target.value)} onBlur={salvarTexto} placeholder="Escreva aqui…"/>
      )}
      {(pergunta.tipo_campo === 'numerico') && (
        <input className="ve-input" type="number" inputMode="decimal" value={textoLocal} onChange={(e) => setTextoLocal(e.target.value)} onBlur={salvarTexto} placeholder="0"/>
      )}
      {(pergunta.tipo_campo === 'data') && (
        <input className="ve-input" type="date" value={textoLocal} onChange={(e) => { setTextoLocal(e.target.value); onResponder({ valor: e.target.value }); }}/>
      )}

      {(pergunta.tipo_campo === 'sim_nao') && (
        <div className="ve-pills">
          {['Sim', 'Não'].map((op) => (
            <button key={op} type="button" className={'ve-pill' + (resposta?.valor === op ? ' is-active' : '')}
              onClick={() => onResponder({ valor: op })}>{op}</button>
          ))}
        </div>
      )}

      {(pergunta.tipo_campo === 'selecao_unica') && (
        <div className="ve-pills">
          {(pergunta.opcoes || []).map((op) => (
            <button key={op} type="button" className={'ve-pill' + (resposta?.valor === op ? ' is-active' : '')}
              onClick={() => onResponder({ valor: op })}>{op}</button>
          ))}
        </div>
      )}

      {(pergunta.tipo_campo === 'multipla_escolha') && (
        <div className="ve-pills">
          {(pergunta.opcoes || []).map((op) => {
            const marcado = (resposta?.valor_lista || []).includes(op);
            return (
              <button key={op} type="button" className={'ve-pill' + (marcado ? ' is-active' : '')}
                onClick={() => {
                  const atual = resposta?.valor_lista || [];
                  const novo = marcado ? atual.filter((v) => v !== op) : [...atual, op];
                  onResponder({ valor_lista: novo });
                }}>{op}</button>
            );
          })}
        </div>
      )}

      {(pergunta.tipo_campo === 'foto') && (
        <VeFotoMultipla pergunta={pergunta} resposta={resposta} onResponder={onResponder} atividadeId={atividadeId} sb={sb}/>
      )}

      {(pergunta.tipo_campo === 'assinatura') && (
        <VeAssinaturaPad valorAtual={resposta?.anexo_url} onSalvar={salvarAssinatura} salvando={enviandoArquivo}/>
      )}

      <label className="ve-pendencia">
        <input type="checkbox" checked={!!resposta?.pendencia} onChange={(e) => onResponder({ pendencia: e.target.checked })}/>
        Marcar como pendência
      </label>
    </div>
  );
}

function VistoriaExecucaoApp() {
  const sb = window.__VP_SB.sb;
  const token = _veUM(veExtractToken, []);
  const [carregando, setCarregando] = _veUS(true);
  const [naoEncontrada, setNaoEncontrada] = _veUS(false);
  const [atividade, setAtividade] = _veUS(null);
  const [estrutura, setEstrutura] = _veUS([]);
  const [respostas, setRespostas] = _veUS({});
  const [concluindo, setConcluindo] = _veUS(false);
  const [erro, setErro] = _veUS(null);

  _veUE(() => {
    if (!token) { setNaoEncontrada(true); setCarregando(false); return; }
    (async () => {
      try {
        const { data: ativ, error: eAtiv } = await sb.from('vistorias_atividades')
          .select('*, dossier_obra(client_name, building_name), equipamentos_obra(numero_serie), vistorias_questionarios(id, nome)')
          .eq('token', token).maybeSingle();
        if (eAtiv) throw eAtiv;
        if (!ativ) { setNaoEncontrada(true); setCarregando(false); return; }

        const [est, { data: resp, error: eResp }] = await Promise.all([
          window.VistoriasQuestionariosStore.carregarEstrutura(ativ.vistorias_questionarios.id),
          sb.from('vistorias_respostas').select('*').eq('atividade_id', ativ.id),
        ]);
        if (eResp) throw eResp;

        const mapa = {};
        (resp || []).forEach((r) => { mapa[veChave(r.pergunta_id, r.pavimento_index)] = r; });

        let ativAtualizada = ativ;
        if (ativ.status === 'pendente') {
          const patch = { status: 'em_execucao', checkin_em: new Date().toISOString() };
          if (navigator.geolocation) {
            try {
              const pos = await new Promise((res2, rej2) => navigator.geolocation.getCurrentPosition(res2, rej2, { timeout: 6000 }));
              patch.checkin_lat = pos.coords.latitude;
              patch.checkin_lng = pos.coords.longitude;
            } catch (_e) { /* GPS negado/indisponível — segue sem coordenada, não bloqueia a vistoria */ }
          }
          const { error: eUp } = await sb.from('vistorias_atividades').update(patch).eq('id', ativ.id);
          if (!eUp) ativAtualizada = { ...ativ, ...patch };
        }

        setAtividade(ativAtualizada);
        setEstrutura(est);
        setRespostas(mapa);
      } catch (e) {
        setErro(e.message);
      } finally {
        setCarregando(false);
      }
    })();
  }, [token]);

  const onResponder = async (perguntaId, campos, pav) => {
    const chave = veChave(perguntaId, pav);
    setRespostas((prev) => ({ ...prev, [chave]: { ...(prev[chave] || {}), pergunta_id: perguntaId, pavimento_index: pav || 0, ...campos } }));
    try {
      const { error } = await sb.from('vistorias_respostas')
        .upsert({ atividade_id: atividade.id, pergunta_id: perguntaId, pavimento_index: pav || 0, ...campos }, { onConflict: 'atividade_id,pergunta_id,pavimento_index' });
      if (error) throw error;
    } catch (e) { setErro('Não deu pra salvar essa resposta: ' + e.message); }
  };

  /* Achata categoria×pergunta em (pergunta, pav) — categorias marcadas
     repete_por_pavimento viram N cópias (N = atividade.paradas, mínimo 1
     quando não informado, pra nunca sumir a seção). */
  const itensExpandidos = _veUM(() => {
    return estrutura.flatMap((c) => {
      const pavs = window.VistoriasQuestionariosStore.pavsDaCategoria(c, atividade?.paradas);
      return pavs.flatMap((pav) => c.perguntas.map((p) => ({ pergunta: p, pav, categoria: c })));
    });
  }, [estrutura, atividade?.paradas]);

  const itensVisiveis = _veUM(() => itensExpandidos.filter((it) => vePerguntaVisivel(it.pergunta, respostas, it.pav)), [itensExpandidos, respostas]);
  const obrigatoriosVisiveis = _veUM(() => itensVisiveis.filter((it) => it.pergunta.obrigatoria && it.pergunta.tipo_campo !== 'informativa'), [itensVisiveis]);
  const obrigatoriosRespondidos = obrigatoriosVisiveis.filter((it) => veRespostaPreenchida(it.pergunta.tipo_campo, respostas[veChave(it.pergunta.id, it.pav)]));

  const concluir = async () => {
    const faltando = obrigatoriosVisiveis.filter((it) => !veRespostaPreenchida(it.pergunta.tipo_campo, respostas[veChave(it.pergunta.id, it.pav)]));
    if (faltando.length > 0) {
      setErro(`Faltam ${faltando.length} pergunta(s) obrigatória(s): ${faltando.slice(0, 3).map((it) => it.pergunta.texto).join('; ')}${faltando.length > 3 ? '…' : ''}`);
      return;
    }
    setConcluindo(true);
    setErro(null);
    try {
      const patch = { status: 'concluida', concluido_em: new Date().toISOString() };
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((res2, rej2) => navigator.geolocation.getCurrentPosition(res2, rej2, { timeout: 6000 }));
          patch.checkout_lat = pos.coords.latitude;
          patch.checkout_lng = pos.coords.longitude;
        } catch (_e) { /* segue sem coordenada de saída */ }
      }
      const { error } = await sb.from('vistorias_atividades').update(patch).eq('id', atividade.id);
      if (error) throw error;
      setAtividade((prev) => ({ ...prev, ...patch }));
    } catch (e) { setErro('Erro ao concluir: ' + e.message); }
    finally { setConcluindo(false); }
  };

  if (carregando) {
    return <div className="ve-status"><div className="ve-spinner"/><h1>Carregando…</h1></div>;
  }
  if (naoEncontrada) {
    return (
      <div className="ve-status">
        <h1>Vistoria não encontrada</h1>
        <p>Esse link não corresponde a nenhuma vistoria despachada. Confira com quem te enviou o link.</p>
      </div>
    );
  }

  const obraNome = atividade.dossier_obra ? `${atividade.dossier_obra.client_name} — ${atividade.dossier_obra.building_name || 'sem nome'}` : '—';

  return (
    <div className="ve-page">
      <header className="ve-header">
        <div className="ve-header__eyebrow">VerticalParts · Vistoria</div>
        <h1>{atividade.vistorias_questionarios?.nome}</h1>
        <div className="ve-header__meta">
          {atividade.numero_sequencial ? `${atividade.numero_sequencial}ª vistoria · ` : ''}
          {obraNome}{atividade.equipamentos_obra?.numero_serie ? ` · ${atividade.equipamentos_obra.numero_serie}` : ''}
        </div>
      </header>

      {atividade.status === 'concluida' ? (
        <div className="ve-concluida">
          <div className="ve-concluida__icon">✓</div>
          <h2>Vistoria concluída</h2>
          <p>Registrada em {new Date(atividade.concluido_em).toLocaleString('pt-BR')}. Obrigado!</p>
        </div>
      ) : atividade.status === 'cancelada' ? (
        <div className="ve-concluida">
          <h2>Vistoria cancelada</h2>
          <p>Esta vistoria foi cancelada e não precisa mais ser preenchida.</p>
        </div>
      ) : (
        <>
          <div className="ve-progresso">
            <div className="ve-progresso__bar"><div style={{ width: `${obrigatoriosVisiveis.length ? (obrigatoriosRespondidos.length / obrigatoriosVisiveis.length) * 100 : 100}%` }}/></div>
            <span>{obrigatoriosRespondidos.length}/{obrigatoriosVisiveis.length} obrigatórias</span>
          </div>

          {estrutura.map((categoria) => {
            const pavs = window.VistoriasQuestionariosStore.pavsDaCategoria(categoria, atividade?.paradas);
            return (
              <section key={categoria.id} className="ve-categoria">
                <h3>{categoria.nome}</h3>
                {pavs.map((pav) => (
                  <div key={pav}>
                    {categoria.repete_por_pavimento && <div className="ve-pavimento-label">Pavimento {pav}</div>}
                    {categoria.perguntas.filter((p) => vePerguntaVisivel(p, respostas, pav)).map((p) => (
                      <VePergunta key={p.id + ':' + pav} pergunta={p} resposta={respostas[veChave(p.id, pav)]}
                        onResponder={(campos) => onResponder(p.id, campos, pav)} atividadeId={atividade.id} sb={sb}/>
                    ))}
                  </div>
                ))}
              </section>
            );
          })}

          {erro && <div className="ve-erro">{erro}</div>}

          <div className="ve-rodape">
            <button type="button" className="ve-btn-primary ve-btn-lg" onClick={concluir} disabled={concluindo}>
              {concluindo ? 'Concluindo…' : 'Concluir vistoria'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('ve-root')).render(<VistoriaExecucaoApp/>);
