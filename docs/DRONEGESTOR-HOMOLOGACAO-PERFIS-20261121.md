# DroneGestor — homologação com sessões específicas

Data:21/11/2026. Autenticação feita por formulário seguro. Nenhuma credencial foi copiada para arquivos, logs ou commits. As contas são fictícias existentes da empresa E2E TESTE - DroneGestor QA.

## Verificações reais

| Sessão | Teste | Resultado |
|---|---|---|
| Gestor operacional | Dashboard e OS da empresa | Abriu a OS fictícia OS-20261121-71DF6 atribuída a Pedro |
| Gestor operacional | APIs administração geral e funcionários | Ambas negadas |
| Gestor operacional | Conferência | Página autorizada, nenhuma aplicação finalizada na competência |
| Gestor operacional | Documentos da OS fictícia de outra empresa | Negado: OS não encontrada ou inativa |
| Piloto Pedro | Dashboard e Minhas operações | Identidade confirmada, OS atribuída exibida |
| Piloto Pedro | Funcionários e conferência gerencial | Servidor negou ambas |
| Piloto Pedro | Assumir e preparar | OS fictícia passou para preparação e abriu modo campo |
| Piloto Pedro | Alterar parâmetros sem permissão | Interface bloqueou; campos não persistiram após reabrir |
| Piloto Pedro | Documentos de outra empresa | Servidor negou |
| Piloto Pedro | Pré-voo | Bloqueado: drone/parâmetros, segurança, documentos, SARPAS e GPS pendentes |
| RT | Dashboard, operações e conferência | Acesso autorizado; conferência vazia |
| RT | Administração geral e funcionários | Servidor negou ambas |
| RT | Continuar preparação de OS de Pedro | Bloqueado pedindo login do piloto: falha do fluxo Equipe |
| RT | SARPAS provider status | configured=false, enabled=false, verified=false, submissionEnabled=false |
| RT | Google Drive | setupRequired=true, oauthConfigured=false, disconnected; migração de armazenamento ausente |

## Correção implementada

A preparação de OS de outro piloto agora abre uma tela interna de planejamento. Gestor/RT escolhe drone ativo, parâmetros e produtos, sem assumir o piloto nem iniciar aplicação. A API limita empresa/OS/equipamento, recusa edição de missão iniciada/suspensa/concluída/cancelada, valida números/doses e capacidade de tanque e usa versão otimista para evitar sobrescrita concorrente. Falha de auditoria tenta restaurar o plano anterior sem sobrescrever outra atualização.

O plano é guardado nos dados da OS existente; não há schema novo. Alterações normais da OS preservam o plano interno. O piloto recebe o plano ao reabrir a OS, inclusive na limpeza inicial do contexto; confirmações dependentes são invalidadas quando recebe nova versão. Não transfere aceite técnico, clima, risco, checklist ou autorização SARPAS do planejador para o piloto.

As APIs de sincronização, início e finalização passam a verificar no servidor os parâmetros de pilotos sem permissão de edição, comparando com plano autorizado. Piloto inativo ou sem execução é recusado. Para operações legadas já iniciadas, utiliza somente o snapshot de servidor do próprio piloto/OS como referência, preservando continuidade sem aceitar parâmetros novos adulterados. A interface começa com permissões fechadas até carregar o cadastro do piloto e explica os parâmetros em somente leitura.

101 testes DroneGestor aprovados; build e TypeScript aprovados; lint sem erros e4 avisos de navegação. Evidências anexas nesta pasta. Testes de API usam fixture e não substituem RLS real.

## Dados e limites

Somente a OS fictícia 71df64e7-3148-451d-9eb6-d3001393a3f4 foi assumida pelo piloto; ficou em preparação. Nenhum registro real foi modificado. Nenhum voo, comando de aeronave, envio oficial SARPAS, relatório público, notificação ou migração foi executado.

A homologação ponta a ponta não está concluída: faltam reteste de planejamento publicado, fases de aplicação/abastecimento/interrupção/encerramentos e ciclo de conferência com operação concluída. João, Aplicador CAAR e Visualizador ainda não tiveram sessão validada nesta rodada; os dois últimos não apareciam no cadastro de funcionários. Modo Solo e seis larguras continuam pendentes. core_logs conserva a lacuna de RLS descrita nos relatórios anteriores.

A integração Drive depende de migração/configuração e autorização específica para banco; SARPAS automático permanece desabilitado. Não apresentar este teste como homologação completa, nem fabricar uma autorização operacional para vencer bloqueios.

## Retomada de 22/11/2026 — bloqueio por vencimento

Não foram repetidos os testes aprovados. PR #203 confirmada incorporada, merge e2b6d5f6c92780d30e0dda3acf1974549facf3f9. Deployment dpl_8nZq6qeUu7RXk5ZwECnRnPea5H1n confirmado READY em production com aliases www.mbalabs.com.br e mbalabs.com.br.

A aba anterior já não existia. Uma nova aba recuperou a sessão E2E RT DroneGestor e abriu diretamente o planejamento da OS 71df64e7-3148-451d-9eb6-d3001393a3f4. A página recusou carregar os dados com “DroneGestor não liberado.” Não foi submetido formulário de planejamento.

Consulta somente leitura confirmou core_empresa_apps: empresa faaae6cf-30c7-4afe-9dff-d374bc6723d7, app dronegestor, status ativo, início 2026-11-21, vencimento 2026-11-21. O contrato venceu antes desta retomada. A recusa é esperada e não justifica remover a validação de acesso.

A OS permanece em_preparacao, piloto E2E Piloto Pedro, sem planejamentoAtualizadoEm. As permissões cadastradas seguem ativas: administrador empresarial, gestor operacional, RT, João e Pedro. Aplicador CAAR e Visualizador ainda não possuem vínculo nesta empresa.

Planejamento pelo RT, recebimento por Pedro, João, novos perfis, modo Solo e ciclo operacional ficam BLOQUEADOS pelo contrato vencido. Não são marcados como aprovados ou reprovados funcionalmente. Segurança/encerramentos, RLS e integrações conservam as pendências anteriores. Nenhuma política, permissão, contrato, senha ou registro operacional foi alterado nesta retomada.

Proposta concreta pendente de autorização: prorrogar somente a liberação DroneGestor desta empresa fictícia até 2026-11-29, mantendo plano, usuários, perfis e status atuais, pelo fluxo administrativo existente. Isso reativará os acessos desses cinco usuários durante o período; não cria projeto, schema ou recurso pago. Recuperação: restaurar o vencimento anterior 2026-11-21 e o espelho correspondente em assinaturas, preservando os demais campos. Nenhuma prorrogação foi aplicada.

Captura: docs/evidence/dronegestor/retomada-20261122/acesso-vencido-rt.jpg.


## Continuidade de 22/11/2026 — autorização recebida e testes reais

A proposta acima foi autorizada pelo usuário (“Sim”). Prorrogados somente os vencimentos da liberação DroneGestor e da assinatura existente da empresa fictícia até 2026-11-29. Transação atômica com comparação dos IDs, empresa/app, vencimento anterior 2026-11-21, status e plano nulo; ambas as linhas verificadas após commit. Plano, usuários, perfis e status preservados. Nenhuma alteração de RLS, schema ou contratação. A proposta pendente e o bloqueio descritos na seção anterior são históricos e foram superados por esta autorização.

| Perfil / teste novo | Evidência observada | Resultado |
|---|---|---|
| RT / planejamento publicado PR203 | Drone fictício, 10 L/ha, tanque20 L, faixa5 m, velocidade18 km/h, altura3 m, produto fictício100 mL/ha; mensagem de planejamento salvo mantendo bloqueios pré-voo | Aprovado |
| Pedro / recebimento do plano | OS-20261121-71DF6 reaberta; parâmetros e produto preenchidos sem redigitação; edição técnica somente leitura | Aprovado |
| Pedro / cálculo | 1,5 ha:15 L; 150 mL;1 tanque com15 L;1,50 L/min | Aprovado |
| Pedro / segurança sem medição | Campos vazios recusados: informe vento, direção, temperatura e umidade medidos no talhão; risco/parâmetros-base bloqueados | Aprovado, teste negativo |
| João / isolamento entre pilotos | Lista sem OS de Pedro; dados e documentos da OS negados pelo servidor; planejamento restrito a gestor/RT | Aprovado |
| João / troca no mesmo navegador | Modo campo limpo, sem missão anterior de Pedro | Aprovado |
| Administrador / modo Solo | Ativação confirmada; criada OS-20261122-D916C; “Assumir e preparar missão” abre preparação do próprio gestor sem cadastrar novo piloto | Aprovado até preparação |
| Administrador / cálculo Solo | Mesmo cenário matemático fictício:15 L,150 mL,1,50 L/min | Aprovado |
| Restauração do modo | “Modo equipe ativo” e “Modo equipe ativado” confirmados após teste Solo | Aprovado |

O nome inicial do drone apareceu selecionado no Solo com parâmetros vazios; selecionar explicitamente o drone carregou o cadastro. Não houve bloqueio definitivo. A captura imediatamente após calcular pode mostrar o cabeçalho da fase anterior durante a atualização periódica; isso não comprova defeito persistente. Não foi criada correção de código sem reprodução conclusiva.

Somente o aceite de leitura da orientação foi marcado por Pedro. Não foram inventadas medições de campo, GPS, inspeções físicas, documentos ou autorização oficial. Nenhum voo ou comando de aeronave foi executado, nem envio oficial/notificação. As fases4–8, abastecimentos, interrupção, encerramento parcial/total e conferência pós-conclusão continuam NÃO HOMOLOGADAS. O encerramento parcial permanece pendência funcional previamente registrada.

Aplicador CAAR e Visualizador continuam sem contas. Formulário CAAR preparado com nome HOMOLOGAÇÃO P63 - Aplicador CAAR, e-mail e2e.aplicador.dronegestor@example.invalid e perfil correspondente; senha não preenchida nem cadastro submetido pelo agente. Criação aguarda entrada e submissão manual da credencial pelo usuário. Depois será necessário cadastrar Visualizador e autenticar ambos com sessões próprias; não inferir permissões a partir do administrador.

RLS core_logs mantém a lacuna anterior de acesso amplo dentro da empresa; não alterada. Google Drive depende da configuração/migração autorizada e SARPAS automático permanece desabilitado. Seis larguras seguem pendentes por indisponibilidade de controle de viewport neste navegador. Os101 testes/build/TypeScript da PR203 permanecem evidência da implementação anterior; não foram repetidos nesta rodada sem mudança de código.

### Rastreabilidade e limpeza

Manter para revisão, remover posteriormente pelo fluxo autorizado: OS-20261121-71DF6, nova OS Solo OS-20261122-D916C, cliente/fazenda/talhão/drone HOMOLOGAÇÃO P63 20261121 e usuários fictícios E2E/HOMOLOGAÇÃO. Não remover contas/registros reais. A OS Solo permanece em preparação, sem aplicação real. A OS de Pedro conserva sua atribuição. Vencimento de teste atual29/11/2026; valor anterior21/11/2026 registrado para recuperação caso solicitada.

Capturas desta rodada: docs/evidence/dronegestor/continuidade-20261122/ (RT planejamento salvo, Pedro plano/calda/bloqueio climático, João lista/campo limpo, Solo ativo/calda). Nenhuma credencial incluída. Este relatório não declara conclusão100%.


## Documentos fictícios e guia sequencial — 22/11/2026

Por decisão do usuário, Aplicador CAAR e Visualizador foram retirados do requisito desta homologação. Cadastro CAAR cancelado antes de inserir senha ou submeter; nenhuma conta adicional criada. Permanecem os perfis existentes.

Três PDFs de uma página criados e anexados pela interface publicada à OS-20261121-71DF6, categoria outro:

- HOMOLOGACAO_01_Dossie_OS.pdf
- HOMOLOGACAO_02_Plano_Matematico.pdf
- HOMOLOGACAO_03_Roteiro_Envio_Manual.pdf

Todos contêm HOMOLOGAÇÃO / SEM VALIDADE OFICIAL e aviso para não enviar. Não são autorizações, receitas, certidões, seguros ou comprovações regulatórias. Não foi alterado o status oficial SARPAS nem fabricada documentação para liberar execução.

Upload dos três e vínculo da OS APROVADOS. Após recarregar, a tela seleciona inicialmente a OS Solo; voltando à OS de Pedro, os três arquivos persistem. A prévia embutida mostra “This page has been blocked by Chromium”, limitação observada neste navegador. Download do dossiê APROVADO: bytes idênticos ao original, SHA-256 194651d3b1d90aa3fd08bfdf9a08e99fc653d7d8ff4f3838526bfd5de4456bbc. Não generalizar o teste de download para os outros dois arquivos. Categoria outro aparece agrupada em Fotos e evidências na interface atual.

Arquivos de teste para remoção posterior constam na pasta docs/evidence/dronegestor/documentos-20261122/ e na central Documentos da OS de Pedro. Não houve exclusão de registros, alteração RLS/schema, envio a órgão público ou contratação. Geração de documentos pelo próprio sistema e envio manual/API são etapas posteriores, não aprovadas pela simples anexação destes PDFs externos.

Guia sequencial criado com29 slides editáveis, incluindo capturas, explicação de perfis/cadastros/OS/planejamento, oito fases, conferência, documentação e pendências. Apresentação: https://chatgpt.com/space/page_a12849a2965c8191a82f748806aa0b29. Não declara homologação100%.
