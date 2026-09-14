# MBA Educação — Fase 1

Plataforma educacional criada como aplicação isolada dentro do monorepo MBA Labs, sem alterar o MBA Labs Core.

## Modelo visual escolhido

Interface clara, moderna e responsiva, inspirada em padrões atuais de marketplaces educacionais e produtos SaaS:

- navegação simples por tipo de formação;
- cards grandes e visuais;
- catálogo com filtros;
- página de venda de curso;
- área do aluno focada em continuidade e progresso;
- painel administrativo para cursos, alunos, instituições e certificados;
- mobile-first com navegação inferior na área do aluno.

## Rotas da fase 1

- `/` — loja / landing page;
- `/cursos` — catálogo;
- `/curso/[slug]` — detalhe do curso;
- `/aluno` — área inicial do aluno;
- `/admin` — painel administrativo inicial.

## Estrutura preparada para

### Cursos próprios

- rápidos;
- profissionalizantes / cursos livres;
- aulas, módulos e materiais dentro do MBA LMS;
- progresso e certificado próprio.

### Instituições parceiras

Cada curso pode definir:

**Ambiente de estudo**
- `mba_lms`;
- `portal_parceiro`;
- `hibrido`.

**Certificação**
- `mba`;
- `parceiro_upload` — instituição emite e o documento aparece na plataforma;
- `parceiro_link` — aluno acessa o portal oficial;
- `parceiro_api` — integração futura para matrícula/conclusão/certificado.

Isso permite operar pós-graduação e cursos técnicos com a instituição responsável preservando suas atribuições acadêmicas.

## Banco de dados

O arquivo `supabase/001_schema.sql` contém o modelo inicial com prefixo `edu_`, preparado para coexistir com o Supabase único do MBA Labs.

**A migração não foi aplicada automaticamente.** As políticas RLS finais devem ser criadas junto da integração com o login único e os perfis `admin`, `aluno` e `parceiro`.

## Desenvolvimento

```bash
npm install
npm run dev
```

Porta padrão: `3010`.

## Vercel

Para manter esta fase isolada, usar um projeto Vercel separado apontando para:

`apps/mba-educacional`

Depois da validação, a aplicação pode ser ligada ao portal MBA Labs sem reescrever o frontend.
