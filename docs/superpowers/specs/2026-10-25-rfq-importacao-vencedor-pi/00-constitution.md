# Constituição deste assunto

A constituição é o `CLAUDE.md` da raiz (regras permanentes). Valem aqui, em especial:
- Migration/cron/deploy só com "CONFIRMO" do Gelson depois de descrever o que será aplicado.
- `send-email`, `read-inbox`, vínculo de e-mail e soft-delete do Inbox: área blindada, NÃO tocar.
- Todo arquivo com `?v=` no `index.html` sobe a versão no mesmo commit.
- Tabelas novas nascem FECHADAS (só `authenticated` + `vp_usuario_ativo()`); fornecedor fala só por RPC com token.
- Histórico nunca é apagado (sem DELETE; soft-delete).
- Commit/PR/merge só quando o Gelson pedir.

Ciclo: 01-specify → 02-clarify → 03-plan → 04-tasks → 05-analyze → implement.
