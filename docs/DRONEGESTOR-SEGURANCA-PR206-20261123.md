# MBA DroneGestor — auditoria RLS e revisão da PR #206
Data: 23/11/2026 · Branch: `fix/dronegestor-navegacao-integrada-20261122`.

## Escopo e limites
- Somente SELECTs de metadados e políticas no Supabase existente. **Nenhuma migration aplicada; nenhuma alteração de dados, usuários, credenciais, funções ou grants de produção.**
- Correção proposta somente no repositório (SQL ainda pendente de autorização).
- PR #206 permanece aberta, em rascunho, sem merge; esta revisão não executa publicação em produção nem promove deploy.
- CI automatizado e testes PGlite não equivalem a uma homologação da Data API do Supabase produtivo com sessões reais.

## Achado confirmado no banco
Tabela `public.core_logs`: RLS habilitada; grants SELECT, INSERT, UPDATE e DELETE a `authenticated`.
Políticas realmente instaladas:
- `core_logs_select` (PERMISSIVE): `is_admin_master() OR empresa_id = current_empresa_id()`.
- `core_logs_insert` (PERMISSIVE): `is_admin_master() OR empresa_id = current_empresa_id()`.
- Nenhuma das quatro políticas `dronegestor_logs_api_*` estava instalada na auditoria.
A migration `20260815140001` não consta do histórico Supabase consultado.
Há 89 registros identificados com `app_slug='dronegestor'`. Não foram encontrados valores com grafia distinta por caixa/espaço. Outros eventos têm `app_slug IS NULL` e pertencem a rotinas gerais da MBA Labs (autenticação e administração), portanto não se deve bloquear esses registros indiscriminadamente.

**Risco:** as políticas atuais não impedem que um usuário autenticado da mesma empresa leia ou forje linhas operacionais DroneGestor usando diretamente a Data API e os grants da tabela. As verificações de API Next.js não impedem essa consulta direta ao PostgREST.
Nenhuma exploração nem acesso indevido foi demonstrado/realizado neste trabalho.

## Correção proposta no repositório
Arquivo: `supabase/migrations/20260815140001_restrict_dronegestor_logs_by_role.sql`.

Revisão:
1. Manter intactas as políticas compartilhadas `core_logs_select` e `core_logs_insert` já instaladas. A versão anterior da migration as substituía e dependia de JOINs em tabelas de permissões, com possível regressão em outros módulos.
2. Instalar somente quatro políticas `AS RESTRICTIVE`, aplicáveis a `anon, authenticated`, para SELECT/INSERT/UPDATE/DELETE.
3. Cada política exige `app_slug IS DISTINCT FROM 'dronegestor'`; restringe todas as políticas permissivas atuais ou futuras para registros marcados como DroneGestor.
4. O backend mantém acesso via service role apenas no servidor, com verificações de empresa, vínculo do piloto e estado da OS; não há mudança de GRANT/REVOKE ou das funções compartilhadas.
5. A migration ainda deve ser testada e aprovada **antes** da execução produtiva.

Teste em `apps/mba-labs-core/tests/dronegestor-rls.test.mjs` utiliza PostgreSQL WASM isolado:
- Reproduz as duas políticas permissivas já instaladas antes da aplicação da migration.
- Confirma que ambas permanecem após a migration.
- Reexecuta a SQL para conferir idempotência e quatro políticas RESTRICTIVE.
- Tenta leitura, inserção, atualização e exclusão de registros DroneGestor com vários papéis e empresas, inclusive sob política permissiva artificial ampla.
- Confirma leitura e inserção normais de registros de outro aplicativo em empresa autorizada.
- Confirma o comportamento do role `anon`, service_role e recuperação transacional.
**Isso é ensaio de política, não é validação da Data API de produção.**

## Correção adicional: integridade dos documentos
Arquivo: `apps/mba-labs-core/src/app/api/dronegestor/documentos/route.ts`.
- O número apresentado no registro de anexo não é mais derivado do campo `ordemServicoNumero` enviado pelo cliente.
- Após `requireDroneOsWriteAccess`, usa o número da OS armazenada no servidor (`authorizedOs.data.numero`).
- Impede que um cliente identifique o anexo com o número de outra OS, apesar do `osId` autorizado.
- Adicionado teste de regressão em `dronegestor-document-upload-context.test.mjs`.

## Revisão estrutural da PR #206
Último estado inspecionado: mais de 120 arquivos alterados, incluindo cerca de 70 arquivos de documentação/evidência, 15 testes e 36 arquivos de implementação. Nenhum arquivo `.env` ou chave privada apareceu na lista de alterados; varredura textual de linhas adicionadas não identificou um token secreto aparente. Isto não substitui scanner especializado.

A PR já contém proteção de acesso a OSs por empresa/piloto, somente consulta de OS cancelada/concluída e correções de navegação e upload. A homologação real dessas funções consta do relatório geral `DRONEGESTOR-HOMOLOGACAO-NAVEGACAO-20261122.md`, com lacunas descritas abaixo.

## Alertas gerais (não modificar nesta PR)
O advisor de segurança Supabase sinaliza funções `SECURITY DEFINER` executáveis por usuários autenticados e tabelas de outros módulos com RLS sem política. As funções `current_usuario_id/current_empresa_id/current_usuario_tipo` usam `auth.uid()` e exigem usuário ativo, mas os privilégios gerais e outras funções precisam de auditoria separada. Não modificar módulos de terceiros sem escopo e testes.

Referências técnicas:
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Pendências e critérios de autorização
1. **Bloqueador para segurança:** testar migration contra uma cópia isolada representativa ou mecanismo local equivalente com o esquema fiel, além dos cenários WASM; validar Data API com sessões reais de Pedro, João, gestor, RT e usuário de outra empresa. Usuário não autorizou outro projeto pago.
2. Revisar backup/restauração e impacto sobre os módulos legados antes de agendar a aplicação produtiva. Preferir transação com rollback automático em falha de validação. Nunca desabilitar RLS como rollback.
3. As políticas ativas continuam vulneráveis até a mudança autorizada ser aplicada e verificada.
4. Concluir homologação mobile em seis resoluções, retomada real entre aparelhos, fluxo de 8 fases e relatórios MAPA com aplicação finalizada.
5. A produção atual aponta para commit da branch PR #206 sem merge em `main`; planejar reconciliação protegida de branches, sem mudança nesta revisão.
6. Não declarar que passou teste no browser quando só foi executado em fixtures.

## Checklist de entrega
- [x] Verificação RLS/grants/migration somente leitura.
- [x] Análise da migration existente e redução de impacto em outros apps.
- [x] Mudanças na SQL pendente, sem aplicação produtiva.
- [x] Correção da fonte confiável do número da OS em upload.
- [x] Testes de regressão adicionados na branch.
- [ ] CI da versão atual e homologação de Data API real (registrar separadamente).
- [ ] Backup, janela controlada e autorização expressa antes de migration.
- [ ] Merge e publicação: **não autorizados nesta execução**.

## Segunda revisão — contas inativas em rotas privilegiadas
A análise do código identificou que as verificações de sessão de diversas APIs autorizavam o perfil `admin_master/super_admin` sem avaliar explicitamente se `profile.status` estava `ativo`. O login padrão pode recusar uma conta inativa, mas essa verificação não substitui a autorização de cada rota acessível diretamente.

Correções propostas **somente na PR**:
- Em 21 rotas API que não possuíam o bloqueio, inserir verificação de perfil ativo antes de criar cliente privilegiado ou de examinar permissões de administrador. Três rotas adicionais e o endpoint de estado já continham validação equivalente.
- `agrodoc-cloud.ts`: `cloudContext` rejeita perfil inativo com 403.
- `apps/dronegestor/layout.tsx`: perfil inativo é redirecionado para acesso bloqueado.
- Regra preservada: um token de sessão válido **não** deve permitir acesso operacional se o cadastro foi inativado.
- `tests/dronegestor-inactive-profiles.test.mjs` verifica a presença de validações de conta ativa em 27 rotas, armazenamento e layout. Trata-se de cobertura estática complementar, não substitui testes reais de requisições com uma conta suspensa.

**Importante:** estas correções no código ainda não estão publicadas; o controle de acesso do banco permanece vulnerável enquanto a migration não for autorizada e aplicada.
