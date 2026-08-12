# MBA Labs

Portal central e monorepo dos sistemas MBA Labs.

## Estrutura principal

- `apps/mba-labs-core`: aplicação principal do MBA Labs. Contém landing page, login central, administração e os módulos integrados, incluindo o MBA Cotações.
- `apps/mba-labs-core/src/modules/cotacoes`: **implementação canônica do MBA Cotações**.
- `apps/mba-cotacoes`: workspace **legado temporário** do MBA Cotações, mantido apenas durante a Fase 1 para comparação, rollback e preservação de fixtures úteis. Não deve receber novas funcionalidades.
- `apps/lavagestor`: workspace do LavaGestor.
- `apps/mba-labs-core/public/bikecomanda-static`: protótipo funcional do BikeComanda integrado ao portal central.
- `apps/mba-labs-core/src/app/portal-associativo`: Portal Associativo integrado ao login central do MBA Labs.
- `packages/shared`: pacote compartilhado com clientes Supabase e tipos do banco.
- `supabase/migrations`: migrations do banco central do MBA Labs, incluindo as migrations operacionais do Cotações.
- `supabase/seed.sql`: seed do catálogo/base central.
- `docs/BIKECOMANDA_SCHEMA.sql`: schema de referência das tabelas operacionais do BikeComanda.
- `docs/GUIA_IMPLANTACAO.md`: guia de implantação.

## Requisitos

- Node.js 20.9 ou superior.
- Projeto Supabase central do MBA Labs já criado.
- Projeto utilizado pelo Core: `https://jrbkojhnltqfqwpczwuw.supabase.co`.

## Como rodar localmente

Entre na pasta da monorepo:

```powershell
cd "C:\Users\Mauricio\Documents\MBA Labs\mbalabs"
```

Instale as dependências:

```powershell
npm.cmd install
```

Crie/preencha os arquivos de ambiente do Core e dos workspaces que realmente serão executados. Nunca versione chaves reais.

Rode o portal principal:

```powershell
npm.cmd run dev
```

O MBA Cotações atual roda dentro do Core:

```powershell
npm.cmd run dev:cotacoes
```

O comando acima também aponta para `mba-labs-core`. O workspace antigo só deve ser iniciado para comparação controlada:

```powershell
npm.cmd run dev:cotacoes:legacy
```

O LavaGestor pode ser iniciado pelo comando próprio:

```powershell
npm.cmd run dev:lavagestor
```

### Rotas locais principais

- MBA Labs Core: `http://localhost:3000`
- MBA Cotações: `http://localhost:3000/cotacoes`
- Entrada do catálogo do Cotações: `http://localhost:3000/apps/mbacotacoes`
- BikeComanda: `http://localhost:3000/apps/bikecomanda` ou `http://localhost:3000/bikecomanda`
- Portal Associativo: `http://localhost:3000/portal-associativo` ou `http://localhost:3000/apps/portal-associativo`

## MBA Cotações

A fonte oficial está em `apps/mba-labs-core/src/modules/cotacoes`, com rotas autenticadas em `apps/mba-labs-core/src/app/cotacoes` e APIs em `apps/mba-labs-core/src/app/api/cotacoes`.

As rotas públicas compatíveis `/cotacao/*` e `/licitacao/*` continuam existindo para links enviados a fornecedores e vendedores. O workspace `apps/mba-cotacoes` não é a aplicação de produção atual.

Consulte também:

- `apps/mba-labs-core/src/modules/cotacoes/README.md`
- `apps/mba-labs-core/src/modules/cotacoes/PHASE1_VALIDATION.md`

## Portal Associativo

O Portal Associativo é um app interno do MBA Labs para associações, condomínios rurais, loteamentos, chácaras, comunidades, sindicatos, cooperativas e outras entidades que precisam gerir pessoas, unidades, transferências, cobranças, reuniões, avisos, documentos, projetos e painel do associado.

O app usa a rota `/portal-associativo`, slug `portal-associativo` e tabelas Supabase com prefixo `assoc_`.

## Variáveis de ambiente

Use somente variáveis públicas apropriadas no frontend:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Use segredos apenas no server-side, scripts administrativos ou rotas protegidas:

```env
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
LEXGESTOR_TOKEN_SECRET=
DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
PORTAL_ASSOCIATIVO_EFI_CLIENT_ID=
PORTAL_ASSOCIATIVO_EFI_CLIENT_SECRET=
PORTAL_ASSOCIATIVO_BB_CLIENT_ID=
PORTAL_ASSOCIATIVO_BB_CLIENT_SECRET=
```

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY`, tokens, client secrets, certificados ou credenciais bancárias em componente client-side ou no repositório.

## Dropbox do LexGestor

O LexGestor usa OAuth do Dropbox do próprio escritório. A MBA Labs salva metadados no Supabase; os arquivos reais ficam na conta conectada do advogado.

A URL de retorno de produção deve usar o domínio atual do MBA Labs, conforme a configuração efetivamente cadastrada no provedor e na Vercel. Segredos de OAuth permanecem somente nas variáveis server-side.

## Banco central

As migrations atuais são mantidas em `supabase/migrations`. Não crie um Supabase separado para o MBA Cotações usando a documentação antiga do workspace legado.

Ao aplicar migrations, respeite a ordem/versionamento do repositório e valide o ambiente antes de qualquer alteração de produção.

## Deploy na Vercel

O projeto principal usa:

- Repositório GitHub: `mauriciobarrosaguiar/mbalabs`
- Root Directory: `apps/mba-labs-core`
- Framework: Next.js
- Build Command: `npm run build`
- Install Command: `npm install`

O domínio de produção atual é `https://www.mbalabs.com.br` (com aliases configurados na Vercel).

## Regra de manutenção

Antes de remover código legado, confirme paridade funcional, links públicos, integrações, dados e build em Preview. Em especial, o diretório `apps/mba-cotacoes` só deve ser excluído depois do teste autenticado completo descrito em `PHASE1_VALIDATION.md`.
