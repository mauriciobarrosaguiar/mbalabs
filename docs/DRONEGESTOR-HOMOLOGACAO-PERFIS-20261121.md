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
