# MBA Escola

Aplicativo PWA independente, mantido no monorepo MBA Labs, para comunicação e acompanhamento entre escola, professores e famílias.

## Escopo da primeira versão

- login próprio por e-mail e senha;
- perfis de direção, coordenação, professor e responsável;
- mural de comunicados;
- aulas e tarefas;
- atividades e entregas;
- reuniões;
- acompanhamento individual do aluno;
- PWA com nome, ícone, manifesto e sessão próprios.

Não fazem parte desta etapa: financeiro, mensalidades, matrícula, boletim, biblioteca, cantina, transporte, folha de pagamento e inteligência artificial.

## Arquitetura

- repositório: mesmo monorepo `mauriciobarrosaguiar/mbalabs`;
- aplicação: `apps/mba-escola`;
- desenvolvimento local: porta `3006`;
- hospedagem recomendada: projeto Vercel separado;
- banco e autenticação: projeto Supabase separado do banco principal da MBA Labs;
- entrada pelo portal: `/mba-escola`, redirecionada pela variável `NEXT_PUBLIC_MBA_ESCOLA_URL`.

## Desenvolvimento local

Na raiz do monorepo:

```powershell
npm.cmd install
Copy-Item apps\mba-escola\.env.example apps\mba-escola\.env.local
npm.cmd run dev:escola
```

Abra:

```txt
http://localhost:3006
```

## Supabase

1. Crie um projeto Supabase exclusivo para o MBA Escola.
2. Copie URL, chave anônima e service role para o ambiente correto.
3. Aplique a migration:

```txt
apps/mba-escola/supabase/migrations/20260806211500_mba_escola_mvp.sql
```

4. Crie os usuários inicialmente pelo painel administrativo do Supabase.
5. Insira a escola e o perfil correspondente usando service role ou SQL Editor.

Variáveis:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3006
```

Nunca envie `.env.local`, service role ou senhas para o GitHub.

## Deploy recomendado na Vercel

Crie um novo projeto usando o mesmo repositório GitHub:

- Root Directory: `apps/mba-escola`
- Framework: Next.js
- Install Command: `npm install`
- Build Command: `npm run build`
- domínio sugerido: `escola.mbalabs.com.br`

Depois, no projeto Vercel do portal MBA Labs, configure:

```env
NEXT_PUBLIC_MBA_ESCOLA_URL=https://escola.mbalabs.com.br
```

Assim o MBA Escola aparece no ecossistema MBA Labs, mas mantém login, domínio, deploy, banco e PWA independentes.
