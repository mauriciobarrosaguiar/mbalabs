# DroneGestor — execução da missão

Base: PR #197, branch `codex/dronegestor-piloto-pro-audit`, commit d678a08.
Produção preservada. Nenhuma migration aplicada, nenhum deploy ou merge autorizado.

## Critérios de acompanhamento
Cada requisito só é aceito após evidência de teste; código existente não equivale a homologação. Situações: pendente, em implementação, implementado sem homologação, validado localmente, homologado em ambiente isolado.

| Fase | Situação | Evidências e pendências |
| --- | --- | --- |
| 1 Fundação | Em implementação | Repositório obtido; dependências instaladas; 15 testes existentes aprovados. RLS e banco real ainda não homologados. |
| 2 Operações | Em implementação | Fluxos existentes de OS, campo, mapas e calculadora identificados; evitar duplicação. |
| 3 Gestão | Pendente | Reutilizar cadastros/equipamentos existentes; avaliar financeiro, estoque e manutenção. |
| 4 Piloto Pro | Implementação inicial existente | 14 artigos temáticos, pesquisa sem acentos. PDF integral, mídia e validação por modelo pendentes. |
| 5 Expansão | Pendente | Google Drive existente no código; conexão OAuth real e isolamento precisam de teste. Dropbox, portal e notificações a avaliar. |
| 6 Homologação | Pendente | Sem conta de teste nem Supabase isolado configurados neste ambiente. |

## Segurança e limites observados
- APIs operacionais ainda usam core_logs; migração requer inventário e compatibilidade antes de troca.
- Endpoint de modelo MAPA usa perfil global e diverge de canManageDroneGestor.
- Dados offline existentes usam localStorage e backup por proprietário; IndexedDB e concorrência entre aparelhos ainda precisam de implementação e testes.
- Nenhum percentual global declarado: falta decompor integralmente os critérios e comprovar aceite.

## Retomada
Ler este arquivo e o diff antes de executar novamente. Não repetir testes aprovados salvo alteração relacionada. Não confundir teste unitário com integração Supabase, homologação autenticada ou validação de modelo oficial MAPA.

## Implementações desta execução

| Tarefa | Situação | Arquivos principais | Evidência / pendência |
| --- | --- | --- | --- |
| Permissão do modelo MAPA | Validada com fixture do handler | api/dronegestor/relatorio-mensal/modelo-oficial/route.ts | 401, 403 piloto, gestor/RT chegam à validação de arquivo; teste Supabase pendente |
| Preservar edições durante upload e descartar resposta de outra conta | Validada regra unitária; integração pendente | campo/DronePersistenceSync.tsx, lib/dronegestor-sync-guard.ts | Três testes unitários e quatro testes do sincronizador real com rede/storage controlados; dois aparelhos ainda não testados |
| Central de misturador, vazão, rendimento e custos | Implementada; matemática validada | ferramentas/*, lib/dronegestor-calculations.ts | Seis testes; navegador bloqueado |
| Carga decimal e parcial na calculadora existente | Validada matemática | calculadora/QuickCaldaCalculatorV3.tsx | Reutiliza calculateLoads; carga decimal não gera abastecimento extra |
| Menu expansível e recolhível com identidade DroneGestor | Implementado sem homologação visual | DroneAppShell.tsx, layout.tsx, agrodoc.css | Apenas rotas existentes; gestão filtrada por perfil |
| Favoritos, histórico e progresso local | Implementado sem teste de interação | piloto-pro/* | Chaves por empresa/usuário; sem sincronização remota; importação PDF pendente |
| Relógio do dashboard e erros de lint do módulo | Validados por lint/build | DroneHomeDashboard.tsx, conferência, XLSX, agrodoc-cloud.ts | Sem mudança de outros aplicativos |
| Segurança real core_logs | Inspecionada somente leitura | DRONEGESTOR-SEGURANCA-20261121.md | Políticas amplas confirmadas; bloqueio de liberação |

## Cobertura e trabalho ainda não aceito

Os 33 testes automatizados da suíte DroneGestor passaram. Build e TypeScript passaram. Lint do módulo ficou sem erros, com avisos legados; lint global também contém erros fora deste escopo. Evidências em docs/evidence/dronegestor. Não são testes E2E autenticados.

Ainda não foram concluídos: tabelas operacionais próprias e migração; RLS homologada; IndexedDB/PWA integral; dashboard completo com filtros; fluxo integral OS e interrupção; mapas profissionais e KMZ; catálogo de modelos oficiais; estoque, manutenção e financeiro integrado; importação integral do e-book; imagens interativas e fontes revisadas; assistente RAG; simulador; portal; Dropbox; notificações; relatórios oficiais homologados; testes de desempenho, todos os perfis e seis resoluções.

Nenhuma das seis fases completas recebeu aceite. Não existe base para anunciar percentual global de funcionalidades concluídas; contar apenas arquivos ou testes produziria um percentual enganoso.

## Dependências externas e do ambiente

- Não há Supabase isolado identificado nem contas de homologação configuradas no executor. A conta conectada mostra o MBA Labs ativo; nenhuma escrita foi feita nele.
- Credenciais OAuth e consentimento de cada empresa, amostras DJI e modelo MAPA oficial revisado precisam ser fornecidos/configurados na etapa correspondente.
- Testes de navegador bloqueados no executor por restrição de socket; fallback remoto não alcançou localhost. Harness preparado, sem screenshots fabricados.
- A missão permanece em andamento: esta entrega é incremental e não representa 100% nem autorização para produção.


## Continuação — correções das 23 capturas (21/11/2026)

| Requisito | Entrega nesta rodada | Aceite pendente |
| --- | --- | --- |
| MBA Calda | Releitura da implementação Android em mba-calda-native-android; nova interface web por etapas, múltiplos produtos, doses por ha e por 100 L, cargas parciais, capacidade cadastrada ou personalizada, consulta AGROFIT. Modo campo usa os dados da missão e a mesma função matemática. Calculadora pública preservada. | Testes visuais/autenticados e integração completa OS. |
| Visual e navegação | Cabeçalhos principais MBA DroneGestor; histórico claro; submenu de ferramentas unificado; Minha equipe; categorias Piloto Pro e link da biblioteca de produtos; retirada de contador de etapas legado no campo. | Revisão das páginas remanescentes, responsividade real, todos os perfis. |
| Solo/equipe | Gestor autorizado em Solo explícito pode preparar OS própria sem cadastrar outro piloto. Autorização de criação de colaboradores continua dependendo do contrato. Erro de equipe indisponível tratado separadamente. | Validar com contas reais isoladas; corrigir eventuais vínculos comerciais somente mediante autorização. |
| Segurança operacional | Prontidão local exige SARPAS autorizado com protocolo e GPS válido, sem substituir validação do servidor; demais bloqueios existentes preservados. | Fluxo exato de oito fases, interrupção segura com área parcial e retomada ainda não homologados/implementados integralmente. |
| Drive | Instruções OAuth acessíveis em Configurações; código existente reaproveitado. Metadata Vercel não revelou chaves específicas AGRODOC. | Credenciais, callback QA, migration de armazenamento e teste real de conexão, upload, download, renovação e isolamento. |
| SARPAS | Adaptador server-only preparado, com rotas oficiais documentadas, feature flag, tratamento de erros e status restrito a gestor. Configuração mostra etapas do credenciamento. Envio oficial bloqueado. | Credenciamento, token delegado, persistência segura por operador, autorização, consulta real, protocolo e testes com DECEA. |
| Demais órgãos | Links oficiais atualizados, ANAC com acesso pelo gov.br, AGROFIT reaproveitado no cálculo e biblioteca. | Não afirmar API transacional para órgãos sem confirmação; validar links e consultas reais; rotina diária de importação ainda não implementada. |
| MAPA | Exportador/modelo anterior preservado. | XLSX oficial não localizado/validado nesta execução, não simular protocolo SEI. |
| Piloto Pro | Categorias e navegação em cards, sem inventar mídia ou fichas. | E-book integral, fotos autorizadas, telas interativas, especificações por modelo e conteúdo revisado. |

### Segurança / ambiente
Consulta somente leitura em produção confirmou novamente core_logs_insert e core_logs_select com autorização ampla por empresa. Migration 20260815140001_restrict_dronegestor_logs_by_role.sql continua pendente de validação isolada. Nenhum projeto QA dedicado ao DroneGestor foi identificado. Variáveis Supabase específicas da branch não foram identificadas nos metadados; não é seguro assumir que preview está isolado. Não realizar gravação de homologação nesse preview sem confirmar o banco. Nenhuma migration aplicada nem dado produtivo alterado. Dois testes matemáticos acrescentados; 33 testes antigos pertencem à execução anterior, não constituem aprovação dos commits atuais. Aguardar evidência CI/preview antes do aceite; E2E autenticado não realizado. Nenhuma solicitação oficial enviada.

### Dependências do proprietário
1. Criar/autorizar banco Supabase de homologação separado, com contas Gestor/Piloto/RT e perfis adicionais para aceite.
2. Ativar Google Drive API no Google Cloud e criar OAuth Web com callback específico do ambiente; configurar AGRODOC_GOOGLE_CLIENT_ID, AGRODOC_GOOGLE_CLIENT_SECRET, AGRODOC_GOOGLE_REDIRECT_URI e AGRODOC_CLOUD_ENCRYPTION_KEY diretamente na Vercel, sem expor valores.
3. Solicitar credenciamento oficial DECEA como Provider Eco UTM, usando https://ajuda.decea.mil.br/assuntos/sarpas-api?lang=pt-br e configurar chave somente no servidor após aprovação.
4. Disponibilizar arquivo XLSX oficial MAPA, edição original do e-book e mídias com autorização.
5. Homologar antes de qualquer publicação em produção.

Entrega incremental. PR permanece em rascunho. Não representa missão 100% concluída.
