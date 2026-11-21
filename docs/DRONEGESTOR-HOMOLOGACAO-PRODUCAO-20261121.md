# DroneGestor — homologação real em produção, 21/11/2026

**Resultado: homologação parcial, com bloqueadores. Não aprovado para declarar conclusão integral.**

Base: main, commit f85c0a0b857d7a828adb760b5aace674a2982c4c (PR 197 incorporada). Sistema https://www.mbalabs.com.br/apps/dronegestor. A sessão foi autenticada pelo próprio titular diretamente no navegador; credenciais não foram solicitadas no chat nem extraídas. Correções propostas na branch `fix/dronegestor-homologacao-producao-20261121`, sem deploy, merge ou alteração de políticas/schema. A regra existente `fix/*: false` em vercel.json desativa publicação automática desta branch.

## Páginas efetivamente acessadas

Abrir uma página não significa aprovar todos os fluxos nela. Evidências abaixo são da produção anterior às correções desta branch.

| Rota sob /apps/dronegestor | Exercício realizado | Resultado / limite |
|---|---|---|
| / | Dashboard e identificação da sessão; sete grupos de menu abertos | Carregou; métricas finais zero, sem comprovação de dados de operações encerradas |
| /gestao | Criar cliente, fazenda, talhão e OS fictícios; listar; filtrar por HOMOLOGAÇÃO; tentar preparar OS fictícia | Cadastros persistiram; preparação bloqueada por modo Equipe sem piloto; lista principal não atualizava até recarregar |
| /cadastros | Verificar contagens e bases cruzadas | 2 clientes, 2 fazendas e 2 drones após os testes; piloto indisponível |
| /equipamentos | Criar drone fictício e conferir lista | Persistiu; drone real preservado |
| /equipe | Verificar modo e acesso ao cadastro de pilotos | Modo Equipe ativo; não alterado para preservar perfil real |
| /pilotos | Abrir atribuição e cadastro | Equipe indisponível: contrato/vínculo do aplicativo não ativo para empresa; nenhuma conta criada nem permissão concedida |
| /perfil-operacional | Carregar dados, campos e indicador de preenchimento | Exibiu 80%; dados reais preservados; indicador não certifica regularização |
| /ferramentas | MBA Calda, vazão, rendimento e custos com entradas fictícias | Cenários numéricos abaixo aprovados |
| /campo | Abrir nova operação sem preencher parâmetros; tentar segurança antes de missão válida | Bloqueio de requisitos funcionou; produção exibia seis fases; nenhum início ou comando real |
| /historico | Abrir filtros e resumo | Nenhuma operação finalizada disponível; CSV e rastreabilidade de finalização não homologados |
| /documentos | Selecionar OS fictícia; enviar PNG fictício; conferir listagem e imagem de prévia | Upload no Supabase confirmado com 1 documento e imagem exibida; isolamento por outro usuário e expiração não testados |
| /conferencia | Abrir competência atual e seleção de operação | Estado vazio correto; aprovação/correção não testadas em sessão de RT |
| /relatorio-mensal | Abrir prévia, requisitos e disponibilidade XLSX | Exportação bloqueada sem modelo oficial e operações aprovadas; nenhum envio a órgão público |
| /produtos | Buscar glifosato | Retornou produtos AGROFIT com identificação, ingrediente e aviso de revisão técnica; nenhum produto foi aprovado ou prescrito |
| /piloto-pro | Buscar Mapeamento, abrir capítulo | Filtro retornou 1 de 14; capítulo temático 0.1 informa importação do e-book pendente |
| /diagnostico | Carregar perfil, checklist de nove obrigações e fontes | Nove itens pendentes; não salvo/alterado |
| /configuracoes | Ler estados de Drive, SARPAS, modelo MAPA e opções | Pendências externas abaixo; nenhuma configuração real alterada |
| /regulacao | Abrir legislação e fontes por UF | Página carregou; conteúdo normativo não foi revalidado juridicamente nesta rodada |

## Cálculos efetivamente conferidos na interface

| Cenário | Esperado e observado |
|---|---|
| Misturador 200 L, taxa 10 L/ha, tanque 25 L, missão 2,5 ha | 20 ha por mistura cheia; 8 tanques por mistura cheia; missão com 25 L e 1 carga |
| Produto fictício, dose matemática 100 mL/ha | 250 mL na missão, 2.000 mL numa mistura cheia de 200 L |
| Vazão: 10 L/ha, 18 km/h, faixa 5 m | 1,5 L/min |
| Rendimento: mesmos parâmetros, 2,5 ha, tanque 25 L, paradas zero | 9 ha/h, 0,2778 h, 1 carga |
| Custos: 2,5 ha, venda 100 R$/ha, variável 40 R$/ha, fixo zero | Receita 250 R$, custo 100 R$, resultado 150 R$, margem 60%; ROI sem investimento não calculável |

Esses resultados são verificações matemáticas, sem recomendação agronômica.

## Erros e correções propostas

1. **Pré-voo assíncrono:** inspeção do código identificou resposta antiga sobrescrevendo avaliação mais recente, mantendo também itens anteriores após erro. A branch invalida a liberação enquanto consulta, descarta respostas fora de ordem ou de snapshot já editado, limpa avaliação em falha e invalida pedidos ao desmontar/trocar OS. Dois testes novos exercitam concorrência e edição local. O início continua dependendo da validação do servidor; não representa correção do RLS.
2. **Lista de operações desatualizada:** OS criada no editor não aparecia na lista principal antes de recarregar; seleção de pilotos também não recebia nova OS. Evento local após criação atualiza ambos; callback de refresh estabilizado.
3. **Risco de atribuir OS errada:** o painel de atribuição selecionava automaticamente uma OS real ao abrir a criação. Agora exige escolha explícita e preserva somente seleção válida feita pelo usuário. Nenhuma OS real foi atribuída durante o teste.
4. **Fluxo visual em seis fases:** navegação passa a oito agrupamentos das telas já existentes: Operação, Calda, Segurança, Controle, Calibração, Checklist, Liberação e Aplicação. Esta reorganização não comprova homologação de ponta a ponta nem acrescenta encerramento parcial.
5. **Botões sem nome:** botões de inativação de cadastro e OS recebem nome acessível com identificação do item.
6. **Mensagem enganosa:** removida substituição de texto que afirmava disponibilidade completa de mapa apesar do aviso original de módulo em implantação.

## Segurança do Supabase: bloqueio confirmado somente por leitura

Projeto MBA Labs: jrbkojhnltqfqwpczwuw. `public.core_logs` tem RLS habilitado e grants SELECT e INSERT para authenticated. Políticas retornadas por pg_policies:

| Política | Condição atual |
|---|---|
| core_logs_select | is_admin_master() OR empresa_id = current_empresa_id() |
| core_logs_insert | is_admin_master() OR empresa_id = current_empresa_id() |

As funções current_empresa_id e current_usuario_id filtram auth.uid() e usuário ativo. A condição por empresa não restringe ação/app/autoria/perfil. Portanto as APIs server-side não bastam para impedir leitura de trabalho de outro piloto ou inserção direta em logs dentro da mesma empresa. A exploração com conta de piloto não foi tentada. O isolamento entre empresas e o acesso efetivo de gestor/piloto/RT ainda exigem contas autorizadas; sessão de administrador não é prova desses controles.

A migration existente `supabase/migrations/20260815140001_restrict_dronegestor_logs_by_role.sql` é candidata, **não aplicada**. Não basta publicá-la sem validar os perfis e os demais aplicativos.

### Riscos e estratégia antes de eventual aplicação autorizada

- Restrição incorreta pode impedir leitura legítima de OS atribuída, conferência por RT ou funcionamento de outros aplicativos que compartilham core_logs.
- Antes de qualquer mudança, exportar pg_policies, grants, funções e definições atuais; identificar dependências e guardar evidência do estado inicial. Confirmar backup recuperável e autorização separada para qualquer recurso pago.
- Comparar a política candidata com autorizações reais e preparar matriz de gestor, RT, piloto A, piloto B e empresa distinta. Usar somente registros HOMOLOGAÇÃO. Não criar outro projeto Supabase.
- Apresentar SQL final e impacto ao titular. Executar eventual DDL apenas após autorização específica, numa transação, preservando o comportamento dos outros app_slug.
- Em falha, rollback da transação antes de commit. Após commit, interromper a liberação e restaurar apenas as definições previamente aprovadas em nova transação autorizada; não desabilitar RLS, ampliar grants nem reabrir indiscriminadamente dados. Restaurar política antiga pode reintroduzir a vulnerabilidade e precisa ser tratado como risco, não como recuperação segura automática.
- Retestar por perfis e Data API após a mudança. Nenhuma dessas ações de escrita foi executada nesta rodada.

## Reprovados, bloqueados e pendências externas

| Item | Estado |
|---|---|
| RLS por papel em core_logs | Reprovado por inspeção de políticas/grants; sem correção aplicada ao banco |
| Encerramento parcial | Ausente: cliente e endpoint state exigem 100% da área; continua pendente de implementação e testes |
| Interrupção, abastecimentos, checklist completo e encerramento total | Não homologados de ponta a ponta: preparação bloqueada sem piloto e sem conta específica de teste; não foram falsificadas autorizações oficiais |
| Solo | Não homologado; perfil real está em Equipe e não foi alterado |
| Equipe e atribuição de pilotos | Bloqueado pelo vínculo/contrato exibido; não foi concedido acesso a ninguém |
| Mapeamento | Capítulo consultado; mapa operacional, desenho, importação e exportação de polígonos não homologados |
| Google Drive | Desconectado; OAuth técnico e configuração de armazenamento pendentes; upload tradicional Supabase foi testado com sucesso |
| SARPAS | Credenciamento Provider pendente; envio permanece desativado; nenhuma solicitação oficial |
| MAPA XLSX | Modelo oficial não cadastrado; exportação e preenchimento oficial não homologados |
| Piloto Pro completo | Biblioteca temática de 14 capítulos, importação integral do e-book pendente |
| 360, 390, 768, 1024, 1440 e 1920 px | NÃO EXECUTADOS: DevTools bloqueado por política do navegador, sem API de resize disponível nesta superfície; capturas atuais não comprovam essa matriz |
| Correções desta branch na produção | NÃO TESTADAS em produção, pois publicação foi proibida pelo titular |

A inspeção visual foi feita no viewport disponível do navegador; não certifica ausência de cortes, sobreposições ou contraste inadequado em todas as larguras.

## Registros fictícios que permanecem para remoção posterior

| Recurso | Identificação | entityId |
|---|---|---|
| Cliente | HOMOLOGAÇÃO CODEX 20261121 — CLIENTE FICTÍCIO | 9ffc5d92-6e39-4c6b-ae79-ad2c1f955951 |
| Fazenda | HOMOLOGAÇÃO CODEX 20261121 — FAZENDA | 346e109f-b5bd-476b-8054-7a8111058668 |
| Talhão | HOMOLOGAÇÃO CODEX 20261121 — TALHÃO | 08533dcb-5d27-45e4-8d0b-755e83d0abd9 |
| Drone | HOMOLOGAÇÃO CODEX 20261121 — DRONE | 2048bb4b-5b1d-445c-9ced-744dbe2fef41 |
| OS | OS-20261121-53437; alvo HOMOLOGAÇÃO SEM APLICAÇÃO REAL | 53437a83-881e-4aa4-b8c5-c9f989e08e05 |
| Anexo na OS | HOMOLOGACAO_CODEX_20261121.png; categoria outro | Consultar pela OS e nome exato |

Não removidos nesta rodada. Remover somente os registros acima, respeitando dependências (anexo/OS antes de talhão/fazenda/cliente). Logs de auditoria podem permanecer conforme política de retenção. Piloto Pro registrou localmente a abertura do capítulo; modo campo abriu somente navegação de rascunho sem missão preenchida. Não foram alterados registros reais, perfis, permissões, credenciais ou opções empresariais. Não houve notificação externa, voo nem envio a órgão público.

## Verificação do código

- 37 testes DroneGestor aprovados, incluindo dois novos de pré-voo; testes de autorização existentes usam mocks, não comprovam RLS real.
- TypeScript aprovado.
- Build Next.js aprovado (inclui prebuild de testes Cotações para regressão do projeto compartilhado).
- Lint dos arquivos alterados sem erros; avisos legados de navegação/hooks registrados. Não equivale a lint global aprovado.
- git diff --check aprovado.
- Sem E2E autenticado das correções propostas: screenshots e navegação são da produção no commit base.

## Capturas de tela

Arquivos em `docs/evidence/dronegestor/producao-20261121/`:

- [OS fictícia na lista filtrada](evidence/dronegestor/producao-20261121/os-homologacao.jpg)
- [Anexo enviado e prévia exibida](evidence/dronegestor/producao-20261121/documento-enviado.jpg)
- [Pendências de Drive, SARPAS e MAPA](evidence/dronegestor/producao-20261121/integracoes-producao.jpg)
- [Relatório MAPA bloqueado](evidence/dronegestor/producao-20261121/mapa-producao.jpg)
- [Piloto Pro: filtro e capítulo aberto](evidence/dronegestor/producao-20261121/piloto-pro.jpg)
- [Snapshot visível do anexo](evidence/dronegestor/producao-20261121/documento-enviado.txt)

## Entrega da branch e PR

Correções concluídas em commits locais. A tentativa de push foi rejeitada pela revisão automática: interpretou o envio da branch como publicação proibida sem autorização e apontou possível exposição de dados operacionais nas evidências. Não houve tentativa de contornar a rejeição. O titular autorizou explicitamente em seguida o envio da branch e das evidências e a abertura de PR em rascunho, sem merge/deploy. O estado atual da PR deve ser consultado no GitHub.

## Próxima dependência do titular

Indicar e autorizar contas existentes de teste de gestor, piloto e RT e uma empresa distinta, com sessão segura no navegador. Se não existirem, criação de acessos requer autorização específica e escopo definido. Sem isso não é possível comprovar autorização por perfil e isolamento real. Não é necessário enviar senhas pelo chat. Nenhuma aprovação para deploy ou migration é solicitada antes de resolver os bloqueadores acima.
