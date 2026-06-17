-- LexGestor RLS inicial.
-- ATENCAO: revisar antes de aplicar. Este arquivo prepara isolamento por escritorio,
-- usando claim futura auth.jwt()->>'lex_escritorio_id'.
-- Nao altera tabelas core_ e nao substitui validacoes do backend.

alter table public.lex_escritorios enable row level security;
alter table public.lex_advogados enable row level security;
alter table public.lex_clientes enable row level security;
alter table public.lex_casos enable row level security;
alter table public.lex_relatos enable row level security;
alter table public.lex_documentos enable row level security;
alter table public.lex_checklist_templates enable row level security;
alter table public.lex_checklist_respostas enable row level security;
alter table public.lex_dropbox_conexoes enable row level security;
alter table public.lex_whatsapp_conversas enable row level security;
alter table public.lex_whatsapp_mensagens enable row level security;
alter table public.lex_tarefas enable row level security;
alter table public.lex_prazos enable row level security;
alter table public.lex_auditoria enable row level security;

-- Helper de leitura da claim futura do escritorio.
-- Em producao, confirmar se a claim sera preenchida pelo login do MBA Labs.
create or replace function public.lex_current_escritorio_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'lex_escritorio_id', '')::uuid;
$$;

create policy "lex_escritorios_select_mesmo_escritorio"
on public.lex_escritorios
for select
using (id = public.lex_current_escritorio_id());

create policy "lex_escritorios_update_mesmo_escritorio"
on public.lex_escritorios
for update
using (id = public.lex_current_escritorio_id())
with check (id = public.lex_current_escritorio_id());

create policy "lex_advogados_isolamento_escritorio"
on public.lex_advogados
for all
using (escritorio_id = public.lex_current_escritorio_id())
with check (escritorio_id = public.lex_current_escritorio_id());

create policy "lex_clientes_isolamento_escritorio"
on public.lex_clientes
for all
using (escritorio_id = public.lex_current_escritorio_id())
with check (escritorio_id = public.lex_current_escritorio_id());

create policy "lex_casos_isolamento_escritorio"
on public.lex_casos
for all
using (escritorio_id = public.lex_current_escritorio_id())
with check (escritorio_id = public.lex_current_escritorio_id());

create policy "lex_relatos_isolamento_escritorio"
on public.lex_relatos
for all
using (escritorio_id = public.lex_current_escritorio_id())
with check (escritorio_id = public.lex_current_escritorio_id());

create policy "lex_documentos_isolamento_escritorio"
on public.lex_documentos
for all
using (escritorio_id = public.lex_current_escritorio_id())
with check (escritorio_id = public.lex_current_escritorio_id());

-- Templates sao globais do produto. RLS fica habilitado, mas a leitura e permitida
-- para usuarios autenticados. Alteracoes devem ser feitas apenas por service role/backend.
create policy "lex_checklist_templates_select_autenticado"
on public.lex_checklist_templates
for select
to authenticated
using (ativo = true);

create policy "lex_checklist_respostas_isolamento_escritorio"
on public.lex_checklist_respostas
for all
using (escritorio_id = public.lex_current_escritorio_id())
with check (escritorio_id = public.lex_current_escritorio_id());

create policy "lex_dropbox_conexoes_isolamento_escritorio"
on public.lex_dropbox_conexoes
for all
using (escritorio_id = public.lex_current_escritorio_id())
with check (escritorio_id = public.lex_current_escritorio_id());

create policy "lex_whatsapp_conversas_isolamento_escritorio"
on public.lex_whatsapp_conversas
for all
using (escritorio_id = public.lex_current_escritorio_id())
with check (escritorio_id = public.lex_current_escritorio_id());

create policy "lex_whatsapp_mensagens_isolamento_escritorio"
on public.lex_whatsapp_mensagens
for all
using (escritorio_id = public.lex_current_escritorio_id())
with check (escritorio_id = public.lex_current_escritorio_id());

create policy "lex_tarefas_isolamento_escritorio"
on public.lex_tarefas
for all
using (escritorio_id = public.lex_current_escritorio_id())
with check (escritorio_id = public.lex_current_escritorio_id());

create policy "lex_prazos_isolamento_escritorio"
on public.lex_prazos
for all
using (escritorio_id = public.lex_current_escritorio_id())
with check (escritorio_id = public.lex_current_escritorio_id());

create policy "lex_auditoria_select_mesmo_escritorio"
on public.lex_auditoria
for select
using (escritorio_id = public.lex_current_escritorio_id());

create policy "lex_auditoria_insert_mesmo_escritorio"
on public.lex_auditoria
for insert
with check (escritorio_id = public.lex_current_escritorio_id());
