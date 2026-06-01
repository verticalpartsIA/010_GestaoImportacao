/* ============================================================
   contrato-editor.jsx — Editor do Contrato do Cliente
   Baseado na MINUTA CONTRATUAL_VERTICALPARTS.pdf (16 páginas)
   Layout: form preenchível (esq) + preview ao vivo (dir)
   ============================================================ */

/* ---------- helpers ---------- */
function brlExtExemplo(v) {
  if (!v) return "___________________";
  const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
  if (isNaN(n)) return v;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataBR(iso) {
  if (!iso) return "__ de __________ de ____";
  const [a, m, d] = iso.split('-');
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return `${parseInt(d)} de ${meses[parseInt(m) - 1]} de ${a}`;
}

function makeDefaultDados(contrato) {
  const d = contrato?.dados || {};
  const hoje = new Date().toISOString().slice(0, 10);
  return {
    // Dados do Contrato
    numero:       d.numero       || contrato?.id || '',
    dataContrato: d.dataContrato || contrato?.issued_date || hoje,
    propostaRef:  d.propostaRef  || contrato?.project_id || '',
    advogado:     d.advogado     || contrato?.lawyer || '',

    // Comprador
    razaoSocial:    d.razaoSocial    || contrato?.client || '',
    cnpj:           d.cnpj           || '',
    logradouro:     d.logradouro     || '',
    numero_end:     d.numero_end     || '',
    bairro:         d.bairro         || '',
    cidade:         d.cidade         || '',
    estado:         d.estado         || 'SP',
    cep:            d.cep            || '',
    responsavel:    d.responsavel    || '',
    rg:             d.rg             || '',
    cpf:            d.cpf            || '',
    nacionalidade:  d.nacionalidade  || 'brasileiro(a)',
    estadoCivil:    d.estadoCivil    || '',
    profissao:      d.profissao      || 'empresário(a)',
    endRespRua:     d.endRespRua     || '',
    endRespNumero:  d.endRespNumero  || '',
    endRespBairro:  d.endRespBairro  || '',
    endRespCidade:  d.endRespCidade  || '',
    endRespEstado:  d.endRespEstado  || 'SP',
    endRespCep:     d.endRespCep     || '',

    // Objeto
    qtdEquip:       d.qtdEquip      || '1',
    modeloEquip:    d.modeloEquip   || '',
    localEntregaRua: d.localEntregaRua || '',
    localEntregaNum: d.localEntregaNum || '',
    localEntregaBairro: d.localEntregaBairro || '',
    localEntregaCidade: d.localEntregaCidade || '',
    localEntregaEstado: d.localEntregaEstado || 'SP',
    localEntregaCep: d.localEntregaCep || '',

    // Preço e Pagamento
    valorTotal:     d.valorTotal    || '',
    valorExtenso:   d.valorExtenso  || '',
    parcelas: d.parcelas || [
      { desc: 'Sinal (assinatura do contrato)', pct: '40', valor: '' },
      { desc: '1ª Parcela', pct: '', valor: '' },
      { desc: '2ª Parcela', pct: '', valor: '' },
      { desc: '3ª Parcela', pct: '', valor: '' },
    ],

    // Assinatura
    cidadeAssinatura: d.cidadeAssinatura || 'São Paulo',
    dataAssinatura:   d.dataAssinatura   || hoje,
    test1Nome: d.test1Nome || '',
    test1Cpf:  d.test1Cpf  || '',
    test2Nome: d.test2Nome || '',
    test2Cpf:  d.test2Cpf  || '',
  };
}

/* ---------- Navegação de seções ---------- */
const SECOES = [
  { id: 'dados',    label: '01 Dados do Contrato', icon: 'file' },
  { id: 'comprador', label: '02 Comprador',         icon: 'user' },
  { id: 'objeto',   label: '03 Objeto',             icon: 'package' },
  { id: 'preco',    label: '04 Preço e Pagamento',  icon: 'dollar' },
  { id: 'assinatura', label: '05 Assinatura',       icon: 'signature' },
];

/* ---------- ContratoClienteEditor ---------- */
function ContratoClienteEditor({ contrato, onSaved }) {
  const [dados, setDados] = React.useState(() => makeDefaultDados(contrato));
  const [secao, setSecao]  = React.useState('dados');
  const [saving, setSaving] = React.useState(false);
  const [signed, setSigned] = React.useState(contrato?.status === 'Assinado');

  const set = (k, v) => setDados(p => ({ ...p, [k]: v }));
  const setParcela = (i, k, v) => setDados(p => {
    const pars = [...p.parcelas];
    pars[i] = { ...pars[i], [k]: v };
    return { ...p, parcelas: pars };
  });
  const addParcela = () => setDados(p => ({
    ...p,
    parcelas: [...p.parcelas, { desc: `${p.parcelas.length}ª Parcela`, pct: '', valor: '' }]
  }));
  const removeParcela = (i) => setDados(p => ({
    ...p,
    parcelas: p.parcelas.filter((_, idx) => idx !== i)
  }));

  const save = async (novoStatus) => {
    setSaving(true);
    const upd = {
      dados,
      client: dados.razaoSocial || contrato?.client,
      project_id: dados.propostaRef || contrato?.project_id,
      lawyer: dados.advogado || contrato?.lawyer,
      value: dados.valorTotal ? parseFloat(dados.valorTotal.replace(/\./g, '').replace(',', '.')) : contrato?.value,
      ...(novoStatus ? { status: novoStatus } : {}),
    };
    const { error } = await window.__VP_SB.sb.from('contratos').update(upd).eq('id', contrato.id);
    setSaving(false);
    if (error) return window.toast('Erro ao salvar: ' + error.message, 'error');
    window.toast(novoStatus === 'Em assinatura digital' ? 'Enviado para assinatura digital!' : 'Contrato salvo!', 'success');
    if (novoStatus === 'Assinado') setSigned(true);
    onSaved?.();
  };

  const exportPdf = () => {
    window.toast('Abrindo impressão — salve como PDF.', 'info');
    setTimeout(() => window.print(), 200);
  };

  const preenchido = dados.razaoSocial && dados.cnpj && dados.modeloEquip && dados.valorTotal;

  return (
    <div className="ce-wrap">
      {/* --- FORM (esquerda) --- */}
      <div className="ce-form">
        <nav className="ce-nav">
          {SECOES.map(s => (
            <button key={s.id} className={"ce-nav__item" + (secao === s.id ? " is-active" : "")}
              onClick={() => setSecao(s.id)}>
              {s.label}
            </button>
          ))}
        </nav>

        <div className="ce-fields">
          {secao === 'dados' && <SecaoDados dados={dados} set={set}/>}
          {secao === 'comprador' && <SecaoComprador dados={dados} set={set}/>}
          {secao === 'objeto' && <SecaoObjeto dados={dados} set={set}/>}
          {secao === 'preco' && <SecaoPreco dados={dados} set={set} setParcela={setParcela} addParcela={addParcela} removeParcela={removeParcela}/>}
          {secao === 'assinatura' && <SecaoAssinatura dados={dados} set={set}/>}
        </div>

        <div className="ce-actions">
          <Button variant="ghost" onClick={() => { const idx = SECOES.findIndex(s => s.id === secao); if (idx > 0) setSecao(SECOES[idx-1].id); }}>← Anterior</Button>
          {SECOES.findIndex(s => s.id === secao) < SECOES.length - 1
            ? <Button variant="outline" onClick={() => { const idx = SECOES.findIndex(s => s.id === secao); setSecao(SECOES[idx+1].id); }}>Próximo →</Button>
            : null
          }
          <div style={{ flex: 1 }}/>
          <Button variant="outline" size="sm" icon="save" onClick={() => save()} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar rascunho'}
          </Button>
        </div>
      </div>

      {/* --- PREVIEW (direita) --- */}
      <div className="ce-preview">
        <div className="ce-preview__toolbar">
          <span className="up-eyebrow muted" style={{ fontSize: 11 }}>PRÉVIA DO CONTRATO</span>
          <div className="row gap-2">
            <Button variant="outline" size="sm" icon="download" onClick={exportPdf}>PDF</Button>
            <Button variant="primary" size="sm" icon="signature"
              onClick={() => save('Em assinatura digital')}
              disabled={!preenchido || saving}>
              Enviar p/ assinatura
            </Button>
          </div>
        </div>

        {signed && (
          <div className="alert success" style={{ margin: '0 0 12px' }}>
            <Icon.check size={14}/> Contrato assinado — fase de Compra desbloqueada.
          </div>
        )}
        {!preenchido && (
          <div className="alert" style={{ margin: '0 0 12px', background: 'var(--vp-gray-50)', borderLeft: '3px solid var(--border)' }}>
            <Icon.info size={14}/> Preencha Comprador, Objeto e Preço para habilitar o envio.
          </div>
        )}

        <ContratoPreview dados={dados}/>

        {/* Botão assinar manualmente (simular retorno de assinatura) */}
        {contrato?.status === 'Em assinatura digital' && !signed && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Button variant="outline" size="sm" icon="check" onClick={() => save('Assinado')}>
              Marcar como assinado
            </Button>
            <p className="small muted" style={{ marginTop: 4 }}>Use quando receber confirmação do cliente</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* --------- Seções do Formulário --------- */

function SecaoDados({ dados, set }) {
  return (
    <div className="ce-section">
      <div className="ce-section__title">Dados do Contrato</div>
      <CeField label="Nº do Contrato" value={dados.numero} onChange={v => set('numero', v)} ph="CTR-001/2026"/>
      <div className="grid-2" style={{ gap:12 }}>
        <CeField label="Data de emissão" type="date" value={dados.dataContrato} onChange={v => set('dataContrato', v)}/>
        <CeField label="Proposta de referência" value={dados.propostaRef} onChange={v => set('propostaRef', v)} ph="PR-2026-001"/>
      </div>
      <CeField label="Advogado responsável" value={dados.advogado} onChange={v => set('advogado', v)} ph="Nome do advogado"/>
    </div>
  );
}

function SecaoComprador({ dados, set }) {
  const UF = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
  return (
    <div className="ce-section">
      <div className="ce-section__title">Identificação do Comprador</div>
      <CeField label="Razão Social *" value={dados.razaoSocial} onChange={v => set('razaoSocial', v)} ph="EMPRESA LTDA"/>
      <CeField label="CNPJ *" value={dados.cnpj} onChange={v => set('cnpj', v)} ph="XX.XXX.XXX/XXXX-XX"/>
      <div className="ce-section__sub">Endereço da Empresa</div>
      <div className="grid-2" style={{ gap:12 }}>
        <CeField label="Logradouro *" value={dados.logradouro} onChange={v => set('logradouro', v)} ph="Rua, Av., Praça…"/>
        <CeField label="Número" value={dados.numero_end} onChange={v => set('numero_end', v)} ph="123"/>
      </div>
      <div className="grid-3" style={{ gap:12 }}>
        <CeField label="Bairro" value={dados.bairro} onChange={v => set('bairro', v)}/>
        <CeField label="Cidade" value={dados.cidade} onChange={v => set('cidade', v)}/>
        <CeFieldSelect label="UF" value={dados.estado} options={UF} onChange={v => set('estado', v)}/>
      </div>
      <CeField label="CEP" value={dados.cep} onChange={v => set('cep', v)} ph="XX.XXX-XX"/>

      <div className="ce-section__sub" style={{ marginTop:16 }}>Representante Legal</div>
      <CeField label="Nome do Responsável *" value={dados.responsavel} onChange={v => set('responsavel', v)} ph="Nome Completo"/>
      <div className="grid-3" style={{ gap:12 }}>
        <CeField label="Nacionalidade" value={dados.nacionalidade} onChange={v => set('nacionalidade', v)} ph="brasileiro(a)"/>
        <CeField label="Estado Civil" value={dados.estadoCivil} onChange={v => set('estadoCivil', v)} ph="casado(a)"/>
        <CeField label="Profissão" value={dados.profissao} onChange={v => set('profissao', v)} ph="empresário(a)"/>
      </div>
      <div className="grid-2" style={{ gap:12 }}>
        <CeField label="RG" value={dados.rg} onChange={v => set('rg', v)} ph="XX.XXX.XXX-X"/>
        <CeField label="CPF" value={dados.cpf} onChange={v => set('cpf', v)} ph="XXX.XXX.XXX-XX"/>
      </div>
      <div className="ce-section__sub">Endereço do Responsável</div>
      <div className="grid-2" style={{ gap:12 }}>
        <CeField label="Rua" value={dados.endRespRua} onChange={v => set('endRespRua', v)}/>
        <CeField label="Número" value={dados.endRespNumero} onChange={v => set('endRespNumero', v)}/>
      </div>
      <div className="grid-3" style={{ gap:12 }}>
        <CeField label="Bairro" value={dados.endRespBairro} onChange={v => set('endRespBairro', v)}/>
        <CeField label="Cidade" value={dados.endRespCidade} onChange={v => set('endRespCidade', v)}/>
        <CeFieldSelect label="UF" value={dados.endRespEstado} options={UF} onChange={v => set('endRespEstado', v)}/>
      </div>
    </div>
  );
}

function SecaoObjeto({ dados, set }) {
  const UF = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
  return (
    <div className="ce-section">
      <div className="ce-section__title">Objeto do Contrato</div>
      <div className="grid-2" style={{ gap:12 }}>
        <CeField label="Quantidade *" type="number" value={dados.qtdEquip} onChange={v => set('qtdEquip', v)} ph="1"/>
        <CeField label="Modelo / Descrição do Equipamento *" value={dados.modeloEquip} onChange={v => set('modeloEquip', v)} ph="Escada Rolante OAK 30° 1000mm…"/>
      </div>
      <div style={{ marginTop: 4 }}>
        <label className="up-eyebrow muted" style={{ fontSize:11 }}>Descrição conforme proposta comercial</label>
        <textarea className="input" rows={3} value={dados.modeloEquip}
          onChange={e => set('modeloEquip', e.target.value)}
          placeholder="Descreva conforme Anexo I e II da proposta: modelo, especificações, inclinação, largura…"
          style={{ marginTop: 4, resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}/>
      </div>
      <div className="ce-section__sub" style={{ marginTop:16 }}>Local de Entrega / Obra</div>
      <div className="grid-2" style={{ gap:12 }}>
        <CeField label="Logradouro *" value={dados.localEntregaRua} onChange={v => set('localEntregaRua', v)} ph="Av., Rua…"/>
        <CeField label="Número" value={dados.localEntregaNum} onChange={v => set('localEntregaNum', v)}/>
      </div>
      <div className="grid-3" style={{ gap:12 }}>
        <CeField label="Bairro" value={dados.localEntregaBairro} onChange={v => set('localEntregaBairro', v)}/>
        <CeField label="Cidade" value={dados.localEntregaCidade} onChange={v => set('localEntregaCidade', v)}/>
        <CeFieldSelect label="UF" value={dados.localEntregaEstado} options={UF} onChange={v => set('localEntregaEstado', v)}/>
      </div>
      <CeField label="CEP" value={dados.localEntregaCep} onChange={v => set('localEntregaCep', v)} ph="XX.XXX-XX"/>
    </div>
  );
}

function SecaoPreco({ dados, set, setParcela, addParcela, removeParcela }) {
  return (
    <div className="ce-section">
      <div className="ce-section__title">Preço e Condições de Pagamento</div>
      <div className="grid-2" style={{ gap:12 }}>
        <CeField label="Valor Total (R$) *" value={dados.valorTotal} onChange={v => set('valorTotal', v)} ph="0,00"/>
        <CeField label="Valor por extenso *" value={dados.valorExtenso} onChange={v => set('valorExtenso', v)} ph="um milhão, duzentos mil reais"/>
      </div>
      <div className="ce-section__sub" style={{ marginTop:16 }}>Cronograma de Pagamento</div>
      <div className="stack" style={{ gap:8 }}>
        {dados.parcelas.map((p, i) => (
          <div key={i} className="ce-parcela">
            <div style={{ flex:2, minWidth:0 }}>
              <input className="input" style={{ fontSize:12 }} value={p.desc}
                onChange={e => setParcela(i, 'desc', e.target.value)} placeholder="Descrição da parcela"/>
            </div>
            <div style={{ width:60 }}>
              <input className="input" style={{ fontSize:12, textAlign:'center' }} value={p.pct}
                onChange={e => setParcela(i, 'pct', e.target.value)} placeholder="%"/>
            </div>
            <div style={{ width:120 }}>
              <input className="input" style={{ fontSize:12 }} value={p.valor}
                onChange={e => setParcela(i, 'valor', e.target.value)} placeholder="R$ 0,00"/>
            </div>
            {dados.parcelas.length > 1 && (
              <button onClick={() => removeParcela(i)} title="Remover"
                style={{ border:'none', background:'none', cursor:'pointer', color:'var(--fg3)', padding:'4px 6px', fontSize:14 }}>×</button>
            )}
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" icon="plus" onClick={addParcela} style={{ marginTop:8 }}>
        Adicionar parcela
      </Button>
    </div>
  );
}

function SecaoAssinatura({ dados, set }) {
  return (
    <div className="ce-section">
      <div className="ce-section__title">Local e Data de Assinatura</div>
      <div className="grid-2" style={{ gap:12 }}>
        <CeField label="Cidade de assinatura" value={dados.cidadeAssinatura} onChange={v => set('cidadeAssinatura', v)} ph="São Paulo"/>
        <CeField label="Data da assinatura" type="date" value={dados.dataAssinatura} onChange={v => set('dataAssinatura', v)}/>
      </div>
      <div className="ce-section__sub" style={{ marginTop:16 }}>Testemunhas</div>
      <div className="grid-2" style={{ gap:12 }}>
        <CeField label="Testemunha 1 — Nome" value={dados.test1Nome} onChange={v => set('test1Nome', v)}/>
        <CeField label="Testemunha 1 — CPF" value={dados.test1Cpf} onChange={v => set('test1Cpf', v)} ph="XXX.XXX.XXX-XX"/>
      </div>
      <div className="grid-2" style={{ gap:12 }}>
        <CeField label="Testemunha 2 — Nome" value={dados.test2Nome} onChange={v => set('test2Nome', v)}/>
        <CeField label="Testemunha 2 — CPF" value={dados.test2Cpf} onChange={v => set('test2Cpf', v)} ph="XXX.XXX.XXX-XX"/>
      </div>
    </div>
  );
}

/* --------- Preview do Contrato --------- */
function ContratoPreview({ dados }) {
  const fill = (v, fallback) => v ? <b>{v}</b> : <span style={{ color:'var(--vp-danger)', fontStyle:'italic' }}>{fallback}</span>;
  const fillB = (v, fallback) => v ? v : fallback;
  const localEntrega = [dados.localEntregaRua, dados.localEntregaNum, dados.localEntregaBairro, dados.localEntregaCidade, dados.localEntregaEstado, dados.localEntregaCep].filter(Boolean).join(', ') || 'ENDEREÇO NÃO PREENCHIDO';
  const endEmpresa = [dados.logradouro, dados.numero_end, dados.bairro, dados.cidade, dados.estado, dados.cep].filter(Boolean).join(', ') || 'ENDEREÇO NÃO PREENCHIDO';
  const endResp = [dados.endRespRua, dados.endRespNumero, dados.endRespBairro, dados.endRespCidade, dados.endRespEstado].filter(Boolean).join(', ') || 'ENDEREÇO NÃO PREENCHIDO';

  return (
    <div className="ce-doc">
      {/* CAPA */}
      <div className="ce-page">
        <div className="ce-page__stamp">CONTRATO · CAPA</div>
        <h2 className="ce-title">CONTRATO DE COMPRA E VENDA DE EQUIPAMENTOS E PRESTAÇÃO DE SERVIÇOS DE INSTALAÇÃO</h2>
        <p className="ce-subtitle">Nº do Contrato: {fill(dados.numero, 'XXXX/2026')}</p>
        <div className="ce-divider"/>
        <p className="ce-body">Pelo presente instrumento particular e na melhor forma de direito, as partes a seguir nomeadas:</p>
        <p className="ce-body"><strong>VENDEDORA:</strong> VERTICAL PARTS – INDUSTRIA E COMMERCIO DE PEÇAS PARA ESCADAS, ESTEIRAS ROLANTES E ELEVADORES LTDA-ME, inscrita no CNPJ sob o nº 15.822.325/0001-27, com sede à Rua Armandina Braga de Almeida, nº 383, Jd. Santa Emilia, Guarulhos/SP, CEP 07.141-003, representada por DIEGO YUTAKA MAENO.</p>
        <p className="ce-body"><strong>COMPRADOR:</strong> {fill(dados.razaoSocial, 'RAZÃO SOCIAL')}, inscrito no CNPJ sob o nº {fill(dados.cnpj, 'XX.XXX.XXX/XXXX-XX')}, com sede à {endEmpresa}, neste ato representado por {fill(dados.responsavel, 'NOME DO RESPONSÁVEL')}, {fillB(dados.nacionalidade,'___')}, {fillB(dados.estadoCivil,'___')}, {fillB(dados.profissao,'___')}, portador do RG nº {fillB(dados.rg,'___')}, inscrito no CPF nº {fillB(dados.cpf,'___')}, residente em {endResp}.</p>
        <p className="ce-body">Têm, entre si, certo e ajustado o presente Contrato, o qual se regerá pelas disposições do Código Civil e demais condições abaixo.</p>
      </div>

      {/* CLÁUSULA 1 — OBJETO */}
      <div className="ce-page">
        <div className="ce-page__stamp">CLÁUSULA 1 · OBJETO</div>
        <h3 className="ce-clause-title">1 – OBJETO DO CONTRATO</h3>
        <p className="ce-body"><span className="ce-n">1.1.</span> O objeto deste Contrato consiste no descrito a seguir:</p>
        <ul className="ce-list">
          <li>Compra e venda de {fill(dados.qtdEquip,'0X')} ({fillB(dados.qtdEquip,'__')}) equipamento(s), {fill(dados.modeloEquip,'MODELO / DESCRIÇÃO DO EQUIPAMENTO')}, denominados "equipamentos", conforme especificações dos Anexos I e II.</li>
          <li>Modalidade: <strong>"CIF"</strong> (Cost, Insurance and Freight).</li>
          <li>Instalação dos equipamentos de forma a entregá-los ao COMPRADOR em condições de uso imediato ("turn key").</li>
        </ul>
        <p className="ce-body"><span className="ce-n">1.1.1.</span> <strong>LOCAL DE ENTREGA:</strong> {fill(localEntrega !== 'ENDEREÇO NÃO PREENCHIDO' ? localEntrega : null, 'ENDEREÇO COMPLETO DO LOCAL DE ENTREGA')}</p>
        <p className="ce-body"><span className="ce-n">1.2.</span> Proposta Comercial de referência: {fill(dados.propostaRef,'XXXX/2026')}</p>
      </div>

      {/* CLÁUSULA 3 — PREÇO */}
      <div className="ce-page">
        <div className="ce-page__stamp">CLÁUSULA 3 · PREÇO E PAGAMENTO</div>
        <h3 className="ce-clause-title">3 – PREÇO E CONDIÇÕES DE PAGAMENTO</h3>
        <p className="ce-body"><span className="ce-n">3.1.</span> Pela compra dos equipamentos e prestação dos serviços, o COMPRADOR pagará à VENDEDORA o valor total de {fill(dados.valorTotal ? `R$ ${dados.valorTotal}` : null, 'R$ XXX.XXX,XX')} ({fill(dados.valorExtenso, 'valor por extenso')}). O pagamento deverá ser efetuado conforme cronograma abaixo:</p>
        <table className="ce-table">
          <thead><tr><th>Parcela</th><th>%</th><th>Valor</th></tr></thead>
          <tbody>
            {dados.parcelas.map((p,i) => (
              <tr key={i}>
                <td>{p.desc || `Parcela ${i+1}`}</td>
                <td>{p.pct ? p.pct + '%' : '—'}</td>
                <td><b>{p.valor ? `R$ ${p.valor}` : '—'}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="ce-body"><span className="ce-n">3.3.</span> Formas de pagamento: boleto, depósito bancário ou transferência eletrônica.</p>
        <p className="ce-body"><span className="ce-n">3.4.</span> Penalidades por atraso: multa de 2%, juros de 1% a.m. calculado pro rata die e correção pelo IGPM.</p>
      </div>

      {/* RESUMO — ENTREGA */}
      <div className="ce-page">
        <div className="ce-page__stamp">CLÁUSULA 2 · ENTREGA E INSTALAÇÃO</div>
        <h3 className="ce-clause-title">2 – INFORMAÇÕES SOBRE ENTREGA E INSTALAÇÃO</h3>
        <p className="ce-body"><span className="ce-n">2.5.</span> <strong>Prazo de entrega na obra:</strong> 120 (cento e vinte) a 150 (cento e cinquenta) dias, a contar da data em que o último requisito for preenchido: assinatura do Contrato, pagamento do sinal e aprovação do projeto.</p>
        <p className="ce-body"><span className="ce-n">2.5.1.</span> Caso a VENDEDORA não realize a entrega no prazo convencionado, ficará sujeita ao pagamento de multa moratória diária de 0,05% limitado a 2% sobre o valor do(s) equipamento(s) em atraso.</p>
        <p className="ce-body"><span className="ce-n">6.1.</span> <strong>Garantia:</strong> 90 dias a contar da assinatura do Termo de Conclusão da Instalação, podendo ser estendida por mais 9 meses sob assistência técnica homologada.</p>
      </div>

      {/* ASSINATURA */}
      <div className="ce-page">
        <div className="ce-page__stamp">ASSINATURA</div>
        <h3 className="ce-clause-title">ASSINATURA DAS PARTES</h3>
        <p className="ce-body">{fill(dados.cidadeAssinatura,'___')}, {dataBR(dados.dataAssinatura)}</p>
        <div className="ce-sign-block">
          <div className="ce-sign-line">
            <div className="ce-sign-line__bar"/>
            <div>VERTICAL PARTS – VENDEDORA</div>
            <div className="small muted">DIEGO YUTAKA MAENO · CPF: 249.432.208-19</div>
          </div>
          <div className="ce-sign-line">
            <div className="ce-sign-line__bar"/>
            <div>{fill(dados.razaoSocial,'COMPRADOR')}</div>
            <div className="small muted">{fillB(dados.responsavel,'____________________')} · CPF: {fillB(dados.cpf,'___')}</div>
          </div>
        </div>
        <div className="ce-sign-block" style={{ marginTop:32 }}>
          <div className="ce-sign-line">
            <div className="ce-sign-line__bar"/>
            <div>Testemunha 1: {fillB(dados.test1Nome,'____________________')}</div>
            <div className="small muted">CPF: {fillB(dados.test1Cpf,'___')}</div>
          </div>
          <div className="ce-sign-line">
            <div className="ce-sign-line__bar"/>
            <div>Testemunha 2: {fillB(dados.test2Nome,'____________________')}</div>
            <div className="small muted">CPF: {fillB(dados.test2Cpf,'___')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------- Primitivos do form --------- */
function CeField({ label, value, onChange, type = 'text', ph = '' }) {
  return (
    <div className="stack" style={{ gap:4, marginBottom:10 }}>
      <label className="up-eyebrow muted" style={{ fontSize:10 }}>{label}</label>
      <input className="input" type={type} value={value} placeholder={ph}
        onChange={e => onChange(e.target.value)}/>
    </div>
  );
}
function CeFieldSelect({ label, value, options, onChange }) {
  return (
    <div className="stack" style={{ gap:4, marginBottom:10 }}>
      <label className="up-eyebrow muted" style={{ fontSize:10 }}>{label}</label>
      <select className="input" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

Object.assign(window, { ContratoClienteEditor });
