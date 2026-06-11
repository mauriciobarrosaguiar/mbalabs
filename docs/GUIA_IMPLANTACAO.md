# Guia de implantacao MBA Labs

Este guia assume que o projeto Supabase ja existe e que voce vai usar somente ele.

## 1. Supabase

Projeto alvo:

```text
https://jrbkojhnltqfqwpczwuw.supabase.co
```

No Supabase:

1. Abra o projeto MBA Labs.
2. Va em `SQL Editor`.
3. Execute `supabase/migrations/001_initial_schema.sql`.
4. Execute `supabase/seed.sql`.
5. Va em `Table Editor` e confirme as tabelas:
   - `core_empresas`
   - `core_usuarios`
   - `core_apps`
   - `core_planos`
   - `core_assinaturas`
   - `core_pagamentos`
   - `core_permissoes`
   - `core_logs`
   - tabelas `cot_`
   - tabelas `lava_`

## 2. Chaves do Supabase

No painel Supabase, pegue:

- Project URL
- anon public key
- service_role key

Coloque nos arquivos `.env.local`.

Importante:

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` podem ir para o frontend.
- `SUPABASE_SERVICE_ROLE_KEY` nunca pode ir para componente client-side.
- Neste projeto, a service role so aparece em `apps/mba-labs-core/src/app/api/setup-admin/route.ts`, uma rota server-side.

## 3. Rodar localmente

```powershell
cd "C:\Users\Mauricio\Documents\MBA Labs\mbalabs"
npm.cmd install
npm.cmd run dev
```

Abra:

```text
http://localhost:3000
```

Para apps dedicadas:

```powershell
npm.cmd run dev:cotacoes
npm.cmd run dev:lavagestor
```

## 4. Criar Admin Master

1. Abra `http://localhost:3000/setup-admin`.
2. Preencha nome, email, senha e empresa inicial.
3. O sistema cria:
   - usuario no Supabase Auth
   - empresa em `core_empresas`
   - perfil em `core_usuarios`

Por seguranca, a rota bloqueia a criacao se ja existir um usuario `admin_master`.

## 5. Teste de conexao

Abra:

```text
http://localhost:3000/api/health
```

Resultado esperado:

- `ok: true`
- lista de apps em `core_apps`
- `authenticated: true` quando voce estiver logado

## 6. GitHub

Repositorio alvo:

```text
https://github.com/mauriciobarrosaguiar/mbalabs
```

Comandos esperados:

```powershell
git init
git branch -M main
git remote add origin https://github.com/mauriciobarrosaguiar/mbalabs.git
git add .
git commit -m "estrutura inicial MBA Labs com Supabase"
git push -u origin main
```

Se o push pedir login, autentique no GitHub pelo navegador ou usando GitHub CLI.

## 7. Vercel

Na Vercel:

1. Clique em `Add New Project`.
2. Conecte o GitHub.
3. Selecione `mauriciobarrosaguiar/mbalabs`.
4. Configure `Root Directory` como:

```text
apps/mba-labs-core
```

5. Configure as variaveis:

```env
NEXT_PUBLIC_SUPABASE_URL=https://jrbkojhnltqfqwpczwuw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
NEXT_PUBLIC_CORE_URL=https://seu-dominio.vercel.app
```

6. Faça o deploy.

## 8. Proximos passos tecnicos

- Criar CRUD real para empresas, usuarios, planos, assinaturas e pagamentos.
- Criar cadastro e manutencao de permissoes por app.
- Evoluir o MBA Cotacoes usando as regras ja existentes no sistema antigo.
- Evoluir o LavaGestor com telas operacionais completas.
- Criar testes de autorizacao RLS com usuarios de perfis diferentes.
- Criar rotina de backup do banco antes de migracoes futuras.
