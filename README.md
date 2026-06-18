# MBA Labs

Portal central e monorepo inicial dos sistemas MBA Labs.

## O que foi criado

- `apps/mba-labs-core`: portal principal para landing page, login, cadastro do Admin Master, dashboard e telas administrativas.
- `apps/mba-cotacoes`: app MBA Cotacoes completo, com rotas protegidas, login central do MBA Labs e migrations operacionais originais.
- `apps/lavagestor`: estrutura inicial do LavaGestor, com rotas protegidas e leitura das tabelas `lava_`.
- `apps/mba-labs-core/public/bikecomanda-static`: prototipo funcional do BikeComanda integrado ao portal central.
- `packages/shared`: pacote compartilhado com clientes Supabase e tipos do banco.
- `supabase/migrations/001_initial_schema.sql`: migration inicial do banco unico multiempresa.
- `supabase/seed.sql`: seed basico de apps e planos.
- `docs/BIKECOMANDA_SCHEMA.sql`: schema de referencia das tabelas operacionais do BikeComanda.
- `docs/GUIA_IMPLANTACAO.md`: passo a passo para Supabase, local, GitHub e Vercel.

## Requisitos

- Node.js 20.9 ou superior.
- Conta Supabase ja criada.
- Projeto Supabase usado neste projeto:
  `https://jrbkojhnltqfqwpczwuw.supabase.co`

## Como rodar localmente

Entre na pasta da monorepo:

```powershell
cd "C:\Users\Mauricio\Documents\MBA Labs\mbalabs"
```

Instale as dependencias:

```powershell
npm.cmd install
```

Crie os arquivos locais de ambiente:

```powershell
Copy-Item .env.example .env.local
Copy-Item apps\mba-labs-core\.env.local.example apps\mba-labs-core\.env.local
Copy-Item apps\mba-cotacoes\.env.example apps\mba-cotacoes\.env.local
Copy-Item apps\lavagestor\.env.local.example apps\lavagestor\.env.local
```

Preencha as chaves do Supabase nos arquivos `.env.local`.

Rode o portal principal:

```powershell
npm.cmd run dev
```

Apps dedicadas, quando quiser abrir separadamente:

```powershell
npm.cmd run dev:cotacoes
npm.cmd run dev:lavagestor
```

Portas padrao:

- MBA Labs Core: `http://localhost:3000`
- MBA Cotacoes: `http://localhost:3001/app/dashboard` ou alias `http://localhost:3001/apps/mba-cotacoes`
- LavaGestor: `http://localhost:3002/lavagestor`
- BikeComanda: `http://localhost:3000/apps/bikecomanda` ou direto `http://localhost:3000/bikecomanda`

## Variaveis de ambiente

Use somente estas variaveis no frontend:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Use estas apenas no server-side, scripts administrativos ou rotas protegidas:

```env
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
LEXGESTOR_TOKEN_SECRET=
DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY`, `LEXGESTOR_TOKEN_SECRET`, `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `GOOGLE_CLIENT_ID` ou `GOOGLE_CLIENT_SECRET` em componente client-side.

## Dropbox do LexGestor

O LexGestor usa OAuth do Dropbox do proprio escritorio. A MBA Labs salva apenas metadados no Supabase; os arquivos reais ficam na conta conectada do advogado.

Configure no app do Dropbox a URL de retorno:

```txt
https://mbalabs.vercel.app/api/lexgestor/storage/callback/dropbox
```

Configure na Vercel:

```env
LEXGESTOR_TOKEN_SECRET=
DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=
```

Depois entre em `/lexgestor/configuracoes`, clique em `Conectar Dropbox` e autorize a conta do escritorio. Os uploads serao salvos em:

```txt
/LexGestor/Escritorio - Nome do Escritorio/Clientes/Nome do Cliente - CPF ou CNPJ/Casos/Nome do Caso/
```

## Como aplicar o banco no Supabase

1. Abra o painel do Supabase.
2. Entre no projeto MBA Labs.
3. Va em SQL Editor.
4. Cole e execute o conteudo de `supabase/migrations/001_initial_schema.sql`.
5. Depois cole e execute o conteudo de `supabase/seed.sql`.
6. Confirme se aparecem as tabelas `core_`, `cot_` e `lava_`.

## Como testar

1. Abra `http://localhost:3000`.
2. Veja a pagina inicial da MBA Labs.
3. Entre em `Criar Admin`.
4. Crie o Admin Master.
5. Entre pelo login.
6. Abra o dashboard.
7. Confira os cards MBA Cotacoes, LavaGestor e BikeComanda.
8. Abra `/api/health` para ver o teste simples de conexao com `core_apps`.
9. Confira no Supabase se as tabelas foram criadas.

## Deploy na Vercel

O primeiro deploy deve usar:

- Repositorio GitHub: `https://github.com/mauriciobarrosaguiar/mbalabs`
- Root Directory: `apps/mba-labs-core`
- Framework: Next.js
- Build Command: `npm run build`
- Install Command: `npm install`

Adicione na Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://jrbkojhnltqfqwpczwuw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
NEXT_PUBLIC_CORE_URL=
LEXGESTOR_TOKEN_SECRET=
DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

## O que ainda falta fazer

- Preencher as chaves reais do Supabase.
- Aplicar a migration no banco.
- Criar o Admin Master pelo portal.
- Evoluir os formularios reais de cadastro e edicao.
- Criar telas completas de pagamentos e assinaturas.
- Refinar permissoes por perfil dentro de cada sistema.
- Adicionar testes automatizados quando as regras de negocio estiverem consolidadas.
