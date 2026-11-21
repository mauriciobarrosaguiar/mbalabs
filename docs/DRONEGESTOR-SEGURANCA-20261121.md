# DroneGestor — segurança e bloqueios de liberação

Revisão de 21/11/2026. Não representa certificação de segurança nem homologação de ponta a ponta.

## Achado confirmado no banco real (somente leitura)
Projeto MBA Labs, ativo. Consulta a `pg_policies` de `public.core_logs` retornou:

- SELECT autenticado: `is_admin_master() OR empresa_id = current_empresa_id()`.
- INSERT autenticado: `is_admin_master() OR empresa_id = current_empresa_id()`.

Consequência: as políticas atuais não restringem a leitura de registros por piloto nem impedem inserções diretas em logs operacionais da mesma empresa. Validação de APIs com service role não protege contra acesso direto pelo Data API quando grants e política permitem. Não foi tentada exploração nem inserção de dados reais.

O arquivo `supabase/migrations/20260815140001_restrict_dronegestor_logs_by_role.sql` contém restrições específicas para DroneGestor. A listagem de migrations do banco não apresentou essa versão nem `20261117190000_agrodoc_cloud_storage`. A ausência no histórico, isoladamente, não comprova ausência de objetos aplicados manualmente; a política consultada confirma a divergência em core_logs.

Não aplicar a migration diretamente em produção durante esta missão. Primeiro conferir as funções auxiliares e os perfis existentes em cópia isolada, fazer backup, testar gestor/RT/pilotos/empresa distinta/Data API, revisar rollback e pedir autorização de publicação. Não desabilitar RLS no rollback.

## Correções no código

- Endpoint de cadastro do modelo MAPA usa a mesma resolução de perfil específico do app que os demais endpoints.
- Resposta assíncrona da sincronização é descartada quando mudou o proprietário local.
- Edições realizadas durante um upload permanecem pendentes, em vez de serem confirmadas por um snapshot antigo.
- Hidratação e retentativas verificam a identidade local antes de aplicar resposta.
- Favoritos/leitura são separados por empresa e usuário. Preferências locais não equivalem a controle de acesso de conteúdo.

## Limites e próximos testes

- Testes de permissão usam fixtures: não substituem teste das políticas reais.
- Não foi validada concorrência entre aparelhos, IndexedDB, sessão revogada, quota local nem recuperação de fechamento inesperado.
- Favoritos/histórico são locais e não têm sincronização entre aparelhos.
- Arquivo XLSX válido estruturalmente não comprova ser o modelo oficial vigente do MAPA.
- Nenhuma fonte normativa, manual de drone ou especificação nova foi homologada nesta entrega.
- Nenhuma credencial foi adicionada ao código. Nenhum dado de produção foi escrito ou removido.

## Avisos do Supabase

Advisors consultados em modo somente leitura: RLS sem política em tabelas de outros módulos, funções SECURITY DEFINER executáveis por autenticados e proteção de senhas vazadas desativada. Não alterar os demais apps nesta missão. Alertas requerem análise de intenção e privilégios; não são, por si só, prova de exploração.

Referências de remediação:
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
