-- Dossiê da Obra guarda o endereço completo da obra + a posição no mapa (19/10/2026).
-- Antes só existiam city/state, então o Mapa de Obras marcava o centro da cidade.
-- latitude/longitude são preenchidas pelo Mapa de Obras ao localizar o endereço
-- (Nominatim) ou à mão; mudar o endereço apaga a posição para ela ser refeita.

alter table public.dossier_obra
  add column if not exists endereco_logradouro  text,
  add column if not exists endereco_numero      text,
  add column if not exists endereco_complemento text,
  add column if not exists endereco_bairro      text,
  add column if not exists endereco_cep         text,
  add column if not exists latitude             double precision,
  add column if not exists longitude            double precision,
  add column if not exists geo_precisao         text,
  add column if not exists geo_atualizado_em    timestamptz;

alter table public.dossier_obra drop constraint if exists dossier_obra_geo_precisao_check;
alter table public.dossier_obra add constraint dossier_obra_geo_precisao_check
  check (geo_precisao is null or geo_precisao in ('endereco', 'cep', 'manual'));

-- Endereço mudou e a posição não veio junto na mesma gravação: a posição antiga deixa de valer.
create or replace function public.dossier_obra_limpa_geo()
returns trigger language plpgsql as $$
begin
  if (new.endereco_logradouro, new.endereco_numero, new.endereco_bairro, new.endereco_cep, new.city, new.state)
     is distinct from
     (old.endereco_logradouro, old.endereco_numero, old.endereco_bairro, old.endereco_cep, old.city, old.state)
     and new.latitude is not distinct from old.latitude
     and new.longitude is not distinct from old.longitude then
    new.latitude := null;
    new.longitude := null;
    new.geo_precisao := null;
    new.geo_atualizado_em := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_dossier_obra_limpa_geo on public.dossier_obra;
create trigger trg_dossier_obra_limpa_geo
  before update on public.dossier_obra
  for each row execute function public.dossier_obra_limpa_geo();

-- Carga inicial: o endereço da obra que a Proposta já trazia (data_json.obra).
update public.dossier_obra d set
  endereco_logradouro = nullif(trim(p.data_json->'obra'->>'endereco'), ''),
  endereco_numero     = nullif(trim(p.data_json->'obra'->>'numero'), ''),
  endereco_bairro     = nullif(trim(p.data_json->'obra'->>'bairro'), ''),
  endereco_cep        = nullif(regexp_replace(coalesce(p.data_json->'obra'->>'cep', ''), '\D', '', 'g'), '')
from public.propostas p
where p.id = d.proposta_id
  and d.endereco_logradouro is null
  and nullif(trim(p.data_json->'obra'->>'endereco'), '') is not null;
