alter table precificacoes_elevador
  add column if not exists containers jsonb not null default '[]'::jsonb;

comment on column precificacoes_elevador.containers is
  'Lista de containers do embarque (tipo_tamanho, quantidade, preco_rs), preenchida no card "Despesas Operacionais" da Precificação. Pré-populada, quando possível, a partir do texto livre cotacoes_elevador_fornecedor.respostas.container_no na criação da precificação — editável depois.';
