/* ============================================================
   fabricacao-quadro-app.jsx — página pública da Evolução da
   Fabricação do Quadro de Comando (19/10/2026, Task 5).
   Rota: /fabricacao-quadro/<token> (server.js entrega
   fabricacao-quadro.html, token lido do path aqui). Sem SSO — link
   fixo por OP de quadro, mandado pra quem está montando o quadro no
   chão de fábrica.

   Molde: diario-obra-app.jsx (tokenDoPath, estados
   undefined/null/objeto, "Link não encontrado ou expirado."). Esta
   tela é mais simples: sem câmera/EXIF/geolocalização — só 6
   checkboxes (flegar é imediato, sem foto pra esperar, por isso sem
   botão "Enviar") + ocorrência de falta de material (com e sem
   frente de trabalho) + lista de ocorrências com "Chegou — resolver".

   Consome window.FabricacaoQuadroCalc (Task 2, puro) e
   window.FabricacaoQuadroStore (Task 3, Supabase) — nenhum cálculo
   de progresso/pausa mora aqui.

   Fix do review final (19/10/2026): `estado.status` já vem SEMPRE como
   o checklist completo (listarItens() mesclado com
   fabricacao_quadro_status) — o self-heal mora dentro do store
   (obterEstadoOrdem), não aqui, pra cobrir também a tela interna
   (evolucao-fabricacao-quadro.jsx) com uma correção só. Esta tela nunca
   deve voltar a usar `estado.status` como se fossem as linhas cruas do
   banco sem mesclar — ver fabricacao-quadro-store.js:obterEstadoOrdem.
   `estado === null` aqui significa estritamente "token não existe";
   falha de rede/consulta vira `erroCarregar`, nunca `estado === null`
   (ver FabricacaoQuadroApp).

   Produz: mounted React root em #fq-root. Sem exports (página
   standalone, como diario-obra-app.jsx).
   ============================================================ */
(function () {
  'use strict';

  function tokenDoPath() {
    const m = window.location.pathname.match(/\/fabricacao-quadro\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function fmtData(v) {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR');
  }
  function fmtDataHora(v) {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString('pt-BR');
  }

  function cabecalhoCliente(ordem) {
    const qc = ordem && ordem.quadros_comando;
    const c = qc && qc.clientes;
    return (c && (c.nome_fantasia || c.razao_social)) || (ordem && ordem.cliente) || 'Cliente não informado';
  }

  function cabecalhoTensaoPotencia(ordem) {
    const qc = ordem && ordem.quadros_comando;
    const m = qc && qc.quadros_comando_maquina;
    if (!m || (m.potencia_kw == null && m.tensao_v == null)) return null;
    const kw = m.potencia_kw != null ? `${m.potencia_kw} kW` : '—';
    const v = m.tensao_v != null ? `${m.tensao_v} V` : '—';
    return `${kw} / ${v}`;
  }

  // Sugestões do datalist (código do item que falta) — vêm do BOM deste
  // quadro (quadros_comando_bom_itens.sku/descricao, ver Task 5 brief).
  // Deduplicado por sku: o mesmo material pode aparecer em mais de uma
  // linha do BOM (grupos de separação diferentes).
  function bomItensDoQuadro(ordem) {
    const qc = ordem && ordem.quadros_comando;
    const lista = (qc && qc.quadros_comando_bom_itens) || [];
    const porSku = {};
    lista.forEach((it) => { if (it && it.sku && !porSku[it.sku]) porSku[it.sku] = it; });
    return Object.values(porSku);
  }

  function FQPEtapaLinha({ s, busy, onMarcar }) {
    const item = s.fabricacao_quadro_itens || {};
    const flegado = !!s.flegado;
    // Mesma lógica de idempotência do diario-obra-app.jsx:ItemLinha
    // (disabled={!!flegado || enviando}) — uma vez flegado, o checkbox
    // fica desabilitado e nunca dispara marcarEtapa de novo pela UI;
    // o upsert do store também é idempotente, mas aqui a trava já
    // começa na própria tela.
    const desabilitado = flegado || busy;
    return (
      <div style={{
        border: '1px solid ' + (flegado ? '#10b981' : '#ddd'),
        background: flegado ? '#f0fdf4' : '#fff',
        borderRadius: 8, padding: 12, marginBottom: 8,
      }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: desabilitado ? 'default' : 'pointer' }}>
          <input type="checkbox" checked={flegado} disabled={desabilitado}
            onChange={() => { if (!flegado) onMarcar(item.id); }}
            style={{ marginTop: 3, width: 18, height: 18 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{item.texto}</div>
            {flegado && (
              <div style={{ fontSize: 11.5, color: '#0a7a3d', marginTop: 2 }}>
                ✓ Concluído {fmtDataHora(s.flegado_em) ? 'em ' + fmtDataHora(s.flegado_em) : ''}
              </div>
            )}
          </div>
        </label>
      </div>
    );
  }

  function RelatarFaltaMaterial({ ordemId, bomItens, enviando, onEnviar }) {
    const [codigo, setCodigo] = React.useState('');
    const [temFrente, setTemFrente] = React.useState(null); // null | true | false
    const datalistId = 'fq-bom-datalist';

    const descricaoDoCodigo = React.useMemo(() => {
      const alvo = codigo.trim().toLowerCase();
      if (!alvo) return null;
      const achado = bomItens.find((it) => (it.sku || '').toLowerCase() === alvo);
      return achado ? achado.descricao : null;
    }, [codigo, bomItens]);

    // Review Focus (brief Task 5): o botão só libera com os dois dados
    // presentes — código não vazio E resposta de frente de trabalho já
    // escolhida. Nunca manda um relato incompleto silenciosamente.
    const podeEnviar = codigo.trim().length > 0 && temFrente !== null && !enviando;

    const submeter = async () => {
      if (!podeEnviar) return;
      await onEnviar(codigo.trim(), descricaoDoCodigo, temFrente);
      setCodigo(''); setTemFrente(null);
    };

    return (
      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 14, marginTop: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Relatar falta de material</div>

        <label style={{ display: 'block', fontSize: 12.5, color: '#444', marginBottom: 10 }}>
          Código do produto que falta
          <input type="text" list={datalistId} value={codigo} disabled={enviando}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Ex.: VPMP-303"
            style={{ display: 'block', marginTop: 4, width: '100%', fontSize: 14, padding: 8, border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' }} />
          <datalist id={datalistId}>
            {bomItens.map((it) => <option key={it.sku} value={it.sku}>{it.descricao}</option>)}
          </datalist>
          {descricaoDoCodigo && <div style={{ fontSize: 11.5, color: '#666', marginTop: 4 }}>{descricaoDoCodigo}</div>}
        </label>

        <div style={{ fontSize: 12.5, color: '#444', marginBottom: 6 }}>Tem frente de trabalho pra continuar enquanto espera?</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button type="button" disabled={enviando} onClick={() => setTemFrente(true)}
            style={{
              flex: 1, padding: 10, borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: '1px solid ' + (temFrente === true ? '#0a7a3d' : '#ddd'),
              background: temFrente === true ? '#dcfce7' : '#fff', color: temFrente === true ? '#0a7a3d' : '#333',
            }}>Sim, tem</button>
          <button type="button" disabled={enviando} onClick={() => setTemFrente(false)}
            style={{
              flex: 1, padding: 10, borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: '1px solid ' + (temFrente === false ? '#991b1b' : '#ddd'),
              background: temFrente === false ? '#fee2e2' : '#fff', color: temFrente === false ? '#991b1b' : '#333',
            }}>Não, vai parar</button>
        </div>

        {!podeEnviar && (codigo.trim() || temFrente !== null) && (
          <div style={{ fontSize: 11.5, color: '#92400e', marginBottom: 8 }}>
            {codigo.trim().length === 0 ? 'Informe o código do produto que falta.' : 'Diga se tem frente de trabalho antes de relatar.'}
          </div>
        )}

        <button type="button" onClick={submeter} disabled={!podeEnviar}
          style={{
            width: '100%', padding: 12, borderRadius: 8, fontSize: 14, fontWeight: 700, border: 'none',
            background: podeEnviar ? '#0066cc' : '#aac3dd', color: '#fff', cursor: podeEnviar ? 'pointer' : 'default',
          }}>{enviando ? 'Enviando…' : 'Relatar falta de material'}</button>
      </div>
    );
  }

  function ListaOcorrencias({ ocorrencias, resolvendoId, onResolver }) {
    if (!ocorrencias || !ocorrencias.length) return null;
    return (
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Ocorrências</div>
        {ocorrencias.map((oc) => {
          const aberta = oc.status === 'aberta';
          return (
            <div key={oc.id} style={{
              border: '1px solid ' + (aberta ? (oc.tem_frente_trabalho ? '#f59e0b' : '#dc2626') : '#ddd'),
              background: aberta ? (oc.tem_frente_trabalho ? '#fffbeb' : '#fef2f2') : '#f9fafb',
              borderRadius: 8, padding: 12, marginBottom: 8,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{oc.codigo_produto}{oc.descricao_produto ? ' — ' + oc.descricao_produto : ''}</div>
              <div style={{ fontSize: 11.5, color: '#555', marginTop: 2 }}>
                {aberta
                  ? (oc.tem_frente_trabalho ? 'Aberta · com frente de trabalho' : 'Aberta · SEM frente de trabalho — fabricação pausada')
                  : 'Resolvida' + (fmtDataHora(oc.resolvida_em) ? ' em ' + fmtDataHora(oc.resolvida_em) : '')}
                {' · desde ' + (fmtDataHora(oc.aberta_em) || '—')}
              </div>
              {aberta && (
                <button type="button" disabled={resolvendoId === oc.id} onClick={() => onResolver(oc.id)}
                  style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: '#0a7a3d', background: '#fff', border: '1px solid #0a7a3d', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>
                  {resolvendoId === oc.id ? 'Resolvendo…' : '✓ Chegou — resolver'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function FabricacaoQuadroApp() {
    const [token] = React.useState(tokenDoPath);
    const [estado, setEstado] = React.useState(undefined);
    // Fix do review final (Finding 2, 19/10/2026): `estado === null` só
    // pode significar "token realmente não existe" (link morto/expirado).
    // Uma falha transitória de rede/consulta é um problema BEM diferente
    // — nunca pode mostrar a mesma mensagem de "link morto" pro operador
    // do quadro, que não tem nada de errado com o link dele. Por isso o
    // catch de obterEstadoPorToken NUNCA cai em setEstado(null): ele seta
    // erroCarregar, e só obterEstadoPorToken() resolvendo com `null`
    // (token que não existe mesmo, ver fabricacao-quadro-store.js) zera
    // a tela pra "Link não encontrado ou expirado.".
    const [erroCarregar, setErroCarregar] = React.useState(null);
    const [marcandoId, setMarcandoId] = React.useState(null);
    const [enviandoOcorrencia, setEnviandoOcorrencia] = React.useState(false);
    const [resolvendoId, setResolvendoId] = React.useState(null);

    const carregar = React.useCallback(() => {
      if (!token || !window.FabricacaoQuadroStore) return;
      window.FabricacaoQuadroStore.obterEstadoPorToken(token)
        .then((e) => { setErroCarregar(null); setEstado(e); })
        .catch((e) => { setErroCarregar((e && e.message) || String(e) || 'Falha desconhecida.'); });
    }, [token]);
    React.useEffect(() => { carregar(); }, [carregar]);

    // Mesmo texto/comportamento de diario-obra-app.jsx (linhas 200-202):
    // token ausente ou link inexistente/expirado nunca deixa a tela em
    // branco.
    if (!token) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Link inválido.</div>;
    if (estado === undefined) {
      // Falhou já na 1ª carga: ainda não há nada pra mostrar, mas o
      // texto precisa deixar claro que o link PODE estar certo (ver nota
      // acima) — "Tente de novo" em vez de "Link não encontrado".
      if (erroCarregar) {
        return (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
            <div>Erro ao carregar. Tente de novo.</div>
            <button type="button" onClick={carregar}
              style={{ marginTop: 14, padding: '8px 16px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
              Tentar de novo
            </button>
          </div>
        );
      }
      return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Carregando…</div>;
    }
    if (estado === null) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Link não encontrado ou expirado.</div>;

    const ordemId = estado.link.ordem_id;
    const ordem = estado.ordem || {};
    const status = estado.status || [];
    const ocorrencias = estado.ocorrencias || [];
    const C = window.FabricacaoQuadroCalc;

    const itensOrdenados = [...status].sort(
      (a, b) => (a.fabricacao_quadro_itens && a.fabricacao_quadro_itens.ordem || 0) - (b.fabricacao_quadro_itens && b.fabricacao_quadro_itens.ordem || 0)
    );
    const pct = C.resumoProgresso(status).pct;
    const pausado = C.estaPausado(ocorrencias);
    const feitos = status.filter((s) => s.flegado).length;
    const total = status.length;
    const bomItens = bomItensDoQuadro(ordem);
    const tp = cabecalhoTensaoPotencia(ordem);
    // Fiação extra (Cabo de Manobra/Passadiço/Topo do Carro/Poço) — só vem
    // preenchida quando a OP está vinculada a um Pedido de Venda do Omie
    // (ver fabricacao-quadro-store.js:fiacaoAplicavelParaOrdem). Sem isso
    // fiacaoStatus sai [] e a seção abaixo nem aparece — quadro avulso
    // continua exatamente como antes desta feature.
    const fiacaoStatus = estado.fiacaoStatus || [];
    const fiacaoCompleta = !fiacaoStatus.length || fiacaoStatus.every((s) => s.flegado);
    const concluido = pct === 100 && fiacaoCompleta;

    const marcar = async (itemId) => {
      setMarcandoId(itemId);
      try {
        await window.FabricacaoQuadroStore.marcarEtapa(ordemId, itemId, null);
        carregar();
      } catch (e) {
        window.alert('Erro ao marcar etapa: ' + (e.message || e));
      } finally {
        setMarcandoId(null);
      }
    };

    const marcarFiacao = async (itemId) => {
      setMarcandoId(itemId);
      try {
        await window.FabricacaoQuadroStore.marcarEtapaFiacao(ordemId, itemId, null);
        carregar();
      } catch (e) {
        window.alert('Erro ao marcar etapa: ' + (e.message || e));
      } finally {
        setMarcandoId(null);
      }
    };

    const relatarFalta = async (codigoProduto, descricaoProduto, temFrenteTrabalho) => {
      setEnviandoOcorrencia(true);
      try {
        await window.FabricacaoQuadroStore.abrirOcorrencia(ordemId, codigoProduto, descricaoProduto, temFrenteTrabalho);
        carregar();
      } catch (e) {
        window.alert('Erro ao relatar falta de material: ' + (e.message || e));
      } finally {
        setEnviandoOcorrencia(false);
      }
    };

    const resolver = async (ocorrenciaId) => {
      setResolvendoId(ocorrenciaId);
      try {
        await window.FabricacaoQuadroStore.resolverOcorrencia(ocorrenciaId);
        carregar();
      } catch (e) {
        window.alert('Erro ao resolver ocorrência: ' + (e.message || e));
      } finally {
        setResolvendoId(null);
      }
    };

    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 14px 40px', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif' }}>
        <div style={{ background: '#0b1220', color: '#fff', borderRadius: 10, padding: '18px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Fabricação do Quadro de Comando</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{cabecalhoCliente(ordem)}</div>
          <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 4 }}>
            {[ordem.numero ? 'OP ' + ordem.numero : null, tp, ordem.numero_cotacao ? 'Cotação Nº ' + ordem.numero_cotacao : null]
              .filter(Boolean).join(' · ') || '—'}
          </div>
          <div style={{ marginTop: 10, background: 'rgba(255,255,255,.15)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ background: pausado ? '#dc2626' : '#22c55e', height: '100%', width: pct + '%' }} />
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>{feitos}/{total} etapas feitas — {pct}%</div>
          {concluido && (
            <div style={{ marginTop: 10, display: 'inline-block', background: '#dcfce7', color: '#0a7a3d', fontWeight: 700, fontSize: 12.5, borderRadius: 999, padding: '4px 12px' }}>
              ✓ Tudo concluído
            </div>
          )}
        </div>

        {/* Falha ao RECARREGAR depois que a tela já tinha dados (ex.: depois
            de marcar/relatar/resolver) — o que já estava na tela continua
            visível (nunca vira "Link não encontrado"), só avisa que a
            última atualização não pegou e oferece tentar de novo. */}
        {erroCarregar && (
          <div style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <span>Não foi possível atualizar agora. O que está na tela pode estar desatualizado.</span>
            <button type="button" onClick={carregar}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #92400e', background: '#fff', color: '#92400e', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              Atualizar
            </button>
          </div>
        )}

        {pausado && (
          <div style={{ background: '#fef2f2', border: '1px solid #dc2626', borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#991b1b' }}>⏸ Fabricação pausada</div>
            <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 2 }}>Falta material e não há frente de trabalho disponível agora — veja em Ocorrências.</div>
          </div>
        )}

        <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
          Marque cada etapa assim que concluir. O que já está marcado fica travado — só quem gerou o link consegue desmarcar.
        </div>

        {itensOrdenados.map((s) => (
          <FQPEtapaLinha key={s.item_id} s={s} busy={marcandoId === s.item_id} onMarcar={marcar} />
        ))}

        {fiacaoStatus.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Fiação (elevador completo)</div>
            {fiacaoStatus.map((s) => (
              <FQPEtapaLinha key={s.item_id} s={s} busy={marcandoId === s.item_id} onMarcar={marcarFiacao} />
            ))}
          </div>
        )}

        <RelatarFaltaMaterial ordemId={ordemId} bomItens={bomItens} enviando={enviandoOcorrencia} onEnviar={relatarFalta} />

        <ListaOcorrencias ocorrencias={ocorrencias} resolvendoId={resolvendoId} onResolver={resolver} />
      </div>
    );
  }

  const root = ReactDOM.createRoot(document.getElementById('fq-root'));
  root.render(<FabricacaoQuadroApp />);
}());
