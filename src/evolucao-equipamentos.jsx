/* ============================================================
   evolucao-equipamentos.jsx — 2ª aba do Mapa de Obras (19/10/2026):
   "Evolução dos equipamentos". Uma linha do tempo por equipamento
   (equipamentos_obra; dossiê sem equipamento cadastrado = 1 linha),
   agrupada em: em instalação, a caminho da obra e já entregues.
   Só leitura. Regras em evolucao-equipamentos-calc.js.
   Fontes: dossier_obra (via Mapa de Obras), equipamentos_obra,
   embarques_importacao (pelo Nº da cotação; nas obras antigas, temporariamente,
   pelo nº de série da P.I.) e o Diário de Obra
   (AcompanhamentoObraStore.resumoProgressoBatch).
   ============================================================ */

const EV_GRUPOS = [
  { key: "andamento", titulo: "Em instalação", sub: "Equipamentos sendo montados agora" },
  { key: "aguardando", titulo: "A caminho da obra", sub: "Contrato assinado, importação ou homologação do instalador" },
  { key: "concluida", titulo: "Já entregues", sub: "Instalação concluída" },
];

const EV_CSS = `
.ev-card{border:1px solid var(--border);border-radius:10px;background:var(--bg-elev, var(--bg, #fff));padding:16px 18px;margin-bottom:12px;position:relative;overflow:hidden}
.ev-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--ev-cor)}
.ev-head{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
.ev-serie{font-family:var(--font-mono, ui-monospace, monospace);font-weight:700;font-size:14px}
.ev-tit{font-size:13px;color:var(--fg2);margin-top:2px}
.ev-meta{font-size:12px;color:var(--fg3);margin-top:2px}
.ev-pct{display:flex;align-items:center;gap:10px}
.ev-anel{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;color:var(--fg1)}
.ev-anel>span{width:36px;height:36px;border-radius:50%;background:var(--bg-elev, var(--bg, #fff));display:grid;place-items:center}
.ev-trilha{display:flex;margin-top:16px;overflow-x:auto;padding-bottom:4px}
.ev-passo{flex:1 0 96px;min-width:96px;display:flex;flex-direction:column;align-items:center;text-align:center;position:relative}
.ev-passo::before{content:"";position:absolute;top:12px;left:-50%;width:100%;height:3px;background:var(--border);z-index:0}
.ev-passo:first-child::before{display:none}
.ev-passo.is-ok::before{background:#16a34a}
.ev-no{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:700;z-index:1;border:2px solid var(--border);background:var(--bg-elev, var(--bg, #fff));color:var(--fg3)}
.ev-no.feito{background:#16a34a;border-color:#16a34a;color:#fff}
.ev-no.pulado{background:#bbf7d0;border-color:#16a34a;color:#166534}
.ev-no.previsto{border-style:dashed;border-color:#2563eb;color:#2563eb}
.ev-no.atual{border-color:#f59e0b;background:#fef3c7;color:#92400e;box-shadow:0 0 0 0 rgba(245,158,11,.55);animation:ev-pulso 1.8s infinite}
.ev-no.atual.atraso{border-color:#dc2626;background:#fee2e2;color:#991b1b;box-shadow:0 0 0 0 rgba(220,38,38,.5)}
@keyframes ev-pulso{0%{box-shadow:0 0 0 0 rgba(245,158,11,.55)}70%{box-shadow:0 0 0 9px rgba(245,158,11,0)}100%{box-shadow:0 0 0 0 rgba(245,158,11,0)}}
@media (prefers-reduced-motion: reduce){.ev-no.atual{animation:none}}
.ev-rot{font-size:11.5px;font-weight:600;margin-top:6px;color:var(--fg1);line-height:1.25;padding:0 4px}
.ev-dt{font-size:11px;color:var(--fg3);margin-top:2px}
.ev-dt.prev{color:#2563eb}
.ev-dt.atraso{color:#dc2626;font-weight:600}
.ev-grupo-h{display:flex;align-items:baseline;gap:10px;margin:22px 0 10px}
.ev-grupo-h h2{font-size:16px;margin:0}
.ev-grupo-h span{font-size:12px;color:var(--fg3)}
.ev-legenda{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--fg2)}
.ev-legenda i{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px;vertical-align:-2px;border:2px solid var(--border)}
`;

const evData = (d) => (d ? d.toLocaleDateString("pt-BR") : "");

function EvPasso({ p, atual, atrasada, ok }) {
  const cls = ["ev-no", p.estado];
  if (atual) { cls.push("atual"); if (atrasada) cls.push("atraso"); }
  const icone = p.estado === "feito" || p.estado === "pulado" ? "✓" : atual ? "●" : "";
  let dt = "—", dtCls = "ev-dt";
  if (p.estado === "feito") dt = p.data ? evData(p.data) : "sem data";
  else if (p.estado === "pulado") dt = "sem data";
  else if (p.estado === "previsto" && p.data) { dt = "prev. " + evData(p.data); dtCls += atual && atrasada ? " atraso" : " prev"; }
  else if (atual) dt = "agora";
  return (
    <div className={"ev-passo" + (ok ? " is-ok" : "")} title={p.rotulo + (dt && dt !== "—" ? " — " + dt : "")}>
      <div className={cls.join(" ")} aria-hidden="true">{icone}</div>
      <div className="ev-rot">{p.rotulo}</div>
      <div className={dtCls}>{atual && atrasada ? "atrasada · " + dt.replace("prev. ", "") : dt}</div>
    </div>
  );
}


/* Espinha de peixe (Ishikawa) das ocorrências do equipamento: cada espinha é uma categoria,
   a cabeça é o efeito (atraso). As espinhas sem ocorrência ficam cinza — já estão no desenho
   para receber as Ocorrências de Obra e os atrasos combinados de projeto/contrato. */
const EV_GRAV_COR = { alta: "#dc2626", media: "#d97706" };
function EvEspinha({ oc }) {
  const C = window.EvolucaoEquipamentosCalc;
  const cats = C.CATEGORIAS_OCORRENCIA;
  const [aberto, setAberto] = React.useState(false);
  if (!oc || !oc.lista.length) return <div className="ev-meta" style={{ marginTop: 10 }}>Sem ocorrências ou atrasos registrados.</div>;
  const corCat = (k) => {
    const l = oc.porCategoria[k] || [];
    if (!l.length) return "var(--border)";
    return l.some((o) => o.gravidade === "alta") ? EV_GRAV_COR.alta : EV_GRAV_COR.media;
  };
  const Y = 72, X0 = 16, XH = 590;
  const xs = [110, 215, 320, 425, 530];
  return (
    <div style={{ marginTop: 12, borderTop: "1px dashed var(--border)", paddingTop: 10 }}>
      <button type="button" className="btn btn--sm btn--ghost" onClick={() => setAberto((v) => !v)} style={{ padding: "2px 6px" }}>
        {aberto ? "▾" : "▸"} Ocorrências e atrasos: <b style={{ marginLeft: 4, color: EV_GRAV_COR[oc.lista.some((o) => o.gravidade === "alta") ? "alta" : "media"] }}>{oc.lista.length}</b>
        {oc.diasAtraso > 0 && <span style={{ marginLeft: 6, color: "var(--fg3)" }}>· ~{oc.diasAtraso} dia(s) de atraso conhecido</span>}
      </button>
      {aberto && (
        <div>
          <svg viewBox="0 0 760 150" style={{ width: "100%", maxWidth: 760, height: "auto", display: "block", marginTop: 6 }} role="img" aria-label="Espinha de peixe das ocorrências">
            <line x1={X0} y1={Y} x2={XH} y2={Y} stroke="var(--fg3)" strokeWidth="3"/>
            <polygon points={`${XH},${Y - 8} ${XH + 14},${Y} ${XH},${Y + 8}`} fill="var(--fg3)"/>
            <rect x={XH + 16} y={Y - 30} width="140" height="60" rx="8" fill="none" stroke={EV_GRAV_COR.alta} strokeWidth="2"/>
            <text x={XH + 86} y={Y - 8} textAnchor="middle" style={{ fontSize: 13, fontWeight: 700, fill: EV_GRAV_COR.alta }}>Atraso</text>
            <text x={XH + 86} y={Y + 12} textAnchor="middle" style={{ fontSize: 12, fill: "var(--fg2)" }}>{oc.diasAtraso > 0 ? `~${oc.diasAtraso} dia(s)` : "sem dias medidos"}</text>
            {cats.map((c, i) => {
              const cima = i % 2 === 0;
              const x = xs[i], yp = cima ? 14 : 136;
              const n = (oc.porCategoria[c.key] || []).length;
              const cor = corCat(c.key);
              return (
                <g key={c.key}>
                  <line x1={x - 46} y1={yp} x2={x} y2={Y} stroke={cor} strokeWidth={n ? 3 : 2}/>
                  <text x={x - 46} y={cima ? yp - 2 : yp + 12} textAnchor="middle" style={{ fontSize: 11.5, fontWeight: n ? 700 : 500, fill: n ? cor : "var(--fg3)" }}>
                    {c.rotulo}{n ? ` (${n})` : ""}
                  </text>
                </g>
              );
            })}
          </svg>
          <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
            {cats.filter((c) => (oc.porCategoria[c.key] || []).length).map((c) => (oc.porCategoria[c.key]).map((o, j) => (
              <div key={c.key + j} style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: EV_GRAV_COR[o.gravidade] || EV_GRAV_COR.media, flex: "0 0 8px", transform: "translateY(-1px)" }}/>
                <span style={{ color: "var(--fg3)", minWidth: 132 }}>{c.rotulo}</span>
                <span><b>{o.titulo}</b>{o.detalhe ? " — " + o.detalhe : ""}</span>
              </div>
            )))}
          </div>
          <div className="ev-meta" style={{ marginTop: 6 }}>Por enquanto só aparecem as ocorrências que o sistema já registra (rolagem do navio, mudança de ETA, canal da aduana, previsões vencidas). Ocorrências de Obra e atrasos combinados de projeto/contrato entram aqui quando forem lançados.</div>
        </div>
      )}
    </div>
  );
}

function EvCard({ item, onAbrirDossie, onVerNoMapa }) {
  const S = window.MapaObrasCalc.SITUACOES[item.obra.situacao];
  const { linha } = item;
  const idxAtual = linha.passos.findIndex((p) => p.key === linha.atualKey);
  const o = item.obra;
  const pct = linha.pct;
  return (
    <div className="ev-card" style={{ "--ev-cor": S.cor }}>
      <div className="ev-head">
        <div style={{ minWidth: 0, flex: "1 1 320px" }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span className="ev-serie">{item.serie || "Equipamento sem nº de série"}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: S.cor, border: `1px solid ${S.cor}`, borderRadius: 999, padding: "1px 8px" }}>{S.rotulo}</span>
            {linha.atrasada && <span style={{ fontSize: 11, fontWeight: 600, color: "#dc2626", border: "1px solid #dc2626", borderRadius: 999, padding: "1px 8px" }}>Previsão vencida</span>}
          </div>
          <div className="ev-tit">{[o.client_name, o.building_name].filter(Boolean).join(" — ") || o.id}</div>
          <div className="ev-meta">
            {[o.city && o.state ? `${String(o.city).trim()}/${String(o.state).trim()}` : null, o.status_master ? "Fase: " + o.status_master : null,
              o.instaladores && o.instaladores.length ? "Instalador: " + o.instaladores.join(", ") : null,
              o.vistorias ? `${o.vistorias} vistoria(s) concluída(s)` : null].filter(Boolean).join(" · ")}
          </div>
          {item.embarque && (
            <div className="ev-meta" title={item.origemEmbarque === "serie" ? "Ligado pelo nº de série gravado na P.I. (provisório, até a obra ter Nº de cotação)" : "Ligado pelo Nº da cotação"}>
              Embarque: <b style={{ color: "var(--fg2)" }}>{String(item.embarque.nome_embarque || "").trim() || "sem nome"}</b>
              {item.origemEmbarque === "serie" ? " · pelo nº de série da P.I." : " · pela cotação"}
            </div>
          )}
        </div>
        <div className="ev-pct">
          {o.situacao !== "aguardando" && (
            <div className="ev-anel" title="Andamento da instalação (Diário de Obra)" style={{ background: `conic-gradient(${S.cor} ${pct * 3.6}deg, var(--border) 0)` }}>
              <span>{pct}%</span>
            </div>
          )}
          <div className="row" style={{ gap: 6 }}>
            <Button variant="outline" size="sm" icon="pin" onClick={() => onVerNoMapa(o.id)}>Ver no mapa</Button>
            <Button variant="ghost" size="sm" icon="chevRight" onClick={() => onAbrirDossie(o.id)}>Dossiê</Button>
          </div>
        </div>
      </div>
      <div className="ev-trilha" role="list" aria-label="Linha do tempo do equipamento">
        {linha.passos.map((p, i) => (
          <EvPasso key={p.key} p={p} atual={i === idxAtual} atrasada={linha.atrasada}
            ok={idxAtual === -1 ? true : i <= idxAtual} />
        ))}
      </div>
      <EvEspinha oc={item.oc}/>
    </div>
  );
}

/* Carrega e monta as linhas do tempo + ocorrências. Usado pelo Mapa de Obras (uma carga só,
   compartilhada entre o mapa e a aba Evolução). */
function useEvolucaoItens(obras) {
  const [extra, setExtra] = React.useState(null);
  const [erro, setErro] = React.useState(null);

  React.useEffect(() => {
    if (!obras) return undefined;
    let vivo = true;
    const sb = (window.__VP_SB || {}).sb;
    if (!sb) { setErro("Banco de dados indisponível."); return undefined; }
    const ids = obras.map((o) => o.id);
    const cotacoes = Array.from(new Set(obras.map((o) => o.numero_cotacao).filter((n) => n != null)));
    (async () => {
      try {
        const [eqRes, embRes, prog] = await Promise.all([
          ids.length ? sb.from("equipamentos_obra").select("id, dossier_id, numero_serie, tipo, previsao_chegada_material, chegada_real_material, previsao_inicio, data_real_inicio, previsao_termino, data_real_termino").in("dossier_id", ids) : { data: [] },
          cotacoes.length ? sb.from("embarques_importacao").select("id, nome_embarque, numero_cotacao, etd_original, etd_atual, eta_santos, data_entrega, data_limite_entrega, arquivado, updated_at, created_at, houve_rolagem, historico_rolagens, historico_eta, canal_parametrizacao").in("numero_cotacao", cotacoes) : { data: [] },
          window.AcompanhamentoObraStore && ids.length ? window.AcompanhamentoObraStore.resumoProgressoBatch(ids).catch(() => ({})) : {},
        ]);
        if (eqRes.error) throw eqRes.error;
        if (embRes.error) throw embRes.error;
        /* TEMPORÁRIO: obras sem Nº de cotação acham o embarque pelo nº de série gravado na P.I.
           (pi_importacao.numeros_serie → embarque_id). A regra definitiva é pela cotação. */
        let pis = [], embSerie = [];
        const series = Array.from(new Set((eqRes.data || []).flatMap((e) => {
          const t = String(e.numero_serie || "").trim();
          return t ? [t, String(e.numero_serie)] : [];
        })));
        if (series.length) {
          try {
            const piRes = await sb.from("pi_importacao").select("id, numeros_serie, embarque_id").overlaps("numeros_serie", series).not("embarque_id", "is", null);
            if (piRes.error) throw piRes.error;
            pis = piRes.data || [];
            const embIds = Array.from(new Set(pis.map((p) => p.embarque_id)));
            if (embIds.length) {
              const r = await sb.from("embarques_importacao").select("id, nome_embarque, numero_cotacao, etd_original, etd_atual, eta_santos, data_entrega, data_limite_entrega, arquivado, updated_at, created_at, houve_rolagem, historico_rolagens, historico_eta, canal_parametrizacao").in("id", embIds);
              if (r.error) throw r.error;
              embSerie = r.data || [];
            }
          } catch (e) { console.warn("[Evolução] embarque pelo nº de série não carregou", e); }
        }
        if (vivo) { setExtra({ equips: eqRes.data || [], embarques: embRes.data || [], pis, embSerie, prog: prog || {} }); setErro(null); }
      } catch (e) {
        if (vivo) { setErro("Não foi possível carregar a evolução: " + (e.message || e)); setExtra({ equips: [], embarques: [], pis: [], embSerie: [], prog: {} }); }
      }
    })();
    return () => { vivo = false; };
  }, [obras]);

  const itens = React.useMemo(() => {
    if (!obras || !extra) return [];
    const C = window.EvolucaoEquipamentosCalc;
    const eqPor = {}, embPor = {};
    extra.equips.forEach((e) => { (eqPor[e.dossier_id] = eqPor[e.dossier_id] || []).push(e); });
    extra.embarques.forEach((e) => { (embPor[e.numero_cotacao] = embPor[e.numero_cotacao] || []).push(e); });
    const porSerie = C.embarquesPorSerie(extra.pis || [], extra.embSerie || []);
    const out = [];
    obras.forEach((o) => {
      const embCot = C.escolherEmbarque(embPor[o.numero_cotacao]);
      const montar = (e) => {
        const emb = C.embarqueDoEquipamento(embCot, porSerie, e && e.numero_serie);
        const linha = C.montarLinha(o, e, { embarque: emb.embarque, progresso: extra.prog[o.id] });
        return { embarque: emb.embarque, origemEmbarque: emb.origem, linha, oc: C.ocorrencias(emb.embarque, linha, {}) };
      };
      const lista = (eqPor[o.id] || []).slice().sort((a, b) => String(a.numero_serie || "").localeCompare(String(b.numero_serie || ""), "pt-BR", { numeric: true }));
      if (!lista.length) out.push({ key: o.id, obra: o, serie: null, ...montar(null) });
      else lista.forEach((e) => out.push({ key: o.id + ":" + e.id, obra: o, serie: e.numero_serie, ...montar(e) }));
    });
    return out;
  }, [obras, extra]);

  return { itens, erro, carregado: !!(obras && extra) };
}

function EvolucaoEquipamentos({ obras, dados, onAbrirDossie, onVerNoMapa }) {
  const { itens, erro, carregado } = dados || { itens: [], erro: null, carregado: false };
  const extra = carregado;
  const [busca, setBusca] = React.useState("");
  const [ver, setVer] = React.useState({ andamento: true, aguardando: true, concluida: true });
  const [soOc, setSoOc] = React.useState(false);

  const q = busca.trim().toLowerCase();
  const filtrados = itens.filter((it) => {
    if (!ver[it.obra.situacao]) return false;
    if (soOc && !it.oc.lista.length) return false;
    if (!q) return true;
    const o = it.obra;
    return [it.serie, it.embarque && it.embarque.nome_embarque, o.id, o.client_name, o.building_name, o.city, o.status_master, (o.instaladores || []).join(" "), o.numero_cotacao]
      .filter((x) => x != null).join(" ").toLowerCase().includes(q);
  });

  const proximaData = (it) => {
    const p = it.linha.passos.find((x) => x.key === it.linha.atualKey);
    return p && p.data ? p.data.getTime() : Infinity;
  };
  const ordenar = (k, lista) => {
    const l = lista.slice();
    if (k === "andamento") l.sort((a, b) => (b.linha.atrasada - a.linha.atrasada) || (b.linha.pct - a.linha.pct));
    else if (k === "aguardando") l.sort((a, b) => (b.linha.atrasada - a.linha.atrasada) || (proximaData(a) - proximaData(b)));
    else l.sort((a, b) => String(b.obra.updated_at || "").localeCompare(String(a.obra.updated_at || "")));
    return l;
  };
  const S = window.MapaObrasCalc.SITUACOES;
  const contar = (k) => itens.filter((it) => it.obra.situacao === k).length;

  return (
    <div>
      <style>{EV_CSS}</style>
      <div className="grid-3" style={{ marginBottom: 14 }}>
        {EV_GRUPOS.map((g) => (
          <KPI key={g.key} label={g.titulo} value={extra ? String(contar(g.key)) : "…"}
            sub={ver[g.key] ? "equipamento(s) — clique para ocultar" : "oculto — clique para mostrar"}
            onClick={() => setVer((v) => ({ ...v, [g.key]: !v[g.key] }))}
            style={{ boxShadow: ver[g.key] ? `inset 4px 0 0 ${S[g.key].cor}` : "none", opacity: ver[g.key] ? 1 : 0.55 }}/>
        ))}
      </div>
      <div className="row sb" style={{ gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <input className="input" style={{ flex: "1 1 280px", maxWidth: 460 }} placeholder="Buscar por nº de série, cliente, obra, cidade, instalador…"
          value={busca} onChange={(e) => setBusca(e.target.value)} />
        <label className="row" style={{ gap: 6, fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={soOc} onChange={(e) => setSoOc(e.target.checked)}/>
          Só com ocorrência ({itens.filter((it) => it.oc.lista.length).length})
        </label>
        <div className="ev-legenda">
          <span><i style={{ background: "#16a34a", borderColor: "#16a34a" }}/>Feito</span>
          <span><i style={{ background: "#fef3c7", borderColor: "#f59e0b" }}/>Etapa atual</span>
          <span><i style={{ borderStyle: "dashed", borderColor: "#2563eb" }}/>Previsto</span>
          <span><i/>Sem data ainda</span>
        </div>
      </div>
      {erro && <div style={{ padding: 12, margin: "12px 0", border: "1px solid var(--vp-danger)", color: "var(--vp-danger)", borderRadius: 6, fontSize: 13 }}>{erro}</div>}
      {(!obras || !extra) && <div style={{ padding: "40px 0", textAlign: "center", color: "var(--fg3)", fontSize: 13 }}>Carregando a evolução dos equipamentos…</div>}
      {obras && extra && EV_GRUPOS.filter((g) => ver[g.key]).map((g) => {
        const lista = ordenar(g.key, filtrados.filter((it) => it.obra.situacao === g.key));
        return (
          <section key={g.key}>
            <div className="ev-grupo-h">
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: S[g.key].cor, display: "inline-block" }}/>
              <h2>{g.titulo} <span style={{ fontSize: 13, color: "var(--fg3)", fontWeight: 500 }}>({lista.length})</span></h2>
              <span>{g.sub}</span>
            </div>
            {lista.length === 0
              ? <div style={{ fontSize: 13, color: "var(--fg3)", padding: "8px 0 4px" }}>Nenhum equipamento{q ? " com esta busca" : ""}.</div>
              : lista.map((it) => <EvCard key={it.key} item={it} onAbrirDossie={onAbrirDossie} onVerNoMapa={onVerNoMapa}/>)}
          </section>
        );
      })}
      {obras && extra && (
        <div style={{ fontSize: 11, color: "var(--fg3)", marginTop: 16 }}>
          As datas vêm do cadastro de equipamentos do Dossiê (previsões e datas reais), do embarque da cotação (saída da fábrica e chegada a Santos — pelo Nº da cotação ou, nas obras antigas, pelo nº de série gravado na P.I.) e do Diário de Obra preenchido pelo montador (início e 50/75/100%). Etapa marcada como "sem data" já passou, mas a data não foi registrada.
        </div>
      )}
    </div>
  );
}

window.EvolucaoEquipamentos = EvolucaoEquipamentos;
window.useEvolucaoItens = useEvolucaoItens;
