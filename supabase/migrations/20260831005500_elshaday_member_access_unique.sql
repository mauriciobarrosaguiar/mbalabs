-- Garante que um login não seja vinculado a dois membros da mesma igreja.
create unique index if not exists igreja_membros_igreja_user_unique_idx
  on public.igreja_membros(igreja_id, user_id)
  where user_id is not null;
