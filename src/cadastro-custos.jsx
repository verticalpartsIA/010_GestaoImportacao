/* ============================================================
   cadastro-custos.jsx — Cadastros · Atualização de Custos
   3 abas: Instalação (Elevadores / Escada·Esteira Rolante) e Containers.
   Tudo que é precificado pra compor o custo de uma Precificação fica
   salvo aqui — a Precificação herda esses valores automaticamente a
   partir das specs do equipamento (ver [[precificacao-elevador-store]]).
   ============================================================ */

const CC_TRACOES = ['2:1', '4:1'];

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

/* ---------- Instalação — Elevadores ---------- */
function CCElevadorTab() {
  const [rows, setRows] = React.useState(null);
  const [tracao, setTracao] = React.useState('2:1');
  const [saving, setSaving] = React.useState(null); // id em salvamento

  const reload = () => { setRows(null); window.CadastroCustosStore.listarCustosElevador().then(setRows); };
  React.useEffect(() => { reload(); }, []);

  const faixas = React.useMemo(() => {
    const set = new Map();
    (rows || []).filter((r) => r.tracao === tracao).forEach((r) => {
      const k = `${r.capacidade_min_kg}-${r.capacidade_max_kg}`;
      if (!set.has(k)) set.set(k, { min: r.capacidade_min_kg, max: r.capacidade_max_kg });
    });
    return Array.from(set.values()).sort((a, b) => a.min - b.min);
  }, [rows, tracao]);

  const salvarCampo = async (row, campo, valor) => {
    setSaving(row.id);
    try {
      await window.CadastroCustosStore.salvarCustoElevador({ ...row, [campo]: valor });
      await reload();
    } catch (e) {
      window.toast?.('Erro ao salvar: ' + e.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  if (rows === null) return <div className="muted small" style={{ padding: '24px 0' }}>Carregando…</div>;

  return (
    <div>
      <div className="row gap-2" style={{ marginBottom: 14 }}>
        {CC_TRACOES.map((t) => (
          <Button key={t} variant={tracao === t ? 'primary' : 'outline'} size="sm" onClick={() => setTracao(t)}>
            Tração {t}
          </Button>
        ))}
      </div>

      {faixas.map((f) => {
        const rowsFaixa = (rows || []).filter((r) => r.tracao === tracao && r.capacidade_min_kg === f.min && r.capacidade_max_kg === f.max)
          .sort((a, b) => a.paradas - b.paradas);
        return (
          <Card key={`${f.min}-${f.max}`} title={`Capacidade ${f.min === 0 ? 'até' : f.min + ' a'} ${f.max} kg`} style={{ marginBottom: 14 }}>
            <div className="table-wrap">
              <table className="t">
                <thead><tr>
                  <th>Paradas</th><th>Dias p/ montagem</th><th>Qtd. montadores</th><th className="text-right">Valor reajustado (R$)</th>
                </tr></thead>
                <tbody>
                  {rowsFaixa.map((r) => (
                    <tr key={r.id} style={{ opacity: saving === r.id ? .5 : 1 }}>
                      <td className="mono">{r.paradas}</td>
                      <td><CCInputNum value={r.dias_montagem} width={90} onBlurSave={(v) => salvarCampo(r, 'dias_montagem', v)}/></td>
                      <td><CCInputNum value={r.qtd_montadores} width={90} onBlurSave={(v) => salvarCampo(r, 'qtd_montadores', v)}/></td>
                      <td className="text-right"><CCInputNum value={r.valor_reajustado_rs} width={130} onBlurSave={(v) => salvarCampo(r, 'valor_reajustado_rs', v ?? 0)}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
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
    <Card title="Instalação — Escada / Esteira Rolante" sub="Valor fixo por tipo, varia só por estado">
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Equipamento</th><th className="text-right">São Paulo (R$)</th><th className="text-right">Outros Estados (R$)</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ opacity: saving === r.id ? .5 : 1 }}>
                <td>{labelTipo[r.tipo] || r.tipo}</td>
                <td className="text-right"><CCInputNum value={r.valor_sao_paulo_rs} width={130} onBlurSave={(v) => salvarCampo(r, 'valor_sao_paulo_rs', v)}/></td>
                <td className="text-right"><CCInputNum value={r.valor_outros_estados_rs} placeholder="preencher" width={130} onBlurSave={(v) => salvarCampo(r, 'valor_outros_estados_rs', v)}/></td>
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

  if (rows === null) return <div className="muted small" style={{ padding: '24px 0' }}>Carregando…</div>;

  return (
    <Card title="Containers" sub="Specs ISO de referência (fixas) + dados comerciais, preenchidos a cada cotação nova">
      <div className="table-wrap">
        <table className="t">
          <thead><tr>
            <th>Tipo</th><th>Compr. (m)</th><th>Altura</th><th>Capac. (m³)</th>
            <th className="text-right">Preço (USD)</th><th className="text-right">Preço (R$)</th>
            <th>Data cotação</th><th>Fornecedor</th><th>Observações</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ opacity: saving === r.id ? .5 : 1 }}>
                <td style={{ whiteSpace: 'nowrap' }}>{r.tipo}</td>
                <td className="mono small">{r.comprimento_m ?? '—'}</td>
                <td className="small">{r.altura_desc || '—'}</td>
                <td className="mono small">{r.capacidade_m3 ?? '—'}</td>
                <td className="text-right"><CCInputNum value={r.preco_usd} onBlurSave={(v) => salvarCampo(r, 'preco_usd', v)}/></td>
                <td className="text-right"><CCInputNum value={r.preco_rs} onBlurSave={(v) => salvarCampo(r, 'preco_rs', v)}/></td>
                <td>
                  <input className="input" type="date" style={{ width: 140 }} value={r.data_cotacao || ''}
                    onChange={(e) => salvarCampo(r, 'data_cotacao', e.target.value || null)}/>
                </td>
                <td><input className="input" style={{ width: 120 }} defaultValue={r.fornecedor || ''}
                  onBlur={(e) => { if (e.target.value !== (r.fornecedor || '')) salvarCampo(r, 'fornecedor', e.target.value || null); }}/></td>
                <td><input className="input" style={{ width: 180 }} defaultValue={r.observacoes || ''}
                  onBlur={(e) => { if (e.target.value !== (r.observacoes || '')) salvarCampo(r, 'observacoes', e.target.value || null); }}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------- Página ---------- */
function CadastroCustosPage() {
  const [aba, setAba] = React.useState('elevador');

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
          <button className={aba === 'elevador' ? 'is-active' : ''} onClick={() => setAba('elevador')}>Instalação — Elevadores</button>
          <button className={aba === 'escada' ? 'is-active' : ''} onClick={() => setAba('escada')}>Instalação — Escada/Esteira</button>
          <button className={aba === 'containers' ? 'is-active' : ''} onClick={() => setAba('containers')}>Containers</button>
        </div>
      </div>

      {aba === 'elevador' && <CCElevadorTab/>}
      {aba === 'escada' && <CCEscadaEsteiraTab/>}
      {aba === 'containers' && <CCContainersTab/>}
    </div>
  );
}

window.CadastroCustosPage = CadastroCustosPage;
