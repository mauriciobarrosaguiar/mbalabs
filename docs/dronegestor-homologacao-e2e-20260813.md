# DroneGestor — Homologação ponta a ponta — 2026-08-13

Documento de trabalho da fase de homologação. O teste cobre o fluxo Cliente → Fazenda → Talhão → OS → preparação → campo → segurança → equipamento → SARPAS → execução → finalização → pacote → histórico → relatório mensal.

## Resultado inicial

A estrutura funcional está consistente, mas a homologação encontrou pontos que precisam ser corrigidos antes de cadastrar cliente real:

1. a grade mobile das abas administrativas deve ser aplicada somente à Gestão; regra CSS genérica pode afetar outros grupos horizontais;
2. uma OS em preparação deve permanecer em preparação até o comando explícito de iniciar a operação;
3. o piloto precisa receber um resumo objetivo de pendências antes do botão de iniciar voo;
4. o fechamento precisa direcionar diretamente para Pacote da Operação / Documentos, reduzindo dúvida sobre o próximo passo;
5. mensagens antigas que dizem que relatório/mapa estão em implantação precisam ser removidas, pois os módulos já existem;
6. homologação real em produção deve manter dados de teste identificados e removíveis/inativáveis, sem misturar com operação comercial.

## Cenário de referência

- Cliente: HOMOLOGAÇÃO DRONEGESTOR
- Fazenda: Fazenda Teste Homologação
- Talhão: Talhão A
- Área: 10 ha
- Cultura: Pastagem
- Alvo: Cigarrinha
- Drone: equipamento de teste cadastrado
- Produto: produto de teste com dose informada apenas para validar o fluxo; não representa recomendação agronômica

## Etapas verificadas por código/API

- criação e relacionamento Cliente/Fazenda/Talhão/OS;
- transições de OS: aberta → preparação → em execução → suspensa/retomada → concluída;
- bloqueio de troca de piloto/OS durante execução;
- validações de missão, produto, clima real, área sensível, margem preventiva, GPS, calibração, checklist e SARPAS;
- registro de abastecimentos por área e volume reais;
- bloqueio de conclusão antes de 100% da área;
- fila offline e proteção de conflito de sincronização;
- conclusão da OS ao salvar operação;
- histórico, ficha, pacote documental e relatório mensal.

## Pendências externas à automação disponível

O navegador automatizado deste ambiente não consegue abrir o domínio de produção por política de rede. A validação visual autenticada final precisa ser confirmada no celular real/preview após o deploy; build, banco, rotas e consistência do fluxo são verificados nesta fase sem criar dados falsos permanentes.
