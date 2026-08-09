# DroneGestor Agro — estado técnico atual

## Persistência em produção

O DroneGestor já possui persistência real no Supabase usado pelo MBA Labs, utilizando temporariamente `core_logs` para:

- estado de campo do piloto;
- configurações da empresa;
- clientes, fazendas, talhões e ordens de serviço;
- operações concluídas e histórico.

A sincronização V3 usa revisão controlada pelo servidor (`baseRevision` / `revision`). Divergências entre aparelhos geram conflito explícito e nenhuma cópia é sobrescrita silenciosamente.

O estado local continua sendo mantido para operação com sinal fraco/offline. Conclusões offline ficam em fila própria e não são apagadas ao iniciar uma nova missão.

## Fluxo operacional V3

- OS: aberta → preparação → em execução → concluída/cancelada.
- A OS em preparação recebe piloto responsável e não pode ser assumida silenciosamente por outro piloto.
- O status muda para `em_execucao` somente quando o piloto efetivamente inicia a operação após Segurança, Calibração, Checklist e SARPAS.
- Missão concluída ou aguardando sincronização fica congelada e não pode ser reiniciada.
- Progresso da operação é registrado por abastecimento com área realmente tratada e volume realmente consumido; não é mais somado automaticamente pela capacidade teórica do tanque.
- O último tanque parcial calcula também a quantidade de cada produto.

## Segurança e dados técnicos

- GPS e modelo meteorológico são separados da medição real de campo.
- Vento, direção, temperatura e umidade de campo possuem confirmação e faixas de validação.
- A margem preventiva interna da empresa pode ser configurada como bloqueio obrigatório; ela não é apresentada como regra legal.
- O servidor revalida margem, confirmações, produtos, clima, GPS, calibração, checklist e SARPAS antes de aceitar a conclusão.
- O registro final inclui início/término, identificação ANAC, tipo/modelo de ponta/atomizador, coordenada GPS, produtos, área e volume reais registrados.
- Perfis piloto recebem pela API de OS apenas dados operacionais mínimos; dados administrativos como CPF/CNPJ, telefone e e-mail não são carregados.
- ADMIN/RT possui visão consolidada do histórico da empresa.

## Histórico

O histórico é consultado por páginas e aceita filtro de período. O CSV usa a mesma base e separa dados planejados dos registrados em campo. Ele continua identificado apenas como base de conferência e não como relatório mensal oficial do MAPA.

## Arquitetura definitiva ainda pendente

A migration `supabase/migrations/20260808151500_dronegestor_core.sql` continua apenas preparada e NÃO foi aplicada ao banco de produção.

O projeto de produção usa o Supabase `jrbkojhnltqfqwpczwuw`. Antes de migrar o DroneGestor de `core_logs` para tabelas próprias, é necessário acesso administrativo ao projeto correto e revisão de RLS baseada no vínculo real `core_usuarios` / `core_empresas`.

A estrutura definitiva deverá contemplar, no mínimo:

- equipamentos;
- protocolos;
- regras regulatórias versionadas;
- clientes;
- fazendas;
- talhões e polígonos;
- ordens de serviço;
- missões/operações;
- eventos imutáveis;
- anexos/mapas/receituários;
- permissões por empresa e papel.

Não aplicar a migration em outro projeto Supabase.

## Próximos módulos

1. mapa real com polígono do talhão, áreas sensíveis, buffers e vetor de vento;
2. importação DJI AGRAS / KML / KMZ / GeoJSON, após validar arquivos reais exportados pelo equipamento;
3. cadastro técnico de equipamentos com limites operacionais;
4. motor regulatório por UF/produto com fontes e vigência;
5. geração do relatório mensal no modelo oficial vigente, mantendo o protocolo/envio oficial separado quando não houver integração oficial.
