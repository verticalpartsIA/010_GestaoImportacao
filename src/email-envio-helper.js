/* ============================================================
   email-envio-helper.js
   Helper compartilhado pro padrão "tenta send-email (SMTP direto),
   deixa o chamador decidir o fallback pro mailto: se falhar" — usado
   em RFQ a fornecedor (formulario-elevador.jsx), Proposta
   (proposta-editor.jsx), Contrato de Venda e Contrato Instalador
   (contrato-venda.jsx/contrato-instalador.jsx).

   Extraído em 01/10/2026: os 4 módulos tinham o mesmo bloco
   copiado (chamar send-email, checar emailData.ok, mostrar o toast de
   avisoPersistencia, logar o warning de falha) — só essa chamada, não
   a lógica de negócio em volta (cada um decide diferente o que fazer
   em caso de sucesso/falha: qual marcarEnviado/markSent chamar, qual
   mailtoHref montar, se interrompe a função ou segue com outro
   `registrar`). Isso NÃO muda nenhum comportamento existente — só
   remove a duplicação da parte que já era idêntica nos 4 lugares.

   window.EmailEnvioHelper.tentarEnviarDireto({
     to, subject, text, numeroCotacao, referenciaTipo, referenciaId, attachments
   }) → { enviouDireto, emailData?, emailError? }
   ============================================================ */
(function () {
  'use strict';

  async function tentarEnviarDireto({ to, subject, text, numeroCotacao, referenciaTipo, referenciaId, attachments } = {}) {
    const sb = window.__VP_SB && window.__VP_SB.sb;
    if (!sb) return { enviouDireto: false };
    try {
      const { data: emailData, error: emailError } = await sb.functions.invoke('send-email', {
        body: {
          to, subject, text,
          numeroCotacao: numeroCotacao ?? undefined,
          referenciaTipo, referenciaId, attachments,
        },
      });
      if (!emailError && emailData && emailData.ok) {
        if (emailData.avisoPersistencia) window.toast?.(emailData.avisoPersistencia, 'warning');
        return { enviouDireto: true, emailData };
      }
      console.warn('[EmailEnvioHelper] send-email falhou, caindo pro mailto:', emailError, emailData);
      return { enviouDireto: false, emailError, emailData };
    } catch (e) {
      console.warn('[EmailEnvioHelper] erro ao invocar send-email', e);
      return { enviouDireto: false, emailError: e };
    }
  }

  window.EmailEnvioHelper = { tentarEnviarDireto };
}());
