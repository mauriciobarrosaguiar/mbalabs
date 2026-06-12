# Configurar Supabase e Vercel

Este guia prepara o CotaFarma Web para rodar em produção com dados reais.

## 1. Criar projeto no Supabase

1. Acesse o painel do Supabase.
2. Crie um novo projeto.
3. Aguarde o banco ficar disponível.

## 2. Rodar migrations

Rode todas as migrations da pasta `supabase/migrations` no projeto Supabase.

Ordem esperada:

1. `20260514140000_initial_schema.sql`
2. `20260515190000_public_response_commercial_fields.sql`
3. `20260519143000_add_supplier_response_commercial_fields.sql`

## 3. Rodar seed

Execute `supabase/seed.sql` para inserir dados iniciais de teste controlado.

## 4. Copiar credenciais

No Supabase, copie:

1. Project URL.
2. anon/public key.
3. service_role/secret key.

Nunca publique a service role no navegador, GitHub ou código-fonte.

## 5. Configurar Vercel

No projeto Vercel, configure:

```env
NEXT_PUBLIC_APP_URL=https://mbacotacoes.vercel.app
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Depois faça um redeploy sem cache.

## 6. Configurar local

Crie `.env.local` com as mesmas variáveis. Não versione esse arquivo.

## 7. Criar primeiro admin

Configure também:

```env
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_NAME=
```

Rode:

```bash
npm run setup:admin
```

## 8. Validar Supabase

Rode:

```bash
npm run check:supabase
```

Abra:

```text
https://mbacotacoes.vercel.app/app/configuracoes/supabase
https://mbacotacoes.vercel.app/api/health/supabase
```

O modo deve aparecer como `Supabase` quando as variáveis públicas estiverem configuradas. A service role deve aparecer apenas como `Configurado` ou `Não configurado`, sem exibir valor.
