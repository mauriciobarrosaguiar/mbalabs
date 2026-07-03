alter table public.lava_vales
  drop constraint if exists lava_vales_status_check;

alter table public.lava_vales
  add constraint lava_vales_status_check
  check (
    status is null
    or status in ('aberto', 'parcial', 'descontado', 'cancelado')
  );
