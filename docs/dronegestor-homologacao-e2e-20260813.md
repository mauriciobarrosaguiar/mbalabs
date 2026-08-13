# DroneGestor — Homologação ponta a ponta — 2026-08-13

Esta fase valida o fluxo Cliente → Fazenda → Talhão → OS → preparação → campo → segurança → equipamento → SARPAS → execução → finalização → pacote → histórico → relatório mensal.

## Pontos encontrados

1. A grade mobile das abas administrativas deve ser aplicada somente à Gestão; uma regra CSS genérica pode afetar outros grupos horizontais.
2. A OS deve permanecer em preparação até o comando explícito de iniciar a aplicação.
3. Antes de iniciar o voo, o piloto precisa enxergar as pendências em linguagem direta.
4. Após finalizar, o caminho deve levar claramente ao Pacote da Operação e à Central de Documentos.
5. Textos antigos que dizem que mapa/relatório mensal ainda estão em implantação devem ser removidos.
6. Dados de homologação não devem ser misturados com operação comercial.

## Verificações técnicas

- relacionamentos Cliente/Fazenda/Talhão/OS;
- ciclo de OS aberta → preparação → execução → suspensão/retomada → conclusão;
- proteção contra troca de OS durante execução;
- missão, produto, clima real, área sensível, margem preventiva, GPS, calibração, checklist e SARPAS;
- abastecimentos por área e volume reais;
- bloqueio de conclusão antes de 100% da área;
- fila offline e conflito de sincronização;
- conclusão da OS junto com a operação;
- histórico, ficha, pacote e relatório mensal.

## Limite da automação desta sessão

O navegador automatizado do ambiente não consegue abrir o domínio de produção por política de rede. A camada visual autenticada final deve ser confirmada no aparelho real após o deploy; build, banco, rotas e consistência do fluxo são verificados sem criar dados falsos permanentes.
