/* ============================================================
   toast.jsx — Global toast system
   Use via window.toast("mensagem", "info"|"success"|"warning"|"danger")
   ---------------------------------------------------------------
   Publica via window.dispatchEvent/addEventListener (não um array de
   listeners em memória fechado sobre uma const de módulo) — o app carrega
   ~100 arquivos .jsx via Babel Standalone, cada um avaliado como seu
   próprio top-level script; achado ao vivo: um array-de-listeners
   guardado numa `const` de topo de arquivo ficava dessincronizado do
   `<ToastViewport/>` realmente montado (toast nunca aparecia — nem os
   emitidos pelo próprio app, nem via chamada manual — sem erro nenhum,
   silêncio total). Evento em `window` não depende de nenhuma closure
   compartilhada entre scripts, só do objeto `window` em si.
   ============================================================ */

let _toastCounter = 0;
const TOAST_EVENT = "vp:toast";

window.toast = function(message, variant = "info", opts = {}) {
  const id = ++_toastCounter;
  const duration = opts.duration ?? 3200;
  const payload = { id, message, variant, duration, description: opts.description, action: opts.action };
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { type: "add", payload } }));
  if (duration !== Infinity) {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { type: "remove", id } }));
    }, duration);
  }
  return id;
};

function ToastViewport() {
  const [toasts, setToasts] = React.useState([]);
  React.useEffect(() => {
    const fn = (ev) => {
      const d = ev.detail;
      if (d.type === "add") setToasts(t => [...t, d.payload]);
      else if (d.type === "remove") setToasts(t => t.filter(x => x.id !== d.id));
    };
    window.addEventListener(TOAST_EVENT, fn);
    return () => window.removeEventListener(TOAST_EVENT, fn);
  }, []);

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      {toasts.map(t => (
        <div key={t.id} className={"toast toast--" + t.variant} role="status">
          <span className="toast__icon">
            {t.variant === "success" ? <Icon.check size={14}/> :
             t.variant === "warning" ? <Icon.warning size={14}/> :
             t.variant === "danger"  ? <Icon.warning size={14}/> :
             <Icon.info size={14}/>}
          </span>
          <span className="toast__body">
            <span className="toast__msg">{t.message}</span>
            {t.description ? <span className="toast__desc">{t.description}</span> : null}
          </span>
          {t.action ? (
            <button className="toast__action" onClick={() => {
              t.action.onClick();
              setToasts(ts => ts.filter(x => x.id !== t.id));
            }}>{t.action.label}</button>
          ) : null}
          <button className="toast__close"
            aria-label="Fechar notificação"
            onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))}>
            <Icon.x size={12}/>
          </button>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { ToastViewport });
