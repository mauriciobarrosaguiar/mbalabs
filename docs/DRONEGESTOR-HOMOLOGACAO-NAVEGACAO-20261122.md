# DroneGestor — revisão e homologação de navegação — 22/11/2026

## Situação do aceite

**Homologação funcional completa pendente. Não aprovar merge nem produção com base nesta execução.**

PR #206 aberta em rascunho. Revisão iniciada no head `c0966a5bc4cadb2c094bb63c321c01790f326b48`, base `356ab708584a45c6ba633241ce035e2c0908fc0a`. Fetch confirmou esses refs antes da entrega. Os workflows desse head estavam concluídos com sucesso: [DroneGestor validation](https://github.com/mauriciobarrosaguiar/mbalabs/actions/runs/45057405900) e [MBA Labs Core CI](https://github.com/mauriciobarrosaguiar/mbalabs/actions/runs/45057405884). Esses resultados não validam automaticamente o commit adicional desta revisão.

Os 13 arquivos do diff original foram revisados: shell, dashboard, Ajuda, Cadastros, Campo V3, próxima ação, oito fases, Documentos, gestão de OS, painel do gestor, página de gestão, testes de navegação e relatório anterior. Novas correções abaixo ampliam apenas o DroneGestor e seus testes/documentação. Nenhum outro aplicativo foi alterado.

## Correções implementadas nesta revisão

1. Troca de OS protege execução pausada mesmo com `started=false`, hectares/cargas órfãos, identificador de operação e fila de finalização offline. Estado ilegível bloqueia a troca. A proteção é executada antes da atribuição automática no modo solo. A mesma OS continua consultável; esta regra não autoriza voo.
2. Abertura de OS tem trava contra chamadas simultâneas. Status `em_preparacao` recebe a mesma ação de preparação. OS cancelada passa a ter acesso ao pacote para consulta.
3. Consulta do pacote não grava a missão consultada sobre a missão ativa do aparelho. Fechar uma OS diferente não finaliza o estado local de outra operação. Salvar dados cadastrais no pacote também não substitui esse checkpoint.
4. API de regularização da propriedade recusa alteração de OS cancelada e concluída (409); pacote esconde ações de escrita e desabilita os campos nesses estados. Testes executam o handler real com dependências isoladas, verificando zero escritas e bloqueio de piloto/outra empresa.
5. Checklist SARPAS/documental recebe a OS selecionada no painel de Documentos e busca o snapshot autorizado dessa OS. Deixa de usar a missão local para escolher a OS. Erro de consulta esvazia o contexto de escrita, em vez de apresentar dados antigos como válidos. A guarda agrícola permanece no Campo; a página documental não modifica silenciosamente a missão local.
6. Fase 3 permanece documental externa, mas links do Campo sinalizam a origem e oferecem retorno à etapa persistida somente quando a OS local coincide com a selecionada. Visitar a página não marca documentação concluída, não emite autorização nem altera banco para registrar uma fase.
7. Retorno do planejamento/pacote conserva `tab=os&osId`. Mudanças de query atualizam as abas; o pacote remonta seus painéis quando muda o `osId`. Um piloto não ganha uma aba administrativa por informar `tab=cliente` na URL.
8. Ajuda evita atalhos de Cadastros/Conferência administrativa para piloto. Autorizações de servidor existentes continuam necessárias.
9. Suíte visual antiga tinha nomes AgroDoc, expectativas de interface anterior e resoluções incompletas. Foi atualizada para navegar pelos links reais dos menus e contemplar as seis resoluções, usando sessão específica fornecida ao executor; não cria dados remotos.
10. Corrigido erro de lint no harness de sincronização (nome de variável local); nenhuma regra de segurança/lint foi desligada.

## Validação executada

- Testes DroneGestor: **148 aprovados, 0 reprovados, 0 ignorados**. Inclui nove novas regressões de navegação/contexto e dois testes da API do pacote.
- O XLSX original de referência foi recuperado e usado pelo teste isolado do exportador. O teste verifica preservação das partes do arquivo, fórmulas e recursos das abas; não envia nada ao MAPA. Isso é aprovação automatizada, não exportação pela interface.
- TypeScript e build de produção: ver evidências anexas desta revisão. O build local não publica a aplicação.
- Lint restrito ao DroneGestor: sem erros; avisos preexistentes de dependências de hooks, imagens e variáveis constam no log.
- Lint geral: reprovado por problemas preexistentes em `elshaday/biblia/BibleReader.tsx`, `elshaday/eventos/page.tsx` e `tests/cotacoes-admin-routing.test.mjs`. Os arquivos não foram modificados por esta missão. Não declarar lint geral aprovado.
- Suíte visual: **6 testes ignorados/bloqueados**, por ausência de URL da prévia e sessão específica no executor. Nenhuma captura de seis resoluções foi produzida. Ignorado não equivale a aprovado.
- Navegador real: sessão Pulveriza 63 já existente em produção. Acessados Início e o menu Operações; destino `/apps/dronegestor/gestao`, título Operações e item ativo conferidos. A página ainda contém o wrapper anterior e os dois registros fictícios. Esta observação é baseline da produção, **não aceite da PR #206**. Login e planejamento de Pedro não foram repetidos.

## Evidências

Arquivos em [evidencias/dronegestor-20261122](evidencias/dronegestor-20261122/): saída dos testes, build, TypeScript, lint geral/restrito, skip visual e registro textual da observação real. Os testes de autorização usam fixtures isoladas, não sessões humanas de piloto/RT. Não há capturas simuladas ou captura de produção atribuída à prévia.

## Matriz de módulos e ações

| Módulo | Botão/ação | Perfil | Destino esperado | Resultado | Evidência |
|---|---|---|---|---|---|
| Produção (baseline) | Menu Operações | Sessão Pulveriza 63 existente | `/gestao`, título Operações, menu ativo | Aprovado pela interface **somente no baseline publicado** | `interface-baseline.md` |
| Gestão | Trocar OS com execução pausada/área/cargas/fila | Estado local controlado | Bloquear sem descartar progresso | Aprovado somente por teste automatizado | `dronegestor-navigation-runtime.test.mjs` |
| Gestão | Voltar à mesma OS ou trocar após finalização | Estado local controlado | Preservar checkpoint / permitir nova seleção consistente | Aprovado somente por teste automatizado | Mesmo teste |
| Documentos | Selecionar OS e carregar checklist técnico | Fixture/análise de integração | Usar `osId` selecionado, sem escolher missão local | Aprovado somente por teste automatizado (regressão estática) | Mesmo teste |
| Campo | Fase 3 e retornar | Piloto/gestor/RT reais | Mesma OS e etapa persistida | Bloqueado | Prévia autenticada indisponível |
| Pacote | Consultar outra OS | Análise de integração | Não sobrescrever missão ativa | Aprovado somente por teste automatizado (regressão estática) | Mesmo teste |
| Pacote/API | Editar propriedade de OS cancelada/concluída | RT em fixture isolada | HTTP 409 e zero escritas | Aprovado somente por teste automatizado | `dronegestor-dossier-access.test.mjs` |
| Pacote/API | Editar dados sem perfil / empresa alheia | Piloto/RT em fixtures separadas | 403/404 e zero escritas | Aprovado somente por teste automatizado | Mesmo teste |
| Navegação | Rotas dos menus e preservação de `osId` | Análise de código | Rota existente, parâmetro mantido | Aprovado somente por teste automatizado (estático) | `dronegestor-navigation.test.mjs` |
| Planejamento | Salvar, permissões e conflito | Fixtures de piloto, RT e gestor | Rejeitar perfis/estado/versão indevidos | Aprovado somente por teste automatizado | `dronegestor-planning.test.mjs` |
| Execução parcial | Encerrar parcialmente, complementar, retry | Fixtures controladas | Manter área/cargas cumulativas, impedir duplicação | Aprovado somente por teste automatizado | `dronegestor-partial-api.test.mjs` |
| Sincronização | Edição durante upload, troca de conta, conflitos | Aparelho/rede em harness | Não confirmar edição posterior nem sobrescrever outra conta | Aprovado somente por teste automatizado | `dronegestor-sync.integration.test.mjs`, testes CAS/guard |
| RLS | Regras isoladas de acesso | Banco de testes local | Isolamento conforme suíte | Aprovado somente por teste automatizado | `dronegestor-rls.test.mjs` |
| RLS real | Conferir políticas e aplicar correções | Supabase produtivo | Segurança efetiva | Bloqueado | Sem migrations, sem consulta de credenciais do banco; pendência anterior de `core_logs` não resolvida |
| MAPA | Preencher XLSX original, estrutura/fórmulas | RT em fixture isolada | Exportador preservar modelo | Aprovado somente por teste automatizado | `dronegestor-mapa-original.test.mjs` |
| MAPA | Competência, gerar, exportar e baixar pela UI | RT real | Arquivo real autorizado da competência | Bloqueado | Prévia e sessão RT ausentes |
| Formulários | Criar cliente/fazenda/talhão/drone/piloto/OS | Gestor/administrador | Persistência, feedback e impedir envio duplicado | Não executado pela interface | Sem escrita em banco remoto nesta execução |
| Campo | Medições físicas, GPS, SARPAS e liberar/retomar | Piloto real | Evidências legítimas e pré-voo válido | Bloqueado | Não simular confirmações regulatórias/físicas |
| Segurança | Leitura/atualização/execução por sessões reais distintas | Piloto, gestor, RT | Negar URL/API fora da autorização | Bloqueado | Só havia sessão da empresa em produção; fixtures não substituem essas sessões |

### Aceite dos menus da PR (não confundir com teste estático de rotas)

Cada linha exige clique, título/conteúdo, retorno, item ativo e menu mobile. Todos dependem de prévia da branch; nenhuma dessas linhas está homologada visualmente nesta revisão.

| Módulo | Botão/ação | Perfil | Destino esperado | Resultado | Evidência |
|---|---|---|---|---|---|
| Início | Dashboard | Todos | `/apps/dronegestor` | Bloqueado | Sem prévia autenticada da branch |
| Operações | Ordens de serviço | Todos | `/apps/dronegestor/gestao` | Bloqueado | Sem prévia autenticada da branch |
| Operações | Modo Campo | Piloto/gestor autorizado | `/apps/dronegestor/campo` | Bloqueado | Sem prévia autenticada da branch |
| Operações | Histórico | Todos | `/apps/dronegestor/historico` | Bloqueado | Sem prévia autenticada da branch |
| Operações | Fichas | Todos | `/apps/dronegestor/fichas` | Bloqueado | Sem prévia autenticada da branch |
| Operações | Conferência | Gestor/RT | `/apps/dronegestor/conferencia` | Bloqueado | Sem prévia autenticada da branch |
| Cadastros | Visão dos cadastros | Gestor/RT | `/apps/dronegestor/cadastros` | Bloqueado | Sem prévia autenticada da branch |
| Cadastros | Drones e equipamentos | Conforme acesso | `/apps/dronegestor/equipamentos` | Bloqueado | Sem prévia autenticada da branch |
| Cadastros | Pilotos | Gestor/RT | `/apps/dronegestor/pilotos` | Bloqueado | Sem prévia autenticada da branch |
| Cadastros | Minha equipe | Gestor/RT | `/apps/dronegestor/equipe` | Bloqueado | Sem prévia autenticada da branch |
| Cadastros | Funcionários e acessos | Admin empresa | `/apps/dronegestor/funcionarios` | Bloqueado | Sem prévia autenticada da branch |
| Documentação | Documentos | Conforme OS | `/apps/dronegestor/documentos` | Bloqueado | Sem prévia autenticada da branch |
| Documentação | Diagnóstico | Todos | `/apps/dronegestor/diagnostico` | Bloqueado | Sem prévia autenticada da branch |
| Documentação | Legislação | Todos | `/apps/dronegestor/regulacao` | Bloqueado | Sem prévia autenticada da branch |
| Documentação | Relatórios MAPA | Conforme permissão | `/apps/dronegestor/relatorio-mensal` | Bloqueado | Sem prévia autenticada da branch |
| Ferramentas | MBA Calda | Todos | `/apps/dronegestor/ferramentas` | Bloqueado | Sem prévia autenticada da branch |
| Ferramentas | Defensivos/AGROFIT | Todos | `/apps/dronegestor/produtos` | Bloqueado | Sem prévia autenticada da branch |
| Piloto Pro | Biblioteca | Todos | `/apps/dronegestor/piloto-pro` | Bloqueado | Sem prévia autenticada da branch |
| Configurações | Perfil operacional | Todos | `/apps/dronegestor/perfil-operacional` | Bloqueado | Sem prévia autenticada da branch |
| Configurações | Configurações | Gestor/RT | `/apps/dronegestor/configuracoes` | Bloqueado | Sem prévia autenticada da branch |
| Configurações | Administração | Admin sistema | `/apps/dronegestor/administracao` | Bloqueado | Sem prévia autenticada da branch |
| Ajuda | Como utilizar | Todos | `/apps/dronegestor/ajuda` | Bloqueado | Sem prévia autenticada da branch |

### Oito fases e retomada

| Fase/cenário | O que está coberto | Classificação do aceite funcional |
|---|---|---|
| 1 — OS | Dados e seleção revisados; proteção de contexto testada | Bloqueado pela interface da PR |
| 2 — Planejamento | API/versão/perfis cobertos por fixtures | Aprovado somente por teste automatizado; interface bloqueada |
| 3 — Documentação | Integração externa consistente, selecionada por OS, retorno ao Campo | Aprovado somente por teste automatizado estático; interface bloqueada |
| 4 — Segurança real | Bloqueios existentes preservados | Bloqueado por medições e inspeções legítimas |
| 5 — Equipamento/calibração | Guardas e sequência revisadas | Bloqueado por inspeção física; testes não atestam equipamento |
| 6 — Calda | Cálculos da suíte executados | Aprovado somente por teste automatizado; interação bloqueada |
| 7 — Aplicação | Pré-voo não enfraquecido; encerramento parcial/retry testados isoladamente | Aprovado somente por teste automatizado; execução real bloqueada |
| 8 — Pós-operação | Consulta segura do pacote e API de propriedade protegida | Aprovado somente por teste automatizado; interface bloqueada |
| Mesmo aparelho: pausar, fechar, reabrir | Guardas/armazenamento em testes controlados | Não executado ponta a ponta no navegador |
| Outro aparelho | Abertura sem checkpoint permanece conservadoramente bloqueada | Bloqueado; não afirmar retomada multiaparelho aprovada |
| Sem internet/reconexão | Retry/idempotência/CAS em testes | Aprovado somente por teste automatizado; browser offline não executado |

Avançar/Voltar/Retomar nas oito fases, retornos externos, seleção preservada e persistência devem ser conferidos na prévia com dados autorizados. Navegação não marca fase como concluída.

### Mobile

| Resolução | Menus, botões, formulário, scroll, modais e mapas | Captura real |
|---|---|---|
| 360 × 800 | Bloqueado | Não produzida |
| 390 × 844 | Bloqueado | Não produzida |
| 768 × 1024 | Bloqueado | Não produzida |
| 1024 × 768 | Bloqueado | Não produzida |
| 1440 × 900 | Bloqueado | Não produzida |
| 1920 × 1080 | Bloqueado | Não produzida |

A suíte preparada não homologa teclado virtual de um aparelho físico. Testar separadamente datas/números/teclado, upload/visualização/download, botões de escrita, permissões por sessão, notificações e transições operacionais.

## Prévia e continuação necessária

**URL de prévia: não disponível/validada nesta execução.** Os workflows consultados são de validação; não fornecer a URL produtiva como se fosse prévia.

A integração de hospedagem respondeu que exige seleção explícita do workspace pelo usuário. A listagem mostrou `MBALabs` (`tea-d8skog0k1i2s73dijb00`); não foi selecionado automaticamente. Confirmado esse destino, consultar primeiro a configuração e custos de uma prévia existente. Não contratar recurso, criar outro Supabase ou ligar uma prévia com dados produtivos graváveis sem respeitar as restrições.

Depois de existir uma prévia configurada, reutilizar sessão legítima ou solicitar login direto no navegador seguro, separadamente para piloto, gestor e RT. Não solicitar senhas no chat nem copiá-las/armazená-las. Não repetir login/planejamento de Pedro já aprovados sem necessidade. Manter testes de escrita em fixtures ou registros de teste autorizados e isolados.

## Riscos e restrições mantidos

- Nenhuma migration, alteração de dados reais, conta/banco Supabase novo, contratação, voo ou envio regulatório foi realizado.
- Não houve merge nem deploy produtivo. A PR permanece rascunho.
- Não declarar as oito fases integralmente homologadas, RLS produtiva aprovada, troca de aparelho recuperada ou mobile aprovado.
- Mudanças no contexto documental/pacote precisam de validação visual adicional; por isso a recomendação continua sendo reter a aprovação operacional.
- O lint geral ainda impede declarar todos os checks solicitados aprovados; os três arquivos externos ao DroneGestor precisam de uma correção em escopo próprio.
