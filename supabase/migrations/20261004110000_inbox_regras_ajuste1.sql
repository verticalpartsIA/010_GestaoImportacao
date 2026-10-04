-- Inbox · triagem — ajuste 1 das regras (04/10/2026): achado ao rodar nos e-mails reais.
-- Conversa de fornecedor em inglês sem Nº de cotação e e-mail de boas-vindas de serviço caíam em "outro".
insert into public.inbox_regras (pergunta, opcao, campo, padrao, peso) values
  ('assunto','resposta_fornecedor','qualquer','specification|drawing|shipment|container|packing list|bill of lading|payment term|dear sir|kind regards|best regards',2),
  ('assunto','automatico_spam','assunto','get started|welcome|bem-vindo|verify your|confirm your email|your account|sua conta',4),
  ('assunto','automatico_spam','remetente','hostinger|mailchimp|linkedin|facebookmail|notification@|noresponder',4);
