# MBA Cotações — Auditoria QA / Homologação — 30/09/2026

## Escopo executado

Auditoria técnica no workspace canônico `apps/mba-labs-core/src/modules/cotacoes`, usando o projeto Supabase separado **MBA Cotações QA** (`ulabbmjxdvxxiybhtgnn`). Nenhuma alteração foi feita no banco de produção `MBA Labs`.

Commit auditado: `45fba087b4c82dee2277a314960323e586b7cf3f`.

## Resultado das 14 consultas de integridade

As 14 verificações executadas retornaram **0 problemas**:

1. Cotação x farmácia x tenant — 0
2. Itens x cotação — 0
3. Sessões x cotação x fornecedor — 0
4. Respostas x sessão x cotação — 0
5. Itens de resposta x resposta x item — 0
6. Premiações x resposta/item/cotação — 0
7. Pedidos x cotação x fornecedor — 0
8. Itens de pedido x pedido/item — 0
9. Lista de faltas x cotação/tenant — 0
10. Tokens públicos duplicados — 0
11. Total do pedido x soma dos itens — 0
12. Saldos de premiação inválidos — 0
13. Itens de cotação órfãos — 0
14. Envios WhatsApp x cotação/empresa — 0

## Fixture E2E criado no QA

Foi criado um cenário controlado, identificado como **QA E2E**, contendo:

- tenant/farmácia fake;
- comprador fake;
- produto fake;
- fornecedor/vendedor fake;
- nova cotação;
- item da cotação;
- sessão pública do fornecedor;
- resposta final;
- item da resposta;
- premiação;
- pedido vencedor;
- item do pedido;
- item de Lista de Faltas.

Durante a criação, uma proteção de banco bloqueou corretamente a tentativa inicial de inserir resposta em cotação já finalizada. O fixture foi recriado seguindo o fluxo correto: `waiting_responses` → resposta → finalização.

Isso é um **resultado positivo de segurança/integridade**, não um erro.

## WhatsApp

O código canônico possui:

- configuração global;
- health check;
- normalização de telefone;
- envio de mensagem de teste;
- retry para erros transitórios;
- registro de status do envio;
- prevenção de reenvio duplicado;
- envio de links de cotação;
- envio de links de pedido vencedor.

O teste real de disparo **não foi executado**, porque requer instância/provedor e número de teste autorizado. Não foram usados números reais ou credenciais reais no QA.

## Pontos ainda pendentes

### P0 — bloqueador para liberação real

1. Executar o Golden Path autenticado completo no navegador/runner com Chromium.
2. Criar cotação pelo próprio front-end, e não apenas via fixture SQL.
3. Responder pelo link público como fornecedor.
4. Finalizar a cotação pela interface.
5. Gerar novo pedido vencedor pela interface.
6. Abrir o link público do pedido.
7. Conferir/finalizar o pedido pelo fluxo do vendedor.
8. Testar WhatsApp real com número autorizado.
9. Executar smoke test no Preview/produção.

### P1 — segurança/configuração

O projeto QA apresenta avisos do Supabase que precisam ser revisados antes da homologação final:

- 4 tabelas com RLS habilitado sem políticas: `cot_whatsapp_envios`, `cot_whatsapp_global_config`, `notifications`, `payment_settings`.
- 10 funções SECURITY DEFINER executáveis por usuários autenticados.
- Proteção contra senhas vazadas desativada.
- Há diversos avisos de performance, incluindo foreign keys sem índice.
- Existe índice duplicado em `purchase_orders`: `idx_purchase_orders_public_token` e `idx_purchase_orders_token`.

Esses avisos pertencem ao projeto QA e não significam, isoladamente, que o MBA Cotações esteja quebrado. Porém, os itens de segurança devem ser tratados antes da liberação de clientes reais.

## Arquitetura

A documentação do próprio repositório confirma que o módulo canônico é:

`apps/mba-labs-core/src/modules/cotacoes`

O workspace `apps/mba-cotacoes` é legado/referência e não deve receber novas funcionalidades.

## Conclusão

**Status atual: HOMOLOGAÇÃO QA EM ANDAMENTO — NÃO LIBERAR CLIENTES REAIS AINDA.**

O banco QA está com as 14 verificações de integridade em zero e possui fixture E2E controlado.

O próximo bloqueio real não é mais a integridade básica do banco: é provar o fluxo completo pelo navegador, incluindo autenticação, criação real pela UI, resposta pública, geração do pedido, conferência/finalização e WhatsApp autorizado.

Nenhuma alteração de produção foi realizada por esta auditoria.
