create table if not exists public.core_configuracoes_site (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  tipo text not null default 'json',
  config jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.core_configuracoes_site enable row level security;

drop policy if exists core_configuracoes_site_public_select on public.core_configuracoes_site;
create policy core_configuracoes_site_public_select on public.core_configuracoes_site
  for select
  using (ativo = true or public.is_admin_master());

drop policy if exists core_configuracoes_site_master_manage on public.core_configuracoes_site;
create policy core_configuracoes_site_master_manage on public.core_configuracoes_site
  for all to authenticated
  using (public.is_admin_master())
  with check (public.is_admin_master());

grant select on public.core_configuracoes_site to anon, authenticated;
grant insert, update, delete on public.core_configuracoes_site to authenticated;

insert into public.core_configuracoes_site (chave, tipo, ativo, config)
values (
  'landing',
  'json',
  true,
  '{
    "brandName": "MBA Labs",
    "logoUrl": "",
    "heroEyebrow": "Gestao simples para negocios reais",
    "heroTitle": "Sistemas praticos para organizar vendas, atendimentos e servicos sem complicar sua equipe",
    "heroSubtitle": "O MBA Labs reune solucoes prontas para empresas que precisam controlar clientes, pedidos, servicos, pagamentos e equipes em uma rotina simples.",
    "heroSupportText": "Voce escolhe o sistema certo para sua operacao, libera o acesso da equipe e acompanha tudo pelo login central do MBA Labs.",
    "primaryButtonText": "Conhecer sistemas",
    "whatsappButtonText": "Falar no WhatsApp",
    "whatsappUrl": "https://wa.me/5500000000000?text=Ola%2C%20quero%20conhecer%20os%20sistemas%20da%20MBA%20Labs.",
    "sideEyebrow": "Operacao sob controle",
    "sideTitle": "Um app para cada frente do seu negocio",
    "sideText": "Cotacoes para farmacias, gestao para lava-jatos, comandas para bicicletarias e novas solucoes sob demanda. Cada empresa acessa apenas o que contratou, com dados separados e uso simples no computador ou celular.",
    "systemsTitle": "Sistemas",
    "systems": [
      {
        "key": "mbacotacoes",
        "name": "MBA Cotacoes",
        "description": "Compare precos, receba respostas de vendedores e gere pedidos com mais agilidade para sua farmacia.",
        "href": "/apps/mbacotacoes",
        "cta": "Conhecer MBA Cotacoes",
        "visible": true
      },
      {
        "key": "lavagestor",
        "name": "LavaGestor",
        "description": "Controle lavagens, fila de veiculos, funcionarios, comissoes, vales, pagamentos e recibos em um painel simples.",
        "href": "/apps/lavagestor",
        "cta": "Conhecer LavaGestor",
        "visible": true
      },
      {
        "key": "bikecomanda",
        "name": "BikeComanda",
        "description": "Abra comandas de manutencao, cadastre clientes e bicicletas, monte orcamentos, acompanhe status e controle pagamentos.",
        "href": "/apps/bikecomanda",
        "cta": "Conhecer BikeComanda",
        "visible": true
      }
    ],
    "benefitsTitle": "Por que contratar pelo MBA Labs",
    "benefits": [
      "Login central com acesso por empresa",
      "Cada cliente ve apenas o sistema contratado",
      "Funciona no computador e no celular",
      "Rotina guiada para equipes nao tecnicas",
      "Controle de clientes, pagamentos e operacao"
    ],
    "footerText": "MBA Labs cria sistemas simples para pequenos negocios venderem, atenderem e acompanharem a operacao com mais controle.",
    "primaryColor": "#28d8a5",
    "secondaryColor": "#38bdf8"
  }'::jsonb
)
on conflict (chave) do nothing;
