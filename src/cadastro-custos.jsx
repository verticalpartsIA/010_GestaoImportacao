/* ============================================================
   cadastro-custos.jsx — Cadastros · Atualização de Custos
   3 abas: Instalação (Elevadores / Escada·Esteira Rolante) e Containers.
   Tudo que é precificado pra compor o custo de uma Precificação fica
   salvo aqui — a Precificação herda esses valores automaticamente a
   partir das specs do equipamento (ver [[precificacao-elevador-store]]).
   ============================================================ */

const CC_TRACOES = ['2:1', '4:1'];
/* URL não aceita ":" de forma limpa num segmento de path — "2:1" vira
   "2-1" (e volta) só na borda da URL; o valor interno continua "2:1"
   (é o que a tabela custos_instalacao_elevador usa). */
function ccTracaoToSlug(t) { return (t || '').replace(':', '-'); }
function ccSlugToTracao(s) { return (s || '').replace('-', ':'); }
function ccFmtBRL(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

function CCInputNum({ value, onBlurSave, placeholder, width }) {
  const [local, setLocal] = React.useState(value == null ? '' : String(value));
  React.useEffect(() => { setLocal(value == null ? '' : String(value)); }, [value]);
  return (
    <input className="input" type="number" style={{ width: width || 110, textAlign: 'right' }}
      value={local} placeholder={placeholder || '—'}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const n = local === '' ? null : Number(local);
        if (n !== value) onBlurSave(n);
      }}/>
  );
}

/* Sugestão de valor por regressão (extrapolação estatística sobre as
   linhas REAIS já cotadas da mesma tração) — só aparece quando a linha
   ainda não tem valor digitado e já tem paradas/dias/montadores o
   suficiente pra calcular. Nunca preenche sozinha: sempre precisa do
   clique em "Usar" — e o valor resultante fica marcado como estimativa
   (badge amarelo), nunca como preço confirmado. */
function CCEstimativaSugestao({ row, tracao, onUsar, saving }) {
  const [estimativa, setEstimativa] = React.useState(null);
  const capacidadeKg = ((Number(row.capacidade_min_kg) || 0) + (Number(row.capacidade_max_kg) || 0)) / 2;
  const pronta = row.paradas > 0 && row.dias_montagem > 0 && row.qtd_montadores > 0 && capacidadeKg > 0;

  React.useEffect(() => {
    if (!pronta) { setEstimativa(null); return; }
    let vivo = true;
    window.CadastroCustosStore.estimarValorElevador(tracao, {
      capacidadeKg, paradas: Number(row.paradas), diasMontagem: Number(row.dias_montagem), qtdMontadores: Number(row.qtd_montadores),
    }).then((r) => { if (vivo) setEstimativa(r); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracao, capacidadeKg, row.paradas, row.dias_montagem, row.qtd_montadores]);

  if (!pronta || !estimativa) return null;
  return (
    <div className="small" style={{ marginTop: 4, color: 'var(--fg3)' }}>
      Sugestão (estimativa, {estimativa.baseadoEmLinhas} linhas reais{estimativa.usouCapacidade ? '' : ' — sem base real de capacidade nesta tração'}):{' '}
      <b>{ccFmtBRL(estimativa.valor)}</b>{' '}
      <Button variant="ghost" size="sm" disabled={saving} onClick={() => onUsar(estimativa.valor)}>Usar</Button>
    </div>
  );
}

/* ---------- Instalação — Elevadores ---------- */
function CCElevadorTab() {
  const [rows, setRows] = React.useState(null);
  /* Tração vem da URL quando é deep link (ex.: .../instalacao-elevadores/4-1)
     — mesmo padrão de dossier-obra.jsx pra aba interna. */
  const [tracao, setTracao] = React.useState(() => {
    const t = ccSlugToTracao((window.VpRouter && window.VpRouter.parseLocation().tab) || '');
    return CC_TRACOES.includes(t) ? t : '2:1';
  });
  const [saving, setSaving] = React.useState(null); // id em salvamento
  const [removendo, setRemovendo] = React.useState(null);
  const [adicionando, setAdicionando] = React.useState(false);

  const reload = () => { setRows(null); window.CadastroCustosStore.listarCustosElevador().then(setRows); };
  React.useEffect(() => { reload(); }, []);

  /* Espelha a tração escolhida no 3º segmento da URL — replace:true pra
     não empilhar histórico a cada clique (mesma lógica de dossier-obra.jsx). */
  React.useEffect(() => {
    if (!window.VpRouter) return;
    const atual = window.VpRouter.parseLocation();
    window.VpRouter.navigate('cadastro-custos', atual.id, ccTracaoToSlug(tracao), { replace: true });
  }, [tracao]);

  const rowsTracao = React.useMemo(() =>
    (rows || []).filter((r) => r.tracao === tracao)
      .sort((a, b) => (a.capacidade_min_kg - b.capacidade_min_kg) || (a.paradas - b.paradas)),
    [rows, tracao]);

  const salvarCampo = async (row, campo, valor) => {
    setSaving(row.id);
    try {
      // Editou o valor com a própria mão → deixa de ser estimativa (agora é
      // um número que a pessoa escolheu conscientemente, não mais o palpite
      // estatístico que era antes).
      const patch = { ...row, [campo]: valor };
      if (campo === 'valor_reajustado_rs') patch.is_estimativa = false;
      await window.CadastroCustosStore.salvarCustoElevador(patch);
      await reload();
    } catch (e) {
      window.toast?.('Erro ao salvar: ' + e.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  const usarEstimativa = async (row, valorEstimado) => {
    setSaving(row.id);
    try {
      await window.CadastroCustosStore.salvarCustoElevador({ ...row, valor_reajustado_rs: valorEstimado, is_estimativa: true });
      await reload();
    } catch (e) {
      window.toast?.('Erro ao salvar estimativa: ' + e.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  /* Linha nasce com capacidade/paradas em 0/1 (placeholder óbvio, não um
     valor real) — o Financeiro edita direto na tabela, célula por célula,
     igual editaria qualquer outra. Não existe modal de cadastro separado:
     a tabela inteira já é o formulário. */
  const adicionarLinha = async () => {
    setAdicionando(true);
    try {
      await window.CadastroCustosStore.salvarCustoElevador({
        tracao, capacidade_min_kg: 0, capacidade_max_kg: 0, paradas: 1,
        dias_montagem: null, qtd_montadores: null, valor_reajustado_rs: 0, ativo: true,
      });
      await reload();
      window.toast?.('Linha adicionada — preencha capacidade e paradas.', 'success');
    } catch (e) {
      window.toast?.('Erro ao adicionar linha: ' + e.message, 'error');
    } finally {
      setAdicionando(false);
    }
  };

  const removerLinha = async (row) => {
    if (!window.confirm(`Remover a linha ${row.capacidade_min_kg}-${row.capacidade_max_kg}kg / ${row.paradas} paradas? Não afeta precificações que já buscaram esse valor antes — só buscas futuras.`)) return;
    setRemovendo(row.id);
    try {
      await window.CadastroCustosStore.removerCustoElevador(row.id);
      await reload();
    } catch (e) {
      window.toast?.('Erro ao remover: ' + e.message, 'error');
    } finally {
      setRemovendo(null);
    }
  };

  if (rows === null) return <div className="muted small" style={{ padding: '24px 0' }}>Carregando…</div>;

  return (
    <Card title="Instalação — Elevadores" sub="Tração × capacidade × paradas — todos os campos da tabela são editáveis diretamente"
      action={<Button variant="primary" size="sm" icon="plus" onClick={adicionarLinha} disabled={adicionando}>{adicionando ? 'Adicionando…' : '+ Adicionar linha'}</Button>}>
      <div className="row gap-2" style={{ marginBottom: 14 }}>
        {CC_TRACOES.map((t) => (
          <Button key={t} variant={tracao === t ? 'primary' : 'outline'} size="sm" onClick={() => setTracao(t)}>
            Tração {t}
          </Button>
        ))}
      </div>
      <div className="table-wrap" style={{ maxHeight: 560, overflowY: 'auto' }}>
        <table className="t">
          <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#fff', boxShadow: '0 1px 0 var(--border, #e5e5e5)' }}><tr>
            <th>Capacidade mín. (kg)</th><th>Capacidade máx. (kg)</th><th>Paradas</th>
            <th>Dias p/ montagem</th><th>Qtd. montadores</th><th className="text-right">Valor reajustado (R$)</th><th></th>
          </tr></thead>
          <tbody>
            {rowsTracao.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--fg3)', fontSize: 13, padding: '20px 0' }}>Nenhuma linha cadastrada pra tração {tracao} ainda — clique em "+ Adicionar linha".</td></tr>
            )}
            {rowsTracao.map((r) => (
              <tr key={r.id} style={{ opacity: saving === r.id || removendo === r.id ? .5 : 1 }}>
                <td><CCInputNum value={r.capacidade_min_kg} width={100} onBlurSave={(v) => salvarCampo(r, 'capacidade_min_kg', v ?? 0)}/></td>
                <td><CCInputNum value={r.capacidade_max_kg} width={100} onBlurSave={(v) => salvarCampo(r, 'capacidade_max_kg', v ?? 0)}/></td>
                <td><CCInputNum value={r.paradas} width={80} onBlurSave={(v) => salvarCampo(r, 'paradas', v ?? 1)}/></td>
                <td><CCInputNum value={r.dias_montagem} width={90} onBlurSave={(v) => salvarCampo(r, 'dias_montagem', v)}/></td>
                <td><CCInputNum value={r.qtd_montadores} width={90} onBlurSave={(v) => salvarCampo(r, 'qtd_montadores', v)}/></td>
                <td className="text-right">
                  <div className="row gap-2" style={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                    {r.is_estimativa ? <span className="badge" style={{ background: '#fffbeb', color: '#b45309', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>Estimativa</span> : null}
                    <PZCurrencyInput moeda="BRL" value={r.valor_reajustado_rs} onChange={(v) => salvarCampo(r, 'valor_reajustado_rs', v ?? 0)}/>
                  </div>
                  {(!r.valor_reajustado_rs || Number(r.valor_reajustado_rs) === 0) && (
                    <CCEstimativaSugestao row={r} tracao={tracao} saving={saving === r.id}
                      onUsar={(v) => usarEstimativa(r, v)}/>
                  )}
                </td>
                <td><Button variant="ghost" size="sm" icon="trash" title="Remover linha" onClick={() => removerLinha(r)} disabled={removendo === r.id}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------- Instalação — Escada / Esteira Rolante ---------- */
function CCEscadaEsteiraTab() {
  const [rows, setRows] = React.useState(null);
  const [saving, setSaving] = React.useState(null);

  const reload = () => { setRows(null); window.CadastroCustosStore.listarCustosEscadaEsteira().then(setRows); };
  React.useEffect(() => { reload(); }, []);

  const salvarCampo = async (row, campo, valor) => {
    setSaving(row.id);
    try {
      await window.CadastroCustosStore.salvarCustoEscadaEsteira({ ...row, [campo]: valor });
      await reload();
    } catch (e) {
      window.toast?.('Erro ao salvar: ' + e.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  const labelTipo = { escada_rolante: 'Escada Rolante', esteira_rolante: 'Esteira Rolante' };

  if (rows === null) return <div className="muted small" style={{ padding: '24px 0' }}>Carregando…</div>;

  return (
    <Card title="Instalação — Escada / Esteira Rolante" sub="Valor fixo por tipo, varia só por estado. Só existem esses 2 tipos porque são categorias de produto usadas em todo o sistema (Master ID, Engenharia) — não é uma lista que cresce como a de Elevadores/Containers.">
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Equipamento</th><th className="text-right">São Paulo (R$)</th><th className="text-right">Outros Estados (R$)</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ opacity: saving === r.id ? .5 : 1 }}>
                <td>{labelTipo[r.tipo] || r.tipo}</td>
                <td className="text-right"><PZCurrencyInput moeda="BRL" value={r.valor_sao_paulo_rs} onChange={(v) => salvarCampo(r, 'valor_sao_paulo_rs', v)}/></td>
                <td className="text-right"><PZCurrencyInput moeda="BRL" value={r.valor_outros_estados_rs} onChange={(v) => salvarCampo(r, 'valor_outros_estados_rs', v)}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------- Containers ---------- */
function CCContainersTab() {
  const [rows, setRows] = React.useState(null);
  const [saving, setSaving] = React.useState(null);
  const [removendo, setRemovendo] = React.useState(null);
  const [adicionando, setAdicionando] = React.useState(false);

  const reload = () => { setRows(null); window.CadastroCustosStore.listarContainers().then(setRows); };
  React.useEffect(() => { reload(); }, []);

  const salvarCampo = async (row, campo, valor) => {
    setSaving(row.id);
    try {
      await window.CadastroCustosStore.salvarContainer({ ...row, [campo]: valor });
      await reload();
    } catch (e) {
      window.toast?.('Erro ao salvar: ' + e.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  /* tipo é NOT NULL UNIQUE no banco — nasce com um placeholder óbvio e
     único (timestamp) pra não colidir; o Financeiro renomeia na hora. */
  const adicionarContainer = async () => {
    setAdicionando(true);
    try {
      await window.CadastroCustosStore.salvarContainer({ tipo: `Novo container ${Date.now()}`, ativo: true });
      await reload();
      window.toast?.('Container adicionado — renomeie o tipo e preencha os dados.', 'success');
    } catch (e) {
      window.toast?.('Erro ao adicionar container: ' + e.message, 'error');
    } finally {
      setAdicionando(false);
    }
  };

  const removerContainer = async (row) => {
    if (!window.confirm(`Remover o container "${row.tipo}"?`)) return;
    setRemovendo(row.id);
    try {
      await window.CadastroCustosStore.removerContainer(row.id);
      await reload();
    } catch (e) {
      window.toast?.('Erro ao remover: ' + e.message, 'error');
    } finally {
      setRemovendo(null);
    }
  };

  if (rows === null) return <div className="muted small" style={{ padding: '24px 0' }}>Carregando…</div>;

  return (
    <Card title="Containers" sub="Specs ISO de referência + dados comerciais, preenchidos a cada cotação nova — todos os campos são editáveis, inclusive o tipo"
      action={<Button variant="primary" size="sm" icon="plus" onClick={adicionarContainer} disabled={adicionando}>{adicionando ? 'Adicionando…' : '+ Adicionar container'}</Button>}>
      <div className="table-wrap">
        <table className="t">
          <thead><tr>
            <th>Tipo</th><th>Compr. (m)</th><th>Altura</th><th>Capac. (m³)</th>
            <th className="text-right">Preço (USD)</th><th className="text-right">Preço (R$)</th>
            <th>Data cotação</th><th>Fornecedor</th><th>Observações</th><th></th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ opacity: saving === r.id || removendo === r.id ? .5 : 1 }}>
                <td><input className="input" style={{ width: 130 }} defaultValue={r.tipo || ''}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== (r.tipo || '')) salvarCampo(r, 'tipo', v); }}/></td>
                <td><CCInputNum value={r.comprimento_m} width={80} onBlurSave={(v) => salvarCampo(r, 'comprimento_m', v)}/></td>
                <td><input className="input" style={{ width: 100 }} defaultValue={r.altura_desc || ''}
                  onBlur={(e) => { if (e.target.value !== (r.altura_desc || '')) salvarCampo(r, 'altura_desc', e.target.value || null); }}/></td>
                <td><CCInputNum value={r.capacidade_m3} width={80} onBlurSave={(v) => salvarCampo(r, 'capacidade_m3', v)}/></td>
                <td className="text-right"><PZCurrencyInput moeda="USD" value={r.preco_usd} onChange={(v) => salvarCampo(r, 'preco_usd', v)}/></td>
                <td className="text-right"><PZCurrencyInput moeda="BRL" value={r.preco_rs} onChange={(v) => salvarCampo(r, 'preco_rs', v)}/></td>
                <td>
                  <input className="input" type="date" style={{ width: 140 }} value={r.data_cotacao || ''}
                    onChange={(e) => salvarCampo(r, 'data_cotacao', e.target.value || null)}/>
                </td>
                <td><input className="input" style={{ width: 120 }} defaultValue={r.fornecedor || ''}
                  onBlur={(e) => { if (e.target.value !== (r.fornecedor || '')) salvarCampo(r, 'fornecedor', e.target.value || null); }}/></td>
                <td><input className="input" style={{ width: 180 }} defaultValue={r.observacoes || ''}
                  onBlur={(e) => { if (e.target.value !== (r.observacoes || '')) salvarCampo(r, 'observacoes', e.target.value || null); }}/></td>
                <td><Button variant="ghost" size="sm" icon="trash" title="Remover container" onClick={() => removerContainer(r)} disabled={removendo === r.id}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------- Página ----------
   Cada aba tem sua própria URL (/cadastros/cadastro-custos/<slug>) — rota
   registrada como SYNC_PASSTHROUGH em app.jsx, subsel É o slug (string),
   sem fetch nenhum. Link direto/recarregar/compartilhar já abre na aba
   certa; sem subsel ainda (1º acesso pelo menu), populamos o slug padrão
   na URL pra ela nunca ficar "sem aba" pra quem copiar o link depois. */
const CC_SLUG_TO_ABA = { 'instalacao-elevadores': 'elevador', 'instalacao-escada-esteira': 'escada', 'containers': 'containers' };
const CC_ABA_TO_SLUG = { elevador: 'instalacao-elevadores', escada: 'instalacao-escada-esteira', containers: 'containers' };

function CadastroCustosPage({ setSubsel, subsel }) {
  const aba = CC_SLUG_TO_ABA[subsel] || 'elevador';

  React.useEffect(() => {
    if (!CC_SLUG_TO_ABA[subsel]) setSubsel?.(CC_ABA_TO_SLUG.elevador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Fora da aba Elevadores não existe tração — some com um "/2-1" ou "/4-1"
     que tenha sobrado na URL (o efeito genérico de app.jsx preservaria essa
     aba antiga, já que a rota "cadastro-custos" continua a mesma). */
  React.useEffect(() => {
    if (!window.VpRouter || aba === 'elevador') return;
    const atual = window.VpRouter.parseLocation();
    if (atual.tab) window.VpRouter.navigate('cadastro-custos', subsel, null, { replace: true });
  }, [aba, subsel]);

  const irPara = (chave) => setSubsel?.(CC_ABA_TO_SLUG[chave]);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Cadastros · Atualização de Custos</div>
          <h1 className="page-head__title">Atualização de Custos</h1>
          <p className="page-head__sub">
            Tabelas de referência de custo — Instalação de Equipamentos e Containers. A Precificação herda
            esses valores automaticamente conforme as specs escolhidas lá (paradas, capacidade, tração, container).
          </p>
        </div>
      </div>

      <div className="tbar" style={{ marginBottom: 16 }}>
        <div className="seg">
          <button className={aba === 'elevador' ? 'is-active' : ''} onClick={() => irPara('elevador')}>Instalação — Elevadores</button>
          <button className={aba === 'escada' ? 'is-active' : ''} onClick={() => irPara('escada')}>Instalação — Escada/Esteira</button>
          <button className={aba === 'containers' ? 'is-active' : ''} onClick={() => irPara('containers')}>Containers</button>
        </div>
      </div>

      {aba === 'elevador' && <CCElevadorTab/>}
      {aba === 'escada' && <CCEscadaEsteiraTab/>}
      {aba === 'containers' && <CCContainersTab/>}
    </div>
  );
}

window.CadastroCustosPage = CadastroCustosPage;
