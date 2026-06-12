# CotaFarma Web

SaaS web para cotação farmacêutica e compras de licitação, criado com Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui e estrutura Supabase.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase Postgres/Auth/Storage
- Row Level Security por tenant
- Deploy compatível com Vercel

## Rodar localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra `http://localhost:3001`. Os scripts `dev` e `start` já usam a porta `3001` para evitar conflito com outro projeto na `3000`.

Sem variáveis Supabase, o app abre automaticamente em modo demo local com dados mockados e badge no topo. Com Supabase configurado, o login usa Supabase Auth.

## Supabase

1. Crie um projeto no Supabase.
2. Copie `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` para `.env.local`.
3. Aplique a migration:

```bash
supabase db push
```

4. Carregue o seed:

```bash
supabase db reset
```

A migration principal está em `supabase/migrations/20260514140000_initial_schema.sql` e cria:

- tenants, usuários, vínculos por empresa e perfis
- cadastros de farmácias, fornecedores, distribuidoras, laboratórios e produtos
- cotações, itens, convites, sessões públicas, respostas, análises e awards
- pedidos, itens de pedido e saldos pendentes
- histórico de preço/compra, importações e arquivos
- planos, mensalidades, pagamentos e cobranças Efí
- logs de auditoria e credenciais futuras de integrações

## RLS e segurança

As policies seguem estas regras:

- `SUPER_ADMIN` acessa tudo.
- Usuários de empresa acessam somente linhas do próprio `tenant_id`.
- Vendedor externo não usa login do painel.
- Links públicos devem consultar por token via RPC `get_public_quote_payload(token)`.
- Tabelas internas não expõem ranking por policy pública.

O arquivo `src/proxy.ts` protege `/admin` e `/app` quando Supabase está configurado. A autorização final deve continuar sendo validada em Server Components, Server Actions ou Route Handlers.

## Rotas principais

- `/` landing page
- `/login`
- `/recuperar-senha`
- `/alterar-senha`
- `/admin`
- `/admin/empresas`
- `/app/dashboard`
- `/app/cotacoes-farmacia`
- `/app/licitacoes`
- `/cotacao/responder/farmacia-demo-token`
- `/cotacao/pedido/farmacia-pedido-demo-token`
- `/licitacao/responder/licitacao-demo-token`
- `/licitacao/pedido/licitacao-pedido-demo-token`
- `/api/export/licitacao/demo-licitacao`
- `/api/webhooks/efi/pix`

## Efí Bank

A integração está preparada em `src/lib/services/payments-efi.ts` e no webhook `/api/webhooks/efi/pix`.

Não salve credenciais no código. Use:

- `EFI_CLIENT_ID`
- `EFI_CLIENT_SECRET`
- `EFI_CERTIFICATE_PATH`
- `EFI_PIX_KEY`
- `EFI_ENVIRONMENT`

## Deploy Vercel

1. Suba o repositório para GitHub.
2. Crie o projeto na Vercel.
3. Configure as variáveis de ambiente da `.env.example`.
4. Garanta que as migrations foram aplicadas no Supabase.
5. Deploy.

## Observação de implementação

Esta primeira versão prioriza o fluxo completo navegável: cadastros, cotações, links públicos, cálculo de menor preço, cálculo por unidade convertida, sugestão automática com atendimento parcial, pedidos por fornecedor, exportação Excel e estrutura financeira.

As integrações avançadas futuras incluem emissão Pix real, validação de webhook Efí, criptografia operacional de credenciais externas e importação persistida de planilhas.
