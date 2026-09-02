-- Elshaday: ativa automaticamente na Home os próximos eventos já existentes que possuem banner.
-- Isso evita que o usuário precise recadastrar o mesmo conteúdo no carrossel após a integração.

update public.igreja_eventos
set destacar_home = true,
    ordem_home = coalesce(ordem_home, 10),
    updated_at = now()
where status = 'agendado'
  and inicio >= now()
  and banner_url is not null
  and destacar_home = false;
