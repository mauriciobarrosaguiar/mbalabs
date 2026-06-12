# MBA Cotacoes

App de cotacoes farmaceuticas e compras de licitacao dentro do monorepo MBA Labs.

Local correto no repositorio:

```text
apps/mba-cotacoes
```

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase Postgres/Auth/Storage
- Workspace compartilhado `@mba-labs/shared`

## Rodar localmente

Na raiz do monorepo:

```bash
npm install
npm run dev:cotacoes
```

O app roda em `http://localhost:3001`.

Para build do app:

```bash
npm run build:cotacoes
```

## Login MBA Labs

O MBA Cotacoes usa o mesmo Supabase/Auth do MBA Labs. O fluxo principal de acesso e:

1. Entrar no login central do MBA Labs: `/login`.
2. Fazer login com o usuario do core.
3. Acessar o card "MBA Cotacoes" no dashboard MBA Labs.
4. Abrir o app com a sessao ja criada pelo core.

Dentro deste app, `/login` e `/api/auth/login` redirecionam para o login central definido em `NEXT_PUBLIC_CORE_URL`, retornando ao caminho `/cotacoes` do MBA Labs.

## Variaveis

Copie `.env.example` para `.env.local` quando precisar rodar isolado.

Principais variaveis:

- `NEXT_PUBLIC_APP_URL`: URL local/publica do MBA Cotacoes.
- `NEXT_PUBLIC_CORE_URL`: URL do MBA Labs core, usado para o login central.
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`: usada no servidor para sincronizar a ponte entre `core_*` e as tabelas operacionais legadas do Cotacoes.
- `NEXT_PUBLIC_APP_SLUG=mba-cotacoes`

As variaveis `EFI_*` continuam reservadas para a integracao Efi/Pix existente.

## Banco

O app usa o banco unificado do MBA Labs. A autenticacao e permissao partem das tabelas `core_*`.

As tabelas operacionais originais do MBA Cotacoes continuam no historico de migrations deste app (`supabase/migrations`) para preservar o sistema existente. A migration do monorepo `supabase/migrations/20260612120000_cotacoes_core_bridge.sql` cria a ponte com:

- `tenants.core_empresa_id`
- `users_profile.core_usuario_id`

Nao coloque chaves reais em arquivos versionados.
