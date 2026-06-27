-- LavaGestor: configurações próprias da empresa
-- Mantém as preferências do LavaGestor separadas do core do MBA Labs.

create table if not exists lava_configuracoes (
  empresa_id uuid primary key references core_empresas(id) on delete cascade,
  nome_exibicao text,
  nome_fantasia text,
  documento text,
  whatsapp text,
  telefone text,
  endereco text,
  cidade text,
  estado text,
  chave_pix text,
  logo_url text,
  cor_principal text default '#059669',
  percentual_comissao_padrao numeric(8,2) default 35,
  forma_pagamento_padrao text default 'pix',
  permitir_fiado boolean default true,
  permitir_desconto boolean default true,
  bloquear_entrega_sem_pagamento boolean default true,
  mensagem_veiculo_pronto text,
  mensagem_recibo text,
  motivos_cancelamento text[] default array['Cliente desistiu','Serviço lançado errado','Veículo não deixou no lava-jato','Pagamento não aprovado','Outro motivo'],
  tipos_entrega text[] default array['Cliente retira','Levar ao cliente'],
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table lava_configuracoes enable row level security;

drop policy if exists lava_configuracoes_select on lava_configuracoes;
drop policy if exists lava_configuracoes_insert on lava_configuracoes;
drop policy if exists lava_configuracoes_update on lava_configuracoes;

create policy lava_configuracoes_select
on lava_configuracoes for select
to authenticated
using (true);

create policy lava_configuracoes_insert
on lava_configuracoes for insert
to authenticated
with check (true);

create policy lava_configuracoes_update
on lava_configuracoes for update
to authenticated
using (true)
with check (true);

create or replace function lava_configuracoes_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lava_configuracoes_touch_updated_at on lava_configuracoes;
create trigger lava_configuracoes_touch_updated_at
before update on lava_configuracoes
for each row execute function lava_configuracoes_touch_updated_at();
