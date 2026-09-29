# MBA Cotações — Checklist de Homologação

Data da auditoria: 29/09/2026
Escopo: `apps/mba-labs-core` e schema compartilhado do Supabase relacionado ao MBA Cotações.  
Commit-base analisado: `45fba08` (`origin/main`), com correções no branch `qa/mba-cotacoes-homologacao`.

## Legenda

- **PASSOU**: executado com evidência verificável nesta auditoria.
- **CORRIGIDO**: defeito reproduzido/identificado, corrigido no código local e coberto por validação automatizada; ainda pode depender de deploy/migration.
- **FALHOU**: executado e o resultado foi incorreto.
- **PENDENTE**: não executado integralmente ou depende de sandbox, credencial, navegador ou serviço externo.
- **NÃO VALIDADO**: não houve ambiente seguro ou evidência suficiente para concluir.

## Resultado de liberação

> **BLOQUEADOR DE PRODUÇÃO — NÃO HOMOLOGADO PARA NOVOS CLIENTES AINDA.**

Motivos objetivos:

1. O banco de produção contém vínculos históricos cross-tenant de fornecedores: 11 sessões, 9 respostas, 41 itens de resposta e 3 pedidos.
2. A migration foi aprovada no Supabase QA isolado, mas ainda não foi aplicada em produção; as inconsistências reais continuam presentes.
3. O Preview QA está operacional e o fluxo público real foi exercitado, mas o golden path autenticado completo não foi executado porque a instalação do Chromium do Playwright recebeu arquivo truncado/0 MiB.
4. Evolution API/WhatsApp real não foi validada com número de teste autorizado.

## Checklist funcional

| Item | Resultado | Evidência / observação |
|---|---|---|
| Login | PENDENTE | Supabase Auth real passou com conta QA e senha; tela/login → dashboard ainda não foi executado em navegador. |
| Logout | PENDENTE | Teste Playwright criado; não executado. |
| Cadastro empresa | PENDENTE | Persistência QA passou para 3 empresas/tenants; CRUD pela UI não executado. |
| Usuários | PENDENTE | 9 contas reais no Auth QA, com ADMIN_EMPRESA, COMPRADOR e CONFERENTE; telas de gestão não executadas. |
| Fornecedores | PENDENTE | 18 distribuidores e 18 representantes persistidos; CRUD autenticado pela UI não executado. |
| Representantes | PENDENTE | Massa inclui ativo, inativo e sem WhatsApp; edição/exclusão pela UI não executadas. |
| Produtos | PENDENTE | 180 produtos persistidos no QA; CRUD de tela não executado. |
| Lista de falta | PENDENTE | 36 itens persistidos e isolados; fluxo visual criar/editar/continuar pendente. |
| Criar cotação | CORRIGIDO | Rollback compensatório evita cotação órfã; criação pela UI autenticada ainda não foi executada. |
| Enviar cotação | PENDENTE | Fluxo Playwright criado; envio real pela área autenticada não foi executado. |
| WhatsApp | PENDENTE | Preview QA está com modo teste + mock + allowlist; unidade passou, mas o clique autenticado e a Evolution real não foram validados. |
| Link representante | PASSOU | Token válido abriu somente a cotação/fornecedor corretos; token inválido foi recusado e não houve exposição de dashboard ou concorrentes. |
| Responder cotação | PASSOU | Resposta parcial real enviada pelo Preview; página bloqueou nova edição e permaneceu somente leitura após refresh. |
| Receber resposta | PASSOU | POST real retornou 200; banco QA registrou sessão/resposta `submitted`, 1/10 item precificado e R$ 9,75. Tela autenticada da farmácia permanece pendente. |
| Ranking | PASSOU | Menor preço, empate e exclusão sem estoque passaram em unidade e com preços conhecidos no banco QA. |
| Finalizar | PENDENTE | E2E criado; não executado em sandbox. |
| Vencedores | CORRIGIDO | Atendimento parcial e estoque passaram em testes; persistência QA pendente. |
| Pedido | CORRIGIDO | Totais e idempotência passaram no banco QA; geração pela UI continua pendente. |
| Link ganhador | CORRIGIDO | Tokens QA são únicos e têm 80 caracteres; abertura E2E continua pendente. |
| Dashboard | PENDENTE | Isolamento estático analisado; métricas conhecidas não executadas no QA. |
| Multiempresa | FALHOU | QA passou por RLS, UUID e FK composta; produção ainda contém vínculos históricos cross-tenant. |
| Segurança | FALHOU | QA bloqueou IDOR e referências cruzadas; produção continua bloqueada até migration/deploy. |
| Mobile | PENDENTE | Suíte configurada em 360, 375, 390, 412 e 430 px; não executada. |
| Desktop | PENDENTE | Suíte configurada em 1366×768 e 1920×1080; check público parcial realizado. |
| Build | PASSOU | `next build` limpo concluiu após descartar cache `.next` corrompido. |
| E2E | PENDENTE | 42 casos descobertos: 30 execuções esperadas e 12 skips deliberados do fluxo mutável fora do desktop QA; execução local bloqueada. |

## Validações técnicas

| Validação | Resultado | Evidência |
|---|---|---|
| `npm ci` | PASSOU | 660 pacotes instalados a partir do lockfile. |
| Build da aplicação | PASSOU | Next.js 16.3.3 compilou, typecheck interno e 39 páginas estáticas concluíram. |
| Typecheck `mba-labs-core` | PASSOU | `tsc --noEmit`. |
| Lint MBA Cotações | PASSOU | 0 erros e 0 warnings no escopo. |
| Lint monorepo | FALHOU | 2 erros e 94 warnings preexistentes, principalmente fora do MBA Cotações. |
| Typecheck monorepo | FALHOU | `packages/shared` não declara tipos Node para `process`; fora do escopo funcional. |
| Testes unitários/integração | PASSOU | 19/19 em 5 arquivos. |
| Descoberta Playwright | PASSOU | 42 casos listados em 7 projetos; 30 seriam executados e 12 são skips deliberados. |
| Execução Playwright | PENDENTE | Next local falhou com `uv_interface_addresses`; navegador também não pôde ser instalado no ambiente. |
| Seed sem flag QA | PASSOU | Execução foi bloqueada antes de acessar banco. |
| Seed apontado à produção | PASSOU | Execução foi bloqueada explicitamente pelo project ref de produção. |
| Migration em banco QA | PASSOU | Projeto isolado `ulabbmjxdvxxiybhtgnn`: 25 migrations aplicadas; FK cross-tenant e unique de pedido testadas negativamente; projeto ativo somente para o Preview QA. |
| Supabase Auth QA | PASSOU | Login por senha retornou sessão válida para `comprador.qa.1@example.invalid`. |
| RLS QA | PASSOU | Farmácia A vê 1 tenant próprio; consulta direta pelo UUID da B retorna 0 linhas. |
| Preview Vercel QA | PASSOU | Deploy `dpl_Hhj7hfvujd9uGKMUGPdidZCMpZWj` em READY, apontando exclusivamente ao Supabase QA por variáveis limitadas ao branch. |
| Logs do Preview | PASSOU | Resposta pública POST 200; link válido/recarregado e token inválido GET 200; nenhum erro no deploy corrigido na janela consultada. |
| Supabase Advisors QA | PENDENTE | 4 tabelas com RLS sem policy, 10 helpers `SECURITY DEFINER` executáveis, proteção contra senha vazada desabilitada; performance: 113 FKs sem índice no schema compartilhado, 2 initplans RLS, 12 policies permissivas múltiplas e 1 índice duplicado. |

## Matriz de testes reais

| ID | Fluxo | Resultado | Evidência |
|---|---|---|---|
| UNIT-001 | Menor preço conhecido | PASSOU | Panpharma R$ 9,80 vence 10,00/11,20/10,30. |
| UNIT-002 | Preço sem estoque não vence | PASSOU | Oferta indisponível é excluída. |
| UNIT-003 | Empate de preço | PASSOU | Resposta anterior e fornecedor estabilizam desempate. |
| UNIT-004 | Estoque parcial 20 + 80 | PASSOU | Dois pedidos totalizam 100 unidades/R$ 840,00. |
| UNIT-005 | Subtotal e arredondamento | PASSOU | 3 × R$ 0,10 = R$ 0,30. |
| UNIT-006 | Resposta sem estoque | PASSOU | Status `sem_estoque`, quantidade e total zero. |
| UNIT-007 | Item único sem estoque | PASSOU | Resposta final aceita sem exigir preço. |
| SEC-001 | Token público imprevisível | PASSOU | Dois tokens diferentes com 256 bits aleatórios. |
| SEC-002 | WhatsApp QA sem allowlist | PASSOU | Envio bloqueado. |
| SEC-003 | WhatsApp fora da allowlist | PASSOU | Envio bloqueado. |
| SEC-004 | Redirecionamento ao número QA | PASSOU | Destino autorizado e mock aplicados. |
| SEC-005 | Seed sem modo QA | PASSOU | Fail-closed antes da conexão. |
| SEC-006 | Seed contra produção | PASSOU | Project ref real explicitamente recusado. |
| SEC-007 | Exportação por ID | CORRIGIDO | Autenticação, tenant e módulo exigidos no backend. |
| SEC-008 | Integridade cross-tenant no banco real | FALHOU | Contagens 11/9/41/3 em chaves de fornecedor. |
| SEC-009 | RLS entre Farmácia A e B no QA | PASSOU | Usuário A enxerga somente A; UUID explícito da B retorna 0 linhas. |
| SEC-010 | FK composta cross-tenant | PASSOU | Inserção com tenant B + farmácia A falhou com SQLSTATE 23503. |
| DB-001 | Migration completa no QA | PASSOU | 25 migrations aplicadas em projeto isolado e massa criada. |
| DB-002 | CNPJ empresa/tenant/cotação | PASSOU | 0 divergências em 3 cotações QA. |
| DB-003 | Ranking persistido conhecido | PASSOU | Panpharma vence os 10 itens; 0 divergências. |
| DB-004 | Total do pedido | PASSOU | 0 divergências entre `total_amount` e soma dos itens. |
| DB-005 | Duplo pedido | PASSOU | Segunda inserção rejeitada por `uq_purchase_orders_quotation_supplier`. |
| INT-001 | Golden path de regras | PASSOU | Dois tenants, respostas, ranking e pedidos isolados em memória. |
| E2E-001 | Login → dashboard | PENDENTE | Auth QA passou; execução visual bloqueada pelo runner. |
| E2E-002 | Criar/abrir lista | PENDENTE | Massa QA existe; execução visual bloqueada pelo runner. |
| E2E-003 | Criar cotação da lista | PENDENTE | Estrutura criada; automação autenticada completa aguarda runner de navegador. |
| E2E-004 | Enviar WhatsApp | PENDENTE | Interceptado no golden path; Evolution real não testada. |
| E2E-005 | Representante responder | PASSOU | Formulário público real enviou resposta parcial; POST 200 e persistência QA conferida. |
| E2E-006 | Ranking | PENDENTE | Validado em unidade, mas página real não executada. |
| E2E-007 | Gerar pedido duas vezes | PENDENTE | Banco rejeitou duplicidade; duplo clique visual não executado. |
| E2E-008 | Link vencedor | PENDENTE | Token persistido e único; página não executada. |
| E2E-009 | Duas farmácias simultâneas | PENDENTE | RLS/UUID passaram no QA; dois navegadores simultâneos não executados. |
| WEB-001 | `/cotacoes` anônimo | PASSOU | Redireciona para `/login?next=%2Fcotacoes`. |
| WEB-002 | Token público inválido no Preview QA | PASSOU | Token de 64 zeros exibiu somente mensagem segura, sem formulário nem dashboard. |
| WEB-003 | Overflow da página pública | PASSOU | Check manual público no viewport disponível; matriz móvel ainda pendente. |
| WEB-004 | Reuso após envio | PASSOU | Refresh manteve status “Enviada”, campos e botão de envio desabilitados. |
| WEB-005 | CNPJ/tenant no link público | PASSOU | Página mostrou Drogaria QA Palmas e CNPJ 11.222.333/0001-81, sem dados da Farmácia Sandbox Norte. |
| WEB-006 | Persistência da resposta | PASSOU | Sessão e resposta `submitted`; 1 item com preço 9,7500. |

## Variáveis exigidas (somente nomes)

### Aplicação

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CORE_URL`

### WhatsApp QA

- `WHATSAPP_TEST_MODE`
- `WHATSAPP_TEST_MOCK`
- `WHATSAPP_TEST_ALLOWLIST`
- `WHATSAPP_TEST_DESTINATION`

### Seed e E2E QA

- `MBA_COTACOES_QA`
- `MBA_COTACOES_QA_PASSWORD`
- `SUPABASE_QA_URL`
- `SUPABASE_QA_SERVICE_ROLE_KEY`
- `SUPABASE_QA_PROJECT_REF`
- `MBA_COTACOES_E2E_QA`
- `QA_BASE_URL`
- `QA_ADMIN_EMAIL`

### Integração Efi futura

- `EFI_CLIENT_ID`
- `EFI_CLIENT_SECRET`
- `EFI_CERTIFICATE_PATH`
- `EFI_PIX_KEY`
- `EFI_ENVIRONMENT`

## Gate final obrigatório

- [x] Criar projeto Supabase QA isolado (branch indisponível no plano Free; projeto adicional sem custo mensal).
- [x] Aplicar `20260924134029_harden_cotacoes_qa_and_idempotency.sql` no QA.
- [x] Criar massa QA e confirmar 3 tenants, 9 usuários Auth, 180 produtos, 18 representantes, 6 respostas e 3 pedidos.
- [x] Publicar Preview Vercel apontado exclusivamente ao Supabase QA.
- [x] Configurar `WHATSAPP_TEST_MODE=true`, mock e allowlist fictícia reservada somente no branch QA.
- [ ] Executar a matriz Playwright: 30 execuções esperadas e conferir os 12 skips deliberados.
- [ ] Executar teste de carga com 10 empresas/1.000 produtos/5.000 respostas.
- [ ] Executar `qa:cleanup` após o E2E e provar que dados fora dos tenants QA permaneceram intactos.
- [ ] Fazer backup antes da migration de produção.
- [ ] Aplicar migration de produção e repetir as 14 consultas de integridade; todos os resultados devem ser zero.
- [ ] Fazer deploy da aplicação e repetir smoke test público/autenticado.
