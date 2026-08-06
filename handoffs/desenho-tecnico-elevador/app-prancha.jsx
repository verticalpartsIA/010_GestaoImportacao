/* =========================================================
   VerticalParts — Prancha de Instalação
   app-prancha.jsx · herda o payload e monta as 6 folhas
   ========================================================= */
const { useState, useEffect } = React;

/* Lê o payload herdado do site. Ordem de prioridade:
   1) window.VP_PROJETO   2) ?dados=<base64 json>   3) postMessage  */
function lerPayloadInicial() {
  try {
    const q = new URLSearchParams(location.search).get("dados");
    if (q) return JSON.parse(decodeURIComponent(escape(atob(q))));
  } catch (e) { console.warn("[prancha] ?dados inválido:", e); }
  if (window.VP_PROJETO) return window.VP_PROJETO;
  return null;
}

function Prancha() {
  const [payload, setPayload] = useState(lerPayloadInicial);

  useEffect(() => {
    const onMsg = (ev) => {
      const m = ev.data;
      if (m && m.tipo === "vp:projeto" && m.dados) setPayload(m.dados);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const d = window.VPDados.resolve(payload);
  const { Folha } = window.VPPrancha;
  const A = window.VPFolhasA, B = window.VPFolhasB;

  const folhas = [
    { n: 1, titulo: "Seção do eixo vertical", conteudo: A.Folha1 },
    { n: 2, titulo: "Plano do poço", conteudo: A.Folha2 },
    { n: 3, titulo: "Plano do piso superior", conteudo: A.Folha3 },
    { n: 4, titulo: "Porta de pavimento", conteudo: B.Folha4 },
    { n: 5, titulo: "Diagrama unifilar", conteudo: B.Folha5 },
    { n: 6, titulo: "Especificações", conteudo: B.Folha6 },
  ];

  return (
    <React.Fragment>
      {folhas.map(f => (
        <Folha key={f.n} d={d} n={f.n} titulo={f.titulo}>{f.conteudo(d)}</Folha>
      ))}
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("prancha-root")).render(<Prancha />);
