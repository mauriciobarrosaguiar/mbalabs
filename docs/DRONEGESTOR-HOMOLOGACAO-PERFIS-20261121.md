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
