-- Solicitação de cargo informada no autocadastro do Elshaday.
-- O cargo atual permanece independente e só muda após aprovação administrativa.

alter table public.igreja_membros
  add column if not exists cargo_solicitado_id uuid,
  add column if not exists cargo_solicitado_em timestamptz,
  add column if not exists cargo_solicitado_observacao text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'igreja_membros_cargo_solicitado_tenant_fk'
  ) then
    alter table public.igreja_membros
      add constraint igreja_membros_cargo_solicitado_tenant_fk
      foreign key (cargo_solicitado_id, igreja_id)
      references public.igreja_cargos(id, igreja_id)
      on delete restrict;
  end if;
end $$;

create index if not exists igreja_membros_cargo_solicitado_idx
  on public.igreja_membros(igreja_id, cargo_solicitado_id)
  where cargo_solicitado_id is not null;

comment on column public.igreja_membros.cargo_solicitado_id is
  'Cargo declarado pelo membro no autocadastro; não concede permissão e aguarda aprovação.';
