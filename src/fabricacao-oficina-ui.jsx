/* ============================================================
   fabricacao-oficina-ui.jsx — peças visuais compartilhadas das telas
   Fabricação Corrimão/Corte (internas) e da página pública do chão de
   fábrica (22/10/2026). Só apresentação: nenhum cálculo mora aqui
   (ver window.FabOficinaCalc). window.FabOficinaUI
   ============================================================ */
(function () {
  'use strict';

  const CSS = `
.fo-card{border:1px solid var(--border,#ddd);border-radius:10px;background:var(--bg-elev,var(--bg,#fff));padding:16px 18px;margin-bottom:14px}
.fo-head{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
.fo-tit{font-size:14px;font-weight:700}
.fo-sub{font-size:13px;color:var(--fg2,#555);margin-top:2px}
.fo-meta{font-size:12px;color:var(--fg3,#777);margin-top:2px}
.fo-pct{font-size:20px;font-weight:700}
.fo-trilha{display:flex;margin-top:16px;overflow-x:auto;padding-bottom:4px}
.fo-passo{flex:1 0 96px;min-width:96px;display:flex;flex-direction:column;align-items:center;text-align:center;position:relative;cursor:pointer}
.fo-passo.is-disabled{cursor:default}
.fo-passo::before{content:"";position:absolute;top:13px;left:-50%;width:100%;height:3px;background:var(--border,#ddd);z-index:0}
.fo-passo:first-child::before{display:none}
.fo-passo.is-ok::before{background:#16a34a}
.fo-cb{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.fo-no{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:700;z-index:1;border:2px solid var(--border,#ddd);background:var(--bg-elev,var(--bg,#fff));color:var(--fg3,#777)}
.fo-no.feito{background:#16a34a;border-color:#16a34a;color:#fff}
.fo-no.atual{border-color:#f59e0b;background:#fef3c7;color:#92400e;animation:fo-pulso 1.8s infinite}
.fo-no.atual.pausado{border-color:#dc2626;background:#fee2e2;color:#991b1b}
@keyframes fo-pulso{0%{box-shadow:0 0 0 0 rgba(245,158,11,.55)}70%{box-shadow:0 0 0 9px rgba(245,158,11,0)}100%{box-shadow:0 0 0 0 rgba(245,158,11,0)}}
@media (prefers-reduced-motion: reduce){.fo-no.atual{animation:none}}
.fo-rot{font-size:11.5px;font-weight:600;margin-top:6px;line-height:1.25;padding:0 4px}
.fo-dt{font-size:11px;color:var(--fg3,#777);margin-top:2px}
.fo-box{margin-top:14px;border-top:1px dashed var(--border,#ddd);padding-top:10px}
.fo-box h4{font-size:13px;margin:0 0 6px}
.fo-oc{display:flex;gap:10px;align-items:flex-start;padding:6px 0;font-size:12.5px}
.fo-dot{width:9px;height:9px;border-radius:50%;flex:0 0 9px;margin-top:4px;background:#16a34a}
.fo-dot.aberta{background:#f59e0b}.fo-dot.aberta.sem{background:#dc2626}
.fo-form{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}
.fo-in{padding:7px 10px;border:1px solid var(--border,#ccc);border-radius:6px;font-size:13px;background:var(--bg-elev,#fff);color:inherit}
.fo-btn{padding:7px 12px;border:1px solid var(--border,#ccc);border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;background:var(--bg-elev,#fff);color:inherit}
.fo-btn.primario{background:#111;color:#fff;border-color:#111}
.fo-btn:disabled{opacity:.5;cursor:default}
.fo-ok{display:inline-flex;gap:6px;font-size:12.5px;font-weight:700;color:#0a7a3d;background:#dcfce7;border-radius:999px;padding:4px 12px;margin-top:8px}
.fo-pausa{display:inline-flex;font-size:12.5px;font-weight:700;color:#991b1b;background:#fee2e2;border-radius:999px;padding:4px 12px;margin-top:8px}
`;

  function fmtData(v) { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR'); }
  function fmtDataHora(v) { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toLocaleString('pt-BR'); }

  /* Trilha de etapas clicáveis. onToggle(etapaId, marcar) */
  function Trilha({ etapas, pausado, podeDesmarcar, busy, onToggle }) {
    const atualId = window.FabOficinaCalc.etapaAtualId(etapas);
    return (
      <div className="fo-trilha">
        {etapas.map((e) => {
          const bloqueado = busy || (e.flegado && !podeDesmarcar);
          const cls = ['fo-no'];
          if (e.flegado) cls.push('feito'); else if (e.id === atualId) { cls.push('atual'); if (pausado) cls.push('pausado'); }
          return (
            <label key={e.id} className={'fo-passo' + (e.flegado ? ' is-ok' : '') + (bloqueado ? ' is-disabled' : '')}
              title={e.texto + (e.flegado ? ' — concluída' : e.id === atualId ? ' — etapa atual' : '')}>
              <input type="checkbox" className="fo-cb" checked={e.flegado} disabled={bloqueado}
                onChange={(ev) => onToggle(e.id, ev.target.checked)} aria-label={e.texto} />
              <span className={cls.join(' ')} aria-hidden="true">{e.flegado ? '✓' : e.id === atualId ? '●' : ''}</span>
              <span className="fo-rot">{e.texto}</span>
              {e.flegado && <span className="fo-dt">{fmtData(e.flegado_em) || 'sem data'}</span>}
            </label>
          );
        })}
      </div>
    );
  }

  /* Ocorrências de falta de material + formulário de nova + "Chegou — resolver". */
  function Ocorrencias({ ocorrencias, busy, onAbrir, onResolver }) {
    const [aberto, setAberto] = React.useState(false);
    const [f, setF] = React.useState({ codigo: '', descricao: '', frente: true });
    const enviar = async () => {
      if (!f.codigo.trim()) { window.toast?.('Informe o material em falta.'); return; }
      await onAbrir(f.codigo.trim(), f.descricao.trim(), f.frente);
      setF({ codigo: '', descricao: '', frente: true }); setAberto(false);
    };
    return (
      <div className="fo-box">
        <h4>Falta de material</h4>
        {(ocorrencias || []).length === 0 && <div className="fo-meta">Nenhuma ocorrência.</div>}
        {(ocorrencias || []).map((o) => (
          <div className="fo-oc" key={o.id}>
            <span className={'fo-dot ' + o.status + (o.status === 'aberta' && !o.tem_frente_trabalho ? ' sem' : '')} />
            <div style={{ flex: 1 }}>
              <b>{o.codigo_produto}</b>{o.descricao_produto ? ' — ' + o.descricao_produto : ''}
              <div className="fo-meta">{o.status === 'aberta' ? (o.tem_frente_trabalho ? 'Falta, mas há outra frente de trabalho' : 'Falta — produção PAUSADA') : 'Resolvida ' + (fmtDataHora(o.resolvida_em) || '')} · aberta {fmtDataHora(o.aberta_em)}</div>
            </div>
            {o.status === 'aberta' && <button className="fo-btn" disabled={busy} onClick={() => onResolver(o.id)}>Chegou — resolver</button>}
          </div>
        ))}
        {!aberto && <button className="fo-btn" onClick={() => setAberto(true)}>Relatar falta de material</button>}
        {aberto && (
          <div className="fo-form">
            <input className="fo-in" placeholder="Código do material" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} />
            <input className="fo-in" placeholder="Descrição (opcional)" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} style={{ minWidth: 200 }} />
            <label style={{ fontSize: 12.5 }}><input type="checkbox" checked={f.frente} onChange={(e) => setF({ ...f, frente: e.target.checked })} /> há outra frente de trabalho (não pausa)</label>
            <button className="fo-btn primario" disabled={busy} onClick={enviar}>Enviar</button>
            <button className="fo-btn" onClick={() => setAberto(false)}>Cancelar</button>
          </div>
        )}
      </div>
    );
  }

  /* Sobra do Corte. */
  function Sobra({ sobra, busy, onSalvar }) {
    const [q, setQ] = React.useState(sobra ? String(sobra.quantidade) : '');
    const [obs, setObs] = React.useState(sobra && sobra.obs ? sobra.obs : '');
    return (
      <div className="fo-box">
        <h4>Sobra do corte</h4>
        <div className="fo-form" style={{ marginTop: 0 }}>
          <input className="fo-in" type="number" min="0" step="any" placeholder="Quanto sobrou" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 130 }} />
          <input className="fo-in" placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} style={{ minWidth: 200 }} />
          <button className="fo-btn" disabled={busy || q === '' || Number(q) < 0} onClick={() => onSalvar(q, obs)}>{sobra ? 'Atualizar sobra' : 'Registrar sobra'}</button>
        </div>
        {sobra && <div className="fo-meta">Registrado: sobraram {sobra.quantidade}{sobra.obs ? ' — ' + sobra.obs : ''}</div>}
        <div className="fo-meta">Sem sobra? Não precisa registrar.</div>
      </div>
    );
  }

  window.FabOficinaUI = { CSS, fmtData, fmtDataHora, Trilha, Ocorrencias, Sobra };
})();
