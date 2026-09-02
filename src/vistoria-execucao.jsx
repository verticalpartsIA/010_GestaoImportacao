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
  if (tipoCampo === 'foto' || tipoCampo === 'assinatura') return !!r.anexo_url;
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
  const path = `${atividadeId}/${perguntaId}-${Date.now()}.${ext}`;
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

  const enviarFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviandoArquivo(true);
    try {
      const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const url = await veUploadArquivo(sb, atividadeId, pergunta.id, file, ext);
      onResponder({ anexo_url: url });
    } catch (err) { alert('Erro ao enviar a foto: ' + err.message); }
    finally { setEnviandoArquivo(false); e.target.value = ''; }
  };

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
        <div>
          {resposta?.anexo_url ? (
            <div className="ve-foto-ok">
              <img src={resposta.anexo_url} alt="Foto enviada"/>
              <label className="ve-btn-ghost">Trocar foto<input type="file" accept="image/*" capture="environment" onChange={enviarFoto} hidden/></label>
            </div>
          ) : (
            <label className="ve-btn-primary">
              {enviandoArquivo ? 'Enviando…' : 'Tirar foto'}
              <input type="file" accept="image/*" capture="environment" onChange={enviarFoto} hidden disabled={enviandoArquivo}/>
            </label>
          )}
        </div>
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
