# MBA DroneGestor — execução autorizada no Supabase MBA Labs

Data: 23/11/2026. Titular autorizou expressamente continuar no banco existente, sem criar projeto/branch separado.

## Banco confirmado
- Projeto Supabase: `MBA Labs` (`jrbkojhnltqfqwpczwuw`, produção).
- Antes das alterações: `core_logs` RLS habilitada, 1.028 registros (89 `dronegestor` + 939 de outros módulos).
- Políticas originais `core_logs_select` e `core_logs_insert` preservadas.

## DDL efetivamente executado
Usado `Supabase.apply_migration`, após reabrir o SQL versionado da PR #206.

| Histórico aplicado no Supabase | SQL de origem no GitHub |
|---|---|
| `20261123172039 / dronegestor_restrict_core_logs_data_api_20261123` | `supabase/migrations/20260815140001_restrict_dronegestor_logs_by_role.sql` |
| `20261123172214 / agrodoc_cloud_storage_20261123` | `supabase/migrations/20261117190000_agrodoc_cloud_storage.sql` |
| `20261123172343 / core_logs_revoke_truncate_untrusted_20261123` | `supabase/migrations/20261123172500_core_logs_revoke_truncate_untrusted.sql` |

**Atenção à ferramenta de migrations:** os números de versão gerados no Supabase diferem dos nomes/versões originais dos arquivos Git. As migrations são idempotentes no escopo aqui aplicado, mas uma futura execução automatizada do diretório deverá reconciliar o histórico antes de rodar migrations em lote.

### RLS de `core_logs`
- Foram criadas as quatro políticas **RESTRICTIVE** `dronegestor_logs_api_select/insert/update/delete` para `anon` e `authenticated`.
- As políticas impedem acesso direto às linhas `app_slug = 'dronegestor'`, preservando as linhas de outros aplicativos por meio de `app_slug IS DISTINCT FROM 'dronegestor'`.
- As duas políticas **PERMISSIVE** originais foram mantidas. O backend privilegiado deve continuar usando `service_role` apenas no servidor e verificando autorização de cada OS.
- Também foi removido `TRUNCATE` de `anon` e `authenticated` sobre `core_logs`: PostgreSQL não aplica RLS ao TRUNCATE. `SELECT` e `INSERT` de outros módulos não foram revogados.

### Resultado verificado após a aplicação
- `core_logs` continua com **1.028 linhas: 89 DroneGestor e 939 outras**.
- Simulação **transacional** de usuário `authenticated` real do cadastro ativo (JWT `sub` carregado dentro do banco, sem expor UUID em relatório):
  - `current_user=authenticated`.
  - `SELECT` direto a linhas DroneGestor = **0**.
  - `SELECT` para outros aplicativos = **939** no cenário testado.
  - GRANT `SELECT` e `INSERT` gerais mantidos.
  - GRANT `TRUNCATE` = **false**.
  - GRANT `SELECT` direto a `agrodoc_cloud_files` = **false**.
- Teste de `INSERT` direto de evento fictício DroneGestor sob role `authenticated` foi executado em transação revertida, com cláusula para falhar se a inserção for aceita; não ocorreu gravação.
- **Limite:** testes por role SQL não substituem a avaliação end-to-end pelo PostgREST/Data API e sessão real de cada perfil.

### Estrutura AgroDoc Cloud
Criadas e verificadas, todas RLS habilitadas:
- `agrodoc_cloud_connections`
- `agrodoc_cloud_folders`
- `agrodoc_cloud_files`
- `agrodoc_cloud_events`

Sem policies de cliente e **sem GRANT de anon/authenticated** sobre essas quatro tabelas; serviço possui grants específicos. Teste reversível no banco confirmou inserção lógica de conexão, pasta, arquivo e evento, além de proteção por hash contra arquivo duplicado. A transação foi revertida. Pós-teste: **0 linhas** nas quatro tabelas.

## Reversão (somente em resposta a incidente verificado)
1. Preservar primeiro evidências, status da aplicação e snapshots de políticas.
2. Para reverter apenas restrição DroneGestor: `drop policy if exists dronegestor_logs_api_select on public.core_logs;` e análogos `_insert/_update/_delete`. **Isso reabre a exposição antiga e só pode ser medida emergencial documentada.**
3. Reverter `TRUNCATE` exigiria `grant truncate on public.core_logs to anon, authenticated;` e restabeleceria risco de exclusão total; **não recomendado**.
4. **Nunca executar DROP TABLE em cloud automaticamente.** Se já houver anexos/conexões, preservar os registros. As tabelas recém-criadas não apagam nem substituem buckets de Storage existentes.

## Verificação da configuração Vercel (sem leitura de segredos)
- Ambiente do projeto `mbalabs` examinado apenas por nomes de variáveis, sem descriptografar valores.
- Ausentes nas variáveis configuradas: `AGRODOC_GOOGLE_CLIENT_ID`, `AGRODOC_GOOGLE_CLIENT_SECRET`, `AGRODOC_GOOGLE_REDIRECT_URI`, `AGRODOC_CLOUD_ENCRYPTION_KEY`.
- Portanto a estrutura do banco existe, mas a conexão Google Drive OAuth não está pronta. Não reutilizar tokens do conector Google Drive do ChatGPT como credenciais da aplicação.

## Pendente antes da homologação integral
- Testes autenticados nas APIs com piloto, gestor, RT, sessão inválida e outra empresa, incluindo navegação em produção após deploy compatível.
- Google OAuth, conexões por empresa, uploads/downloads e expiração reais: a criação das tabelas não conecta o Google Drive.
- Offline, dois dispositivos reais, encerramento parcial/complementação por interface, seis resoluções mobile e MAPA com aplicação finalizada.
- Verificar eventual impacto de integração e monitorar logs após publicação. Não simular SARPAS, GPS ou calibração.
- PR #206 permanece aberta, sem merge. Registrar o SHA de deploy produtivo somente após Vercel confirmar READY.
