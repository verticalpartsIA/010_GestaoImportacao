/* ============================================================
   vistorias-envio.jsx
   Módulo: Vistorias de Obras (rota `vistorias-envio`)
   Descrição: reservado pra futura solução de disparo de vistoria pro
   celular do técnico em campo — ver dossiê de engenharia reversa do
   Btime no README.md (seção "Btime — Vistorias em Equipamentos") pra
   o modelo de referência (Local → Atividade → Questionário → resultado).

   Criado (01/09) junto com a renomeação de src/vistorias-obras.jsx pra
   "Resultado Vistorias de Obras" (rota `vistorias`, que continua sendo
   o CRUD/histórico real). Fluxo pretendido quando esta tela ganhar
   implementação: aqui se monta/dispara a vistoria → técnico executa no
   celular → resultado cai em `vistorias-obras.jsx`.

   Ainda sem tabela própria no Supabase — não inventar schema aqui até
   a solução real ser desenhada.
   ============================================================ */

function VistoriasEnvio({ setRoute }) {
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Engenharia · Vistorias de Obras</div>
          <h1 className="page-head__title">Vistorias de Obras</h1>
          <p className="page-head__sub">Ponto de partida da vistoria: montar o checklist e enviar pro celular do técnico em campo. Ainda em construção.</p>
        </div>
      </div>

      <EmptyStateRedirect
        icon="send"
        title="Em construção"
        message="Aqui vai morar o disparo de vistorias pro celular dos técnicos — o time monta a vistoria, envia, o técnico executa em campo e o resultado cai automaticamente em Resultado Vistorias de Obras."
        ctaLabel="Ver Resultado Vistorias de Obras"
        onCta={() => setRoute && setRoute('vistorias')}
      />
    </div>
  );
}

window.VistoriasEnvio = VistoriasEnvio;
