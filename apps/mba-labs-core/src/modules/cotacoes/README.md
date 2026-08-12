# MBA Cotações — implementação canônica

Este diretório é a **fonte oficial do MBA Cotações dentro do MBA Labs**.

## Arquitetura

- Lógica de negócio, componentes e integrações: `src/modules/cotacoes`
- Rotas autenticadas da aplicação: `src/app/cotacoes`
- APIs do módulo: `src/app/api/cotacoes`
- Entrada pelo catálogo do MBA Labs: `/apps/mbacotacoes`
- Destino operacional: `/cotacoes`
- Aliases públicos preservados: `/cotacao/*` e `/licitacao/*`

O acesso deve permanecer integrado ao Core do MBA Labs, respeitando usuário, empresa, assinatura e permissões.

## Workspace legado

Existe temporariamente uma cópia histórica em:

```text
apps/mba-cotacoes
```

Ela é somente referência de paridade durante a Fase 1 e não deve receber novas funcionalidades. Os comandos legados terminam em `:legacy`.

## Inventário da unificação

A comparação confirmou que o Core é, em geral, a implementação mais nova e completa. Entre as diferenças relevantes:

- Core possui `lib/auth/quotation-access.ts`;
- Core possui `components/security/safe-file-upload-boundary.tsx`;
- Core possui `components/settings/whatsapp-settings-page.tsx`;
- Core possui `lib/whatsapp/evolution-status-webhook.ts`;
- Core possui versões mais novas de `dashboard/pages.tsx`, `new-quotation-form.tsx`, `quotation-page-actions.tsx`, `supplier-links-table.tsx`, `app-shell.tsx`, repositórios e serviços operacionais;
- o workspace legado possui `lib/actions/auth.ts`, necessário apenas quando o app rodava isoladamente e, portanto, não deve ser migrado para o Core;
- a listagem legada mantém alguns atalhos de conveniência no menu da tabela que não estão na mesma posição no Core, mas as funções correspondentes continuam disponíveis no fluxo atual.

## Validações já concluídas

Em 12/08/2026 foram validados:

- build/deploy do Core em Vercel;
- fluxo público real de resposta de fornecedor em produção;
- alias `/cotacao/responder/[token]` usado pelos links enviados;
- tratamento seguro de token inválido;
- presença das rotas públicas de pedido `/cotacao/pedido/[token]`, `/licitacao/pedido/[token]` e `/cotacoes/pedido/[token]`;
- integridade de tokens e relacionamentos no Supabase, sem tokens duplicados/ausentes nem desencontros de tenant/cotação/sessão/resposta nos dados auditados;
- código de geração de pedidos e envio/reenvio do link vencedor por WhatsApp no Core.

Os pedidos históricos atualmente existentes no banco pertencem a cotações excluídas e, corretamente, não podem mais ser abertos pelo link público. Por isso ainda falta gerar um **novo pedido ativo** em um teste autenticado para validar visualmente a etapa final.

Detalhes: `PHASE1_VALIDATION.md`.

## Itens que ainda precisam de validação antes da remoção do legado

Antes de apagar `apps/mba-cotacoes`:

- executar um teste autenticado completo criando uma nova cotação no Core;
- enviar pelo menos uma resposta final válida;
- finalizar a cotação e gerar um pedido vencedor novo;
- abrir o link público do pedido ativo e validar a conferência/finalização pelo vendedor;
- confirmar envio/reenvio WhatsApp no ambiente configurado;
- decidir quais fixtures/seeds históricos ainda merecem ser preservados;
- remover o workspace legado somente em PR separado, com build e smoke test após a remoção.

Nenhum arquivo do Core deve ser substituído pela versão legada em bloco. Migrações devem ser pontuais e somente quando uma função ausente for confirmada.

## Critério de conclusão da Fase 1

A unificação só estará concluída quando:

1. a paridade funcional estiver verificada;
2. todos os links públicos e aliases usados por clientes estiverem preservados;
3. o fluxo completo de cotação e pedido passar nos testes;
4. Preview Vercel estiver limpo;
5. não houver referência de produção dependente do workspace legado;
6. documentação/testes úteis estiverem preservados;
7. o workspace `apps/mba-cotacoes` puder ser removido com segurança;
8. workspaces, scripts e `package-lock.json` forem atualizados de forma reproduzível.

## Regra de desenvolvimento

Toda nova correção ou funcionalidade do MBA Cotações deve ser implementada aqui ou nas rotas/APIs correspondentes do `mba-labs-core`.
