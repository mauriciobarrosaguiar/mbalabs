# Continuação da missão — 22/11/2026

Base confirmada no GitHub e no clone: PRs 197, 201, 202, 203 e 204 merged;
main e7f1539973d258e2106770617b98fb0af35eaf0d.
Branch fix/dronegestor-seguranca-fluxo-20261122. Sem deploy, merge, escrita produtiva ou migration aplicada.
Relatórios de progresso, segurança, perfis e MAPA (simulação/original) lidos antes da alteração.

## P1 — proteção do event store

A política anterior confunde autoria com atribuição: uma OS criada pelo RT para Pedro
tem usuario_id do RT; documentos podem ter sido enviados pelo administrador. Não é seguro
expor detalhes JSON brutos com base apenas no autor. Toda a interface DroneGestor consultada
usa handlers privilegiados; nenhum acesso cliente direto a core_logs foi encontrado no módulo.

A migration pendente recebeu quatro políticas RESTRICTIVE para anon/authenticated que negam
SELECT/INSERT/UPDATE/DELETE de app_slug=dronegestor. O acesso legítimo (incluindo administrador)
continua pelas APIs, que verificam sessão, contrato, empresa, perfil e atribuição. Não há grant novo,
revogação global nem alteração de políticas de outros módulos. service_role ignora RLS: cada handler
continua sendo fronteira de segurança e a migration não corrige uma eventual falha nesses handlers.

Teste executa SQL real PostgreSQL com PGlite, schema mínimo fictício e sem conexão externa.
Matriz: Pedro, João, gestor, RT, administrador empresarial, master, outra empresa, usuário sem
permissão e identidade vazia. Todos sem acesso direto ao event store DroneGestor. Testa também
anon, service_role, tentativa de promoção de registro de outro módulo e política permissiva ampla.
Leitura de outro módulo permanece autorizada pelo escopo original. SQL aprovado; PostgREST,
JWT expirado/revogado, Storage e catálogo real NÃO homologados por esse teste.

### Revisão e recuperação antes de qualquer produção

1. Consultar pg_policies, grants e funções reais em modo somente leitura, comparar com o schema
   versionado e verificar clientes externos que possam depender de Data API direta.
2. Executar suíte local e testes autenticados de APIs com empresa fictícia; revisar todo uso service_role.
3. Backup e aplicação transacional SOMENTE após autorização específica. A versão antiga ainda
   não aplicada foi editada; conferir histórico real antes de escolher migration incremental.
4. Falha na transação: ROLLBACK. Teste comprova que rollback restaura a proteção.
5. Após commit, preferir correção progressiva mantendo as políticas restritivas; não restaurar
   políticas amplas nem desabilitar RLS como recuperação. Reverter aplicação para versão compatível
   com APIs se algum cliente direto for identificado. Nenhum script destrutivo de rollback automático.

| Módulo | Cenário | Ambiente | Usuário | Esperado / obtido | Status | Evidência |
|---|---|---|---|---|---|---|
| Segurança | Acesso bruto aos logs | PostgreSQL WASM descartável | matriz acima | SELECT vazio, INSERT negado, UPDATE/DELETE sem linhas | Validado por teste automatizado | tests/dronegestor-rls.test.mjs |
| Segurança | service_role | PostgreSQL WASM descartável | papel privilegiado | leitura/escrita permitidas; APIs devem autorizar | Validado por teste automatizado | mesmo teste |
| Outros módulos | Leitura original | PostgreSQL WASM descartável | empresa A | linha autorizada preservada | Validado por teste automatizado | mesmo teste |
| Segurança | Data API/JWT/catálogo real | Produção | contas existentes | não executado nesta rodada | Pendente | sem evidência nova |

Este documento é incremental. As demais prioridades não estão aprovadas por esta entrega.

## P2 — encerramento parcial (implementação incremental)

Novo endpoint execucao-parcial e ação no modo Campo guiado. Exige sessão ativa, contrato,
empresa/atribuição, permissão operacional, OS iniciada no servidor, motivo/justificativa,
área positiva inferior ao planejamento e soma de cargas consistente. Não relaxa pré-voo
nem permite encerrar uma OS em preparação. Não gera operacao_finalizada, faturamento ou
aprovação MAPA. OS fica suspensa com execucaoParcialAtiva e histórico cumulativo de checkpoints.

Snapshot, autor, motivo e totais são gravados na mesma atualização condicional da OS: CAS
por updatedAt, repetição por requestId e rejeição de remoção/alteração de cargas anteriores.
A complementação usa a própria OS e preserva cargas, área e início original; exige novamente
medição, risco, calibração/checklist e validação de início no servidor. Estado parcial não é
convertido automaticamente pelo sincronizador de ciclo em execução/preparação. Encerramento
total recusa hectares acima do planejado, execução parcial ainda ativa e perda de cargas anteriores.

8 testes novos aprovados (3 regras e 5 handlers com fixtures): 20/12/8 ha chuva, validações,
autenticação, piloto/empresa diferente, preparação/conclusão/cancelamento, conflito e repetição.
Suíte completa: 124 cenários,123 aprovados,1 ignorado (original MAPA ainda não preparado nesta
rodada). TypeScript aprovado. Nenhuma conclusão em produção.

Limites: encerramento parcial exige internet para confirmação atômica; offline continua permitindo
pausa/persistência existente, sem fila nova de encerramento parcial. Recuperação em outro dispositivo,
concorrência inicial do estado de campo, todos os modos legados, relatório de parcial sem complementação,
faturamento e duração efetiva descontando pausas seguem pendentes. Não homologado visualmente nem
como ciclo integral. Snapshot do checkpoint permanece no servidor mesmo se houver perda do aparelho,
mas ainda não há botão específico de recuperação desse snapshot em novo aparelho.

| Módulo | Cenário | Ambiente | Usuário | Esperado / obtido | Status | Evidência |
|---|---|---|---|---|---|---|
| Campo | 20/12/8 ha chuva | fixture de API | Pedro | suspensa, saldo8ha, histórico preservado | Validado por teste automatizado | dronegestor-partial-api.test.mjs |
| Campo | repetir/conflito | fixture de API | Pedro | sem duplicação;409 em concorrência | Validado por teste automatizado | mesmo teste |
| Campo | outro piloto/empresa | fixture de API | João/B |403/404 sem escrita | Validado por teste automatizado | mesmo teste |
| Campo | complementação cumulativa | fixture de API | Pedro | preserva carga inicial, rejeita adulteração | Validado por teste automatizado | mesmo teste |
| Campo | encerramento parcial e total publicados | Produção | Pedro | não executado; OS protegida | Bloqueado por autenticação nesta sessão | navegador redirecionou ao login |

## P3 — oito fases e bloqueios

Rótulos/objetivos foram alinhados às oito fases pedidas. Documentos e pós-operação têm
atalhos para os módulos existentes. Removida a barra cujo percentual era calculado pelo
número da tela aberta: navegação não é progresso homologado. As validações atuais de avanço
foram preservadas. Isso NÃO implementa por si só a reconstrução integral das fases: matriz
persistente por fase, pendências/vencimentos de todos os documentos, mapas/obstáculos e
conferência integral ainda pendentes.

Achado adicional concreto: Number(null), Number('') e booleanos podiam ser aceitos como
coordenadas em handlers de início/pré-voo/fechamento. Novo validador compartilhado recusa
ausências, coerções e valores fora dos limites geográficos; zero numérico continua válido.
Teste de regressão cobre esses casos. Alterações da OS pelo cadastro passam a usar atualização
condicional para não sobrescrever checkpoint concorrente.

## P4 — OS existente

Consulta produtiva estritamente de leitura confirmou OS-20261121-71DF6 com1,5ha, em_preparacao
e missaoPlanejada salva. Nenhuma nova OS criada. Navegador desta sessão redirecionou ao login;
nenhum formulário autenticado submetido. Testes anteriores RT/Pedro/cálculos são preservados
como evidência histórica; não foram repetidos/rotulados como aprovação nova. As finalizações
continuam bloqueadas por requisitos legítimos e serão testadas apenas com fixtures até haver
sessão e condições autorizadas. Nenhuma medição, inspeção ou autorização inventada.

## P5 — modelo original e relatórios

Original recuperado dos arquivos autorizados (4.059.389bytes); teste do handler real executado
com original, sem banco, incluindo comparação das partes ZIP/fórmulas/validações. Suíte nesta
rodada:125 testes aprovados,0 ignorados antes das alterações finais. Não substituído por modelo
sintético e não incorporado ao git. Excel nativo e recálculo continuam pendentes. Relatório mensal
produtivo com conclusão/conferência permanece sem homologação nova. Não houve envio oficial.

## Catálogo produtivo, somente leitura

Confirmadas políticas core_logs_select/insert amplas por empresa, RLS habilitada e grants
SELECT/INSERT/UPDATE/DELETE a anon/authenticated (sem políticas UPDATE/DELETE efetivas atuais).
Há também TRUNCATE/REFERENCES/TRIGGER no catálogo: RLS não controla TRUNCATE; Data API comum
não oferece essa ação. Não alterados grants globais pois a tabela é compartilhada; requer revisão
administrativa do papel/conexões SQL. Funções auxiliares são SECURITY DEFINER com search_path=public.
As quatro políticas novas ainda NÃO existem na produção. agrodoc_cloud_connections ausente.

## P6 — mobile e documentos

Chromium instalado, mas lançamento local falhou: socket() failed: Operation not permitted.
Servidor local iniciou; rota sintética temporária de teste foi removida e servidor encerrado.
Não existem capturas antes/depois nem homologação360/390/768/1024/1440/1920 nesta rodada.
Prévia PDF mantém sandbox; acrescentada alternativa visível de abertura em outra aba, com
aviso de expiração do link. Não se afirma correção do bloqueio interno do Chromium.
O relógio de frescor da previsão usa atualização por efeito, removendo4 erros lint de pureza.

## P7 — integrações

| Integração | Implementado/inspecionado | Validado agora | Bloqueio/pendência |
|---|---|---|---|
|Drive|OAuth state aleatório, cookie criptografado HttpOnly/Secure/Lax, expiração10min, vínculo usuário/empresa, drive.file, tokens criptografados|Revisão de código; catálogo produtivo sem agrodoc_cloud_connections|Migration não aplicada; OAuth/callback/refresh/quota/upload por empresa sem teste real|
|SARPAS|Provider server-only e flags, erros limitados, sessão delegada, envio bloqueado|Teste local confirma ausência de chamadas em provider desabilitado/sem delegação/envio|Credenciamento DECEA, credencial e homologação externa; nenhuma alteração de flag|
|AGROFIT|CSV oficial, cache temporário, fonte/data da revisão local e officialAvailable/officialError|Revisão de código, sem nova consulta oficial nesta rodada|Não afirmar atualidade de revisão local ou equivalência ao cadastro vigente|
|MAPA|Exportação manual preservando original; sem endpoint de envio fictício|Handler e original com fixtures|Excel nativo e fluxo publicado com aprovação pendentes; sem envio|

## P8 — verificação e limites

Suíte DroneGestor126/126 aprovada com original XLSX nesta rodada. Build Next/TypeScript
aprovado antes dos últimos ajustes de UI; repetição final registrada abaixo. ESLint do módulo
verificado:0erros/18avisos (navegação, imagens e variáveis preexistentes). Lint global não está
aprovado por esse comando. Não foram executados voos, envio oficial, migrations nem escritas
produtivas. Sessão autenticada não salva em arquivos.

Revisão adicional do estado: consultas próprias agora incluem empresa além do usuário e
UPDATE sincronizado passa a comparar a revisão na própria mutação. A criação simultânea da
primeira linha de estado ainda depende de unicidade/schema; não declarada resolvida.

## P9 — entrega incremental, não missão concluída

PR será aberta em rascunho. Sem merge/deploy produtivo. Migration existente alterada só para
revisão. Recuperação do código: reverter commits desta PR antes do merge; para eventual publicação
futura, reverter aplicação mantendo dados/checkpoints e proteção de banco; não apagar histórico.
A prévia, se criada automaticamente pelo provedor, pode usar o banco de produção: não realizar
escritas nela sem a mesma restrição à empresa fictícia e sem autorização para a versão testada.

A missão integral permanece PENDENTE: reconstrução completa de fases, fechamento total de ponta
a ponta, parcial offline/recuperação, duração descontando pausas, permissões reais/Data API,
seis larguras, Excel e integrações. Compilação e fixtures não representam esses aceites.

### Resultado final local

128/128 testes aprovados,0ignorados; build Next e TypeScript aprovados após os últimos ajustes.
Lint:0erros/18avisos no escopo registrado em evidence/dronegestor/missao-20261122/lint.txt.
Logs de teste/build/lint preservados na mesma pasta. Hash do original:
6702aa0bd04e1e33bfc17bad7745dc0b4a59ff00ccb5d10941b4a737404b4ef5.
Contagem independente original/saída:16abas,311.660fórmulas,108validações.
O hash da saída varia com metadados ZIP; preservação foi comparada por partes e conteúdo.
Sem alterações funcionais em outros aplicativos; apenas lockfile compartilhado ganhou dependência
PGlite de desenvolvimento (versão0.5.17fixada). Nenhum novo pacote Supabase.

### Matriz de homologação desta rodada

| Módulo | Cenário | Ambiente | Usuário | Resultado esperado | Resultado obtido | Status | Evidência | Correção/commit |
|---|---|---|---|---|---|---|---|---|
|Segurança|Leitura/inserção/alteração/exclusão direta dos logs DroneGestor|PostgreSQL WASM descartável, schema mínimo|Pedro/João/gestor/RT/admin/outro/sem permissão|Sem acesso bruto; API continua fronteira de autorização|SELECT vazio, INSERT negado, UPDATE/DELETE sem linhas|Aprovado automatizado, não Data API|dronegestor-rls.test.mjs; testes.txt|d5f7a69c|
|Segurança|Política permissiva concorrente e promoção do app_slug|PostgreSQL WASM descartável|authenticated|Restrição prevalece|Inserção/promoção negadas|Aprovado automatizado|mesmo teste|d5f7a69c|
|Campo|Encerrar20ha com12aplicados/8pendentes por chuva|Fixture de handler|Pedro|OS suspensa sem conclusão integral|Checkpoint cumulativo com motivo/autor/saldo|Aprovado automatizado|dronegestor-partial-api.test.mjs|8e71e150|
|Campo|Retry e atualização concorrente|Fixture de handler|Pedro|Sem duplicação/sobrescrita|duplicate=true ou409|Aprovado automatizado|mesmo teste|8e71e150|
|Campo|Outro piloto/outra empresa/sem sessão|Fixture de handler|João/B/sem sessão|Negar escrita|403/404/401 sem escrita|Aprovado automatizado|mesmo teste|8e71e150|
|Campo|Complementação mantém cargas anteriores|Fixture de handler|Pedro|Preservar carga inicial, somar só novas|Remoção negada;12+2=14ha,6pendentes|Aprovado automatizado|mesmo teste|8e71e150|
|Segurança|GPS ausente/fora dos limites|Unitário|sem sessão|Recusar ausências/coerções/faixas inválidas|Validador recusa;0/0numérico permitido|Aprovado automatizado|dronegestor-coordinates.test.mjs|e1eed46f|
|Sincronização|Mesmo usuário com estado antigo de outra empresa|Fixture de handler|Pedro|Não hidratar estado da empresa anterior|Somente empresa corrente retornada/atualizada|Aprovado automatizado|dronegestor-state-cas.test.mjs|070bfe90|
|Sincronização|Corrida entre leitura e mutação|Fixture de handler|Pedro|409 sem sobrescrever|409 sem escrita; servidor retorna estado para conferência|Aprovado automatizado|mesmo teste|070bfe90|
|MAPA|Handler real com modelo original e cenário fictício|Arquivo e consultas em memória|RT fictício|Preservar estrutura e preencher células permitidas|Partes/fórmulas/validações preservadas|Aprovado automatizado; não Excel|dronegestor-mapa-original.test.mjs|Código anterior PR204; regressão desta rodada|
|SARPAS|Flags/delegação/envio oficial|Teste local com fetch controlado|sem sessão delegada|Nenhuma chamada oficial|0chamadas|Aprovado automatizado|dronegestor-sarpas-provider.test.mjs|070bfe90|
|OS existente|Consultar estado da OS71DF6|Produção, leitura SQL|acesso administrativo autorizado|Preservar preparação/plano|em_preparacao,1,5ha,plano salvo|Aprovado somente leitura; sem aceite UI|consulta registrada nesta missão|Sem alteração|
|Fases1–8|Ciclo integral|Produção/interface|contas existentes|Avanço validado por dados|Sem sessão nesta rodada; reconstrução integral pendente|Bloqueado/parcialmente implementado|login observado; relatório|e1eed46f|
|Mobile/documentos|6larguras e PDF comum|Local/publicado|contas existentes|Capturas e interação aprovadas|Chromium local sem socket; publicado sem sessão|Bloqueado|erro real registrado; sem capturas fabricadas|070bfe90prepara alternativa PDF|
|Excel|Abrir/recalcular nativamente|Excel|operador|Fórmulas recalculadas|Não executado|Pendente|sem evidência|—|

### Rastreabilidade de dados

Nesta execução nenhum usuário, OS, anexo ou perfil fictício foi criado/alterado em produção.
Os17anexos anteriores e a OS Solo permanecem somente como inventário histórico do relatório
anterior, sem nova contagem pela interface. Não foi feita limpeza nem remoção de dados.

## Entrega e retomada autenticada

PR205 aberta em rascunho: https://github.com/mauriciobarrosaguiar/mbalabs/pull/205.
Commit remoto consolidado5bb1d45955491d4df0f669ae7b258f43489e7b1e, árvore
b2931f06d5593fb8e9795f58576e187b042ac5f5 idêntica à árvore local testada. Os SHAs anteriores
neste documento são commits locais de implementação; a entrega remota os consolida.

GitHub Actions DroneGestor validation14 e MBA Labs Core CI733: success.
Prévia Vercel dpl_BECN3XWmj9fiW6Fzds22MmA3K9H8: READY, target=null (preview), commit5bb1d45:
https://mbalabs-o8i30i204-emsgenericosto-3419s-projects.vercel.app.
Não é publicação em produção; proteção de acesso Vercel mantida. Não se presume banco isolado.

O primeiro formulário seguro foi cancelado. Após pedido do usuário para reenviar, novo login
seguro foi submetido e a interface publicada confirmou a conta Pulveriza63. Nenhuma credencial
foi exposta ao agente ou armazenada. Lista mostra somente as duas OS fictícias conhecidas,
ambas1,5ha, sem execução em campo. A OS71DF6 permanece atribuída a E2E PilotoPedro.

Abertura somente de leitura do planejamento confirmou: drone HOMOLOGAÇÃO P63, taxa10L/ha,
tanque20L, faixa5m, velocidade18km/h, altura3m, produto fictício100mL/ha. Não foi clicado Salvar,
não houve nova atribuição nem início/encerramento. Bloqueio por falta de sessão foi superado
para esta conta; faltam sessões específicas Pedro/João/gestor/RT para os novos cenários.
As correções desta PR continuam fora da produção; consulta publicada não homologa o código novo.
