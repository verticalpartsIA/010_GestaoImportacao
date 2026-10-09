-- Procurar por registros recentes de Quadro de Comando com "teste"
SELECT 
  'quadros_comando_maquina' as tabela,
  id, 
  tipo_maquina,
  potencia_kw,
  created_at,
  updated_at
FROM quadros_comando_maquina
WHERE 
  tipo_maquina ILIKE '%teste%' 
  OR potencia_kw::text ILIKE '%teste%'
  OR created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;

-- Procurar por cotações de Quadro de Comando recentes com "teste"
SELECT 
  'cotacoes_quadro_comando' as tabela,
  id,
  numero_cotacao,
  status,
  created_at,
  updated_at
FROM cotacoes_quadro_comando
WHERE 
  numero_cotacao ILIKE '%teste%'
  OR created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;
