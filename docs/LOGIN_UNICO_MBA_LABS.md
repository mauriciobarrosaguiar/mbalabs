# Login único MBA Labs

O fluxo oficial é sempre:

1. `https://mbalabs.vercel.app/login`
2. `https://mbalabs.vercel.app/dashboard`
3. Cards internos para `/cotacoes` e `/lavagestor`

Os domínios antigos podem continuar como legado, mas devem apontar o usuário para o login oficial da MBA Labs.

## Supabase Auth

Em `Authentication > URL Configuration`, conferir:

- Site URL: `https://mbalabs.vercel.app`
- Redirect URLs:
  - `https://mbalabs.vercel.app/**`
  - `https://lavagestor.vercel.app/**`

## Vercel

No projeto principal `mbalabs`, conferir se existem:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

`SUPABASE_SERVICE_ROLE_KEY` deve existir apenas no ambiente server-side da Vercel. Nunca usar no client-side.

## Legados locais encontrados

- `C:\Users\Mauricio\Documents\MBA Labs\mba-cotacoes`
- `C:\Users\Mauricio\Documents\MBA Labs\lavagestor`
- backups anteriores em `C:\Users\Mauricio\Documents\MBA Labs\backups`

O portal principal reaproveita a arquitetura/tabelas desses sistemas dentro de `apps/mba-labs-core`, usando o mesmo Supabase da MBA Labs.
