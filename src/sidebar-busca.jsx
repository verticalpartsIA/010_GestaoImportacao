/* ============================================================
   sidebar-busca.jsx — paleta "Ir para…" (Ctrl/⌘ K) da sidebar.
   Busca TELAS (não registros). Recebe `grupos` já filtrados por permissão
   pelo Sidebar; a regra de busca é pura em sidebar-busca-calc.js.
   ============================================================ */
function SidebarBusca({ aberto, onFechar, grupos, onEscolher }) {
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState(0);
  const inputRef = React.useRef(null);
  const voltarFocoRef = React.useRef(null);
  const res = React.useMemo(
    () => (window.SidebarBuscaCalc ? window.SidebarBuscaCalc.buscar(grupos, q, 10) : []),
    [grupos, q]
  );

  React.useEffect(() => {
    if (!aberto) return undefined;
    voltarFocoRef.current = document.activeElement;
    setQ(""); setSel(0);
    const t = setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 0);
    return () => {
      clearTimeout(t);
      const el = voltarFocoRef.current;
      if (el && typeof el.focus === "function" && document.contains(el)) el.focus();
    };
  }, [aberto]);

  React.useEffect(() => { setSel(0); }, [q]);

  if (!aberto) return null;

  const escolher = (r) => { if (r) onEscolher(r); };
  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onFechar(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, res.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); escolher(res[sel]); }
    else if (e.key === "Tab") { e.preventDefault(); }
  };

  return (
    <div className="sbusca" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="sbusca__box" role="dialog" aria-modal="true" aria-label="Ir para uma tela">
        <div className="sbusca__input">
          <Icon.search size={16}/>
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Ir para uma tela…" autoComplete="off" spellCheck={false}
            role="combobox" aria-expanded="true" aria-controls="sbusca-lista"
            aria-activedescendant={res[sel] ? "sbusca-op-" + res[sel].id : undefined}/>
          <kbd>Esc</kbd>
        </div>
        <div className="sbusca__lista" id="sbusca-lista" role="listbox">
          {res.length === 0 && <div className="sbusca__vazio">Nenhuma tela encontrada.</div>}
          {res.map((r, i) => {
            const Ic = Icon[r.icon] || Icon.bolt;
            return (
              <div key={r.id} id={"sbusca-op-" + r.id} role="option" aria-selected={i === sel}
                className={"sbusca__op" + (i === sel ? " is-sel" : "")}
                onMouseEnter={() => setSel(i)} onMouseDown={(e) => { e.preventDefault(); escolher(r); }}>
                <span className="sbusca__ic"><Ic size={16}/></span>
                <span className="sbusca__nome">{r.label}</span>
                <span className="sbusca__grupo">{r.grupo}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
window.SidebarBusca = SidebarBusca;
