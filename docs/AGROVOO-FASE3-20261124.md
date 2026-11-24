# AgroVoo — Fase 3: Jornada da OS, piloto, planejamento e mapa
Data: 24/11/2026

## Base e isolamento
- Branch `feat/agrovoo-gestao-fase2-20261124`, PR #207 (draft), baseada na branch da PR #206, ainda sem merge.
- Nenhuma migration, alteração direta do banco, merge nem promoção à produção.
- Este código **não realiza uma aplicação real**, não gera autorização oficial, não obtém GPS sem dispositivo, e não substitui a revisão do RT.

## Implantado no código
1. Após criar a OS no assistente AgroVoo, o gestor acessa sua página em `/apps/dronegestor/agrovoo/os/[osId]`. A listagem do painel abre essa mesma rota.
2. Detalhes divididos por **Resumo → Piloto → Planejamento → Mapa → Documentos**. Consultar a OS **não substitui a missão ativa** nem apaga hectares, cargas ou fila local do piloto.
3. Atribuição de piloto utiliza `GET /api/dronegestor/pilotos` e `PATCH /api/dronegestor/cadastros`, que conferem perfil, vínculo do usuário, empresa e estado da OS. Atribuição fica somente consulta após o início da execução.
4. Planejamento reutiliza `DroneMissionPlanning` e as APIs existentes; preserva revisão do plano, parâmetros da aeronave e produtos. Não duplicamos modelo de planejamento.
5. Mapa no detalhe: upload associado a **OS específica** via `POST /api/dronegestor/documentos`; aceita **foto JPG/PNG/WebP do controle ou KML/KMZ**. KML/KMZ são permitidos **somente** na categoria `mapa_aplicacao` e validam minimamente estrutura, extensão, tamanho e, em KMZ, arquivo KML interno. Hash SHA-256 e idempotência existentes continuam ativos.
6. No modal do piloto, há opção de abrir o centro documental da mesma OS e enviar **KML/KMZ** em vez de foto. No centro documental, arquivos do mapa passam obrigatoriamente pela validação do servidor (Supabase), independentemente de integração Google Drive configurada.
7. O pré-voo informa a situação documental, mas a ausência de anexo **não impede o registro/início operacional por si só**. Segurança de campo, clima, GPS, planejamento, identificação de drone/piloto e situação de SARPAS continuam sujeitos às verificações existentes. A autorização SARPAS é situação declarada no sistema, **não consultada automaticamente no portal DECEA**; operadores precisam conferir a autorização oficial e respectivas condições.
8. Evidência de mapa continua exigida **para conferência/encerramento de OS** nas regras existentes. O anexo não é uma validação geoespacial nem prova automática da área efetivamente aplicada.

## Compatibilidade
- API mantém mesmas rotas e ações; sem migração de schema/bucket.
- Estados `campo_concluido` ainda aceitam novos anexos. `concluida` e `cancelada` continuam somente leitura.
- Rotas existentes `/gestao`, `/campo`, `/documentos`, `/pacote-operacao` permanecem acessíveis.
- Criar OS não altera status de execução, hectares, tanques ou autorizações.

## Validação
- Testes unitários `dronegestor-agrovoo-map-evidence.test.mjs` e `dronegestor-agrovoo-preflight.test.mjs` adicionados à suíte `npm run test:agrodoc`.
- A PR deverá permanecer draft até aprovação de CI/typecheck e homologação com contas fictícias de **gestor, RT e piloto**, incluindo upload de foto/KML/KMZ, tentativa de acesso a OS de outra empresa, e tentativas de escrita após encerramento/cancelamento.
- **Não afirmar homologação E2E** sem executar navegação com as contas específicas e verificar persistência e retorno do upload.
- Testar mobile em seis resoluções reais e recuperação offline, que não foram executadas nesta etapa.
- Testar MAPA, encerramento parcial, preservação hectares/abastecimentos e proteção RLS em rodada de regressão antes de qualquer publicação.

## Próximos passos
1. Confirmar CI, build Vercel da PR e corrigir falhas.
2. Homologar manualmente gestor/RT/piloto fictícios; upload pós-voo do mapa em todos os formatos previstos.
3. Refinar mobile na tela de detalhes e fluxo do piloto, sem alterar segurança operacional.
4. Integrar feedback de pendências na tela de pacote e relatório MAPA com evidências de teste.
