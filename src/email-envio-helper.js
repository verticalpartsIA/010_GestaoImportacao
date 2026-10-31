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
     to, cc, subject, text, numeroCotacao, referenciaTipo, referenciaId, attachments
   }) → { enviouDireto, emailData?, emailError? }
   ============================================================ */
(function () {
  'use strict';

  /* "a@x.com, b@y.com; c@z.com" ou array -> array sem vazios (sem cc devolve undefined) */
  function normalizarLista(v) {
    const arr = Array.isArray(v) ? v : String(v || '').split(/[,;\s]+/);
    const lim = arr.map((x) => String(x).trim()).filter(Boolean);
    return lim.length ? lim : undefined;
  }

  async function tentarEnviarDireto({ to, cc, subject, text, numeroCotacao, referenciaTipo, referenciaId, attachments } = {}) {
    const sb = window.__VP_SB && window.__VP_SB.sb;
    if (!sb) return { enviouDireto: false };
    try {
      const { data: emailData, error: emailError } = await sb.functions.invoke('send-email', {
        body: {
          to, subject, text,
          cc: normalizarLista(cc),
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

  const RE_EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
  function ccInvalidos(v) { return (normalizarLista(v) || []).filter((x) => !RE_EMAIL.test(x)); }
  /* Última lista de "Em cópia" digitada, lembrada neste navegador (conveniência: a equipe costuma copiar as mesmas pessoas) */
  function ccSalvo() { try { return localStorage.getItem('vp_email_cc') || ''; } catch (e) { return ''; } }
  function salvarCc(v) { try { localStorage.setItem('vp_email_cc', v || ''); } catch (e) { /* sem storage */ } }

  /* Campo "Em cópia (CC)" reutilizável: <window.EmailCcInput value onChange /> */
  function EmailCcInput({ value, onChange, label }) {
    const R = window.React;
    const bad = ccInvalidos(value);
    return R.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
      R.createElement('label', { className: 'small', style: { fontWeight: 700 } }, label || 'Em cópia (CC)'),
      R.createElement('input', {
        type: 'text', value: value || '', placeholder: 'email1@empresa.com, email2@empresa.com',
        onChange: (e) => { onChange && onChange(e.target.value); salvarCc(e.target.value); },
        style: { width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid ' + (bad.length ? '#dc2626' : 'var(--border, #d1d5db)') },
      }),
      R.createElement('div', { className: 'small muted' }, bad.length ? 'E-mail inválido: ' + bad.join(', ') : '(separe vários e-mails por vírgula — todos recebem cópia e veem a resposta em Tratativas/Inbox)'));
  }

  window.EmailEnvioHelper = { tentarEnviarDireto, normalizarLista, ccInvalidos, ccSalvo, salvarCc };
  window.EmailCcInput = EmailCcInput;
}());
