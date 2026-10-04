-- Inbox · fase 3: "lido" por pessoa ganha o estado NULO = "sem opinião, segue a caixa (IMAP \Seen)".
-- Motivo: com "marcar como não lida" por pessoa, `lido = false` passa a significar "marquei como NÃO lida" — então dar estrela
-- num e-mail (que cria a linha) não pode gravar lido=false por padrão. Só abrir (true) ou marcar como não lida (false) grava valor.
-- Aditivo: nenhuma linha existente muda de significado (a tabela estava vazia depois dos testes da fase 2).
alter table public.inbox_estado_pessoa alter column lido drop not null;
alter table public.inbox_estado_pessoa alter column lido drop default;
