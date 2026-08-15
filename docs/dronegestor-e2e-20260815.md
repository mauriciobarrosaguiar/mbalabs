# DroneGestor Agro — execução E2E de 2026-08-15

## Resultado atual

**NÃO APROVADO PARA LIBERAÇÃO FINAL AINDA.**

O código corrigido passa TypeScript, lint específico e build completo. A produção atualmente publicada está `READY`, mas ainda corresponde ao commit-base anterior. O preview das novas correções, os logins separados dos perfis fake e o fluxo operacional completo continuam pendentes; portanto, não é correto declarar aprovação final.

## Ambiente e isolamento

- Branch local: `codex/dronegestor-e2e-20260815-recovered`.
- Base: `787696e`.
- Commits desta rodada: `f7fa2de` e `cccbc16`.
- Projeto Supabase: MBA Labs, sem secrets registrados no repositório ou neste documento.
- Empresa fake: `E2E TESTE - DroneGestor QA`.
- Nenhum cliente, fazenda, talhão, equipamento, OS, documento, mapa, SARPAS ou operação E2E foi criado até esta revisão.
- Dois registros legados finalizados sem OS foram identificados, preservados e excluídos do histórico operacional normal.

## Perfis fake confirmados

| Perfil | Nome | Situação |
|---|---|---|
| Gestor | E2E Gestor DroneGestor | Ativo, Auth vinculado, perfil `gestor_operacional` |
| RT | E2E RT DroneGestor | Ativo, Auth vinculado, perfil `responsavel_tecnico` |
| Piloto 1 | E2E Piloto João | Ativo, Auth vinculado, perfil `piloto` |
| Piloto 2 | E2E Piloto Pedro | Ativo, Auth vinculado, perfil `piloto` |

Os quatro usuários permanecem ativos porque a exclusão quebraria a continuidade do teste e apagaria a possibilidade de auditoria. As senhas aleatórias não foram registradas nem expostas.

## Testes executados

| Cenário | Resultado atual |
|---|---|
| Build de produção completo | PASSOU |
| TypeScript | PASSOU |
| Lint específico do DroneGestor/admin | PASSOU sem erros; avisos preexistentes permanecem |
| Cálculo M ÷ V, calda total, cargas completas/parciais e unidades | PASSOU em 13 asserções |
| Resolução de gestor, RT e piloto pelo perfil do app | PASSOU em 7 asserções |
| Produção: início, perfil, equipamentos, gestão, equipe, documentos, histórico, pacote e campo | INSPEÇÃO SOMENTE LEITURA CONCLUÍDA |
| Produção: erros de runtime do DroneGestor nas últimas 24 h | NENHUM ENCONTRADO |
| Perfis fake e vínculos no banco | CONFIRMADOS |
| Dados E2E operacionais no banco | ZERO |
| Registros legados finalizados sem OS | 2, PRESERVADOS E OCULTOS |
| Gestor versus piloto com sessões separadas | PENDENTE — credenciais fake indisponíveis para login seguro |
| Viewport real de celular | PENDENTE NO PREVIEW |
| Perda/retorno de internet e conflito entre aparelhos | VALIDAÇÃO DE CÓDIGO CONCLUÍDA; E2E REAL PENDENTE |
| Documentos, mapa, SARPAS e PDF da E2E-001/E2E-002 | PENDENTE — depende do preview |
| Encerramento definitivo e auditoria | PENDENTE — depende do fluxo real completo |

## Problemas encontrados e correções

### Crítico

- APIs privilegiadas usavam o tipo global do usuário e não reconheciam de forma uniforme o perfil específico do DroneGestor. Foi criada uma resolução central do papel do app e aplicada às rotas e páginas.
- O início da execução podia depender principalmente das travas do cliente. A rota de OS agora revalida piloto, missão, equipamento, ANAC, tanque, segurança, GPS, calibração, checklist, documentos e SARPAS.
- Dados locais do modo campo podiam permanecer no mesmo navegador ao trocar de usuário. O estado operacional agora é separado por empresa e usuário, com backup offline independente.
- A política RLS atual permite leitura ampla de `core_logs` pela empresa e insert direto. Foi criada uma migration restritiva, ainda não aplicada em produção.

### Alto

- O cadastro de piloto dentro do DroneGestor criava somente uma ficha operacional; o gestor ainda precisava sair do app e criar o login no painel geral da MBA Labs. Agora a mesma ação cria Auth, usuário da empresa, perfil `piloto` e ficha operacional, com rollback se alguma etapa falhar e bloqueio de e-mail pertencente a outra empresa.
- Piloto sem cadastro operacional podia herdar permissões permissivas para upload/finalização. A ausência do vínculo agora nega a ação.
- Mapa por geometria aceitava consulta sem OS e não validava o vínculo do piloto. GET/POST agora exigem OS, escopo e permissão.
- Gestor podia preparar OS de equipe sem definir piloto. O servidor agora bloqueia e informa a próxima ação.
- Piloto podia alcançar regularização/encerramento por chamada direta à API. Fechamento e dados complementares agora exigem gestor/RT no modo equipe.
- A tela de campo ainda reconhecia opções legadas de SARPAS no estado local. A liberação passou a exigir somente `autorizado` com referência e sincroniza revogação/negação do servidor.

### Médio

- Tanque aceitava pequena ultrapassagem por arredondamento amplo. O limite agora respeita tolerância de 0,01 L.
- OS com campo concluído ou encerrada aparecia com botão desabilitado, impedindo abrir/consultar o pacote. O cartão agora abre o pacote correto.
- Falha ao criar permissão de um novo usuário podia deixar Auth/perfil incompleto. A criação valida o contrato antes e executa rollback seguro se a etapa seguinte falhar.

### Usabilidade

- **Equipe → Cadastrar ou gerenciar pilotos** agora apresenta uma única ação clara no celular: **Cadastrar piloto**. O formulário cria o acesso sem sair do DroneGestor, gera senha forte e permite regularizar pilotos antigos marcados como **Sem acesso ao aplicativo**.
- Mensagens de pré-voo foram trocadas por instruções específicas, como escolher piloto, anexar receituário e abrir Documentos e SARPAS.
- Piloto recebe aviso claro de que pode consultar o pacote, mas a regularização e o encerramento pertencem ao gestor/RT.
- O estado SARPAS no campo ficou somente leitura, com uma ação principal: **Abrir documentos e SARPAS**.

## Segurança validada

- Escopo por empresa ou usuário em rotas sensíveis.
- OS obrigatória para documento, mapa, geometria, SARPAS, estado e conclusão.
- Piloto limitado à OS atribuída.
- Permissões críticas verificadas no servidor, não apenas por botão oculto.
- Campo concluído separado do encerramento documental.
- Conflito de revisão retorna `409` e não sobrescreve silenciosamente.
- Registros finalizados sem OS não entram no histórico normal.
- Nenhum secret foi exibido ou versionado.

## Deploy

- Branch: criada localmente.
- Commits: criados localmente.
- Push/PR: pendente; o cliente `gh` não está disponível neste ambiente de trabalho.
- Preview: pendente, pois a integração direta exige o pacote completo de arquivos e a branch ainda não foi publicada.
- Produção atual: `READY` no commit-base `787696e`.
- Migration RLS: versionada e não aplicada.

## Próxima sequência obrigatória

1. Publicar a branch e abrir PR.
2. Aguardar preview `READY`.
3. Restabelecer, por procedimento seguro, o acesso aos quatro usuários fake.
4. Executar E2E-001 e E2E-002 completos no preview, incluindo celular, offline e conflito.
5. Aplicar/testar a migration RLS somente no ambiente aprovado.
6. Revisar o PDF e confirmar isolamento entre OS.
7. Aprovar PR, fazer merge e confirmar produção `READY`.
8. Desativar ou manter os perfis fake conforme os relacionamentos criados e registrar a decisão.

## Pendência de segurança do ambiente

O Security Advisor do Supabase informa que a proteção contra senhas conhecidas como vazadas está desativada no Auth. A ativação deve ser avaliada no painel do projeto antes da liberação final. Os demais avisos retornados são gerais do MBA Labs (tabelas de outros módulos com RLS sem policy e funções `SECURITY DEFINER`) e precisam de revisão própria, sem alteração automática nesta tarefa para não quebrar os outros aplicativos.

## Resposta provisória

**Eu colocaria um piloto leigo para utilizar este sistema amanhã? NÃO, ainda.**

Motivo: as correções críticas estão implementadas e compilam, mas ainda não passaram pelo preview autenticado com gestor, RT e dois pilotos separados, nem pelo cenário real de perda/retorno de internet em dois aparelhos. Liberar antes disso contrariaria o próprio critério de segurança da homologação.
