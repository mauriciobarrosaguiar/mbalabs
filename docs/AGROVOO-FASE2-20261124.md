# AgroVoo Fase 2 — implementação inicial isolada (24/11/2026)

**Base**: PR #206, branch `fix/dronegestor-navegacao-integrada-20261122`.
**Branch de trabalho**: `feat/agrovoo-gestao-fase2-20261124`.
**Escopo**: painel Gestão + cadastro progressivo de OS. **Sem migração, merge ou publicação em produção**.

## Rotas
- `/apps/dronegestor`: preservado, oferece botão opcional **Abrir prévia AgroVoo** somente a perfis gestores.
- `/apps/dronegestor/agrovoo`: painel protegido por `requireAppAccess("dronegestor")` + `canManageDroneGestor`; piloto é redirecionado para a lista de OS existente.
- Criação em quatro etapas na mesma rota: **Cliente e área → Serviço → Agendamento → Conferir**.

## Dados de verdade
- Painel usa `/api/dronegestor/painel-gestor`; não exibe números simulados.
- Cliente, fazenda e talhão vêm das APIs `/api/dronegestor/cadastros?type=...`.
- Criação de OS usa POST da API já implementada, que atribui `aberta`, identificador e numeração.
- **Não** envia campos de piloto, aeronave ou receituário antes de haver integração real. Após criar a OS, exibe link ao planejamento existente para completar esses dados.
- A navegação entre passos valida dados no cliente e a API executa novamente suas validações de autorização/relacionamento no servidor.
- Nenhuma consulta de OS do painel muda o checkpoint ativo do piloto.

## Documentação e mapa
- Visibilidade documental no painel sem confundir **ausência de documento registrado** com autorização ou liberação de voo.
- Mantida regra do desenho: evidência aceita por foto/captura do mapa do controle **ou** KML/KMZ, podendo enviar ambos. **A nova tela de upload ainda não foi implementada nesta fase**. Continuam válidas as telas legadas.
- As exigências legais e de segurança operacional continuam independentes do estado dos anexos.

## Limites conhecidos
- Nesta versão, o assistente não persiste rascunhos antes do POST.
- Ainda não refatora a tela de planejamento técnico, a tela de detalhe da OS ou a experiência do piloto.
- Ainda não há testes reais E2E de usuário/sessão nem homologação mobile da nova tela em 6 resoluções.
- Não alterar os fluxos de horas/cargas, encerramento parcial, sincronização ou MAPA até a fase posterior.
- A marca visual completa no shell e o slug público definitivo serão definidos após homologação da jornada.

## Testes automatizados
`node --experimental-strip-types --test tests/dronegestor-agrovoo-wizard.test.mjs`

Cobrem validação de transição dos passos e payload mínimo, inclusive ausência de campo de status/progresso/cargas no cadastro. Esses testes **não substituem** testes de login, endpoint real, E2E, RLS e mobile.

## Critérios para próxima fase
1. Executar CI, build e revisar a UI com uma conta gestora fictícia.
2. Ligar o wizard ao planejamento técnico completo e atribuição de piloto, preservando versionamento.
3. Criar a tela de detalhe da OS com abas e sem destruição de checkpoint.
4. Implementar e testar upload de mapa foto **ou** KML/KMZ com estados offline/sincronizado e permissões por empresa/piloto.
5. Avançar ao **AgroVoo Piloto**, simplificando o fluxo mantendo guardas reais de pré-voo e registro.
