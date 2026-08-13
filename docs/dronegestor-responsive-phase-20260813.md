# DroneGestor — fase de responsividade e padronização — 13/08/2026

## Objetivo

Eliminar estouro horizontal, texto ampliado indevidamente no Android, navegação duplicada e controles comprimidos no fluxo mobile antes da homologação ponta a ponta.

## Ajustes desta fase

- `-webkit-text-size-adjust: 100%` e `text-size-adjust: 100%` no layout autenticado do DroneGestor.
- Proteção global contra estouro de títulos, cards, botões, links, inputs e uploads.
- Títulos H1 responsivos em telas até 640 px e ajuste adicional abaixo de 380 px.
- Abas administrativas com botões passam de faixa horizontal para grade 2x2 em celulares.
- Pares de campos técnicos com colunas rígidas passam para uma coluna em telas estreitas.
- Barra mobile global fica oculta dentro de `/campo`, deixando somente a navegação operacional da missão.
- Item global `Segurança` passa a `Regras` para não se confundir com a etapa de segurança da missão.
- Cabeçalho de Drones e equipamentos reduzido e protegido contra quebra/zoom agressivo.
- Biblioteca de produtos: busca em uma coluna no celular, botão de busca em largura total e retorno para a home do DroneGestor.
- Regulatório: UF passa a ser carregada automaticamente da missão/OS ativa quando disponível.

## Matriz mínima de QA mobile

Testar pelo menos em larguras CSS aproximadas de 320, 360, 390, 412 e 768 px.

### `/apps/dronegestor`
- Nenhum título ou card ultrapassa a viewport.
- Barra inferior tem 5 itens legíveis.
- Menu Mais abre e rola sem ficar escondido pela área segura do Android/iOS.

### `/apps/dronegestor/gestao`
- Ordens de serviço, Clientes, Fazendas e Talhões aparecem em grade 2x2 no celular.
- Botões Abrir campo e Histórico quebram de forma segura quando necessário.
- Formulários e selects permanecem dentro da tela.

### `/apps/dronegestor/equipamentos`
- `Drones e equipamentos` cabe integralmente sem corte lateral.
- Formulário não gera rolagem horizontal.
- Cards de equipamentos permanecem legíveis com fonte do sistema ampliada.

### `/apps/dronegestor/campo`
- Apenas uma navegação inferior fica visível.
- Dose/unidade não ficam comprimidas em telas estreitas.
- Modais de drone, produto e mapa ficam acima da navegação operacional.
- Botão flutuante de mapa não cobre ações principais.

### `/apps/dronegestor/regulacao`
- Estado da operação reflete a UF da missão ativa quando houver.
- Cards de regra quebram texto sem rolagem horizontal.

### `/apps/dronegestor/produtos`
- Busca e botão ficam empilhados no celular.
- Selo de status não comprime o nome do produto.
- Botão voltar retorna à home do DroneGestor.

### Demais páginas
- Documentos, pacote, fichas, perfil e relatório mensal não devem gerar overflow no corpo da página.
- Tabelas administrativas podem usar rolagem horizontal dentro do próprio contêiner, nunca no `body`.

## Critério para próxima fase

Depois de o preview passar build, executar uma homologação ponta a ponta com uma OS de teste completa: cliente → fazenda → talhão → drone → OS → campo → produto → mapa → segurança → calibração → checklist → SARPAS → aplicação → abastecimentos → conclusão → ficha → pacote → relatório mensal/XLSX.
