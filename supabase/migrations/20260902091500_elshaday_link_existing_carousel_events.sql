-- Elshaday: conecta automaticamente banners avulsos existentes a eventos futuros com o mesmo título.
-- A Agenda passa a comandar título, data, status e link; a imagem avulsa pode servir como fallback visual.

update public.igreja_eventos e
set destacar_home = true,
    ordem_home = c.ordem,
    updated_at = now()
from public.igreja_carrossel c
where c.igreja_id = e.igreja_id
  and c.ativo = true
  and c.titulo is not null
  and lower(trim(c.titulo)) = lower(trim(e.titulo))
  and e.status = 'agendado'
  and e.inicio >= now()
  and e.destacar_home = false;
