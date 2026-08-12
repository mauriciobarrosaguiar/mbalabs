# MBA Cotações — implementação canônica

Este diretório é a **fonte oficial do MBA Cotações dentro do MBA Labs**.

## Arquitetura

- Lógica de negócio, componentes e integrações: `src/modules/cotacoes`
- Rotas autenticadas da aplicação: `src/app/cotacoes`
- APIs do módulo: `src/app/api/cotacoes`
- Entrada pelo catálogo do MBA Labs: `/apps/mbacotacoes`
- Destino operacional: `/cotacoes`

O acesso deve permanecer integrado ao Core do MBA Labs, respeitando usuário, empresa, assinatura e permissões.

## Workspace legado

Existe temporariamente uma cópia histórica em:

```text
apps/mba-cotacoes
```

Ela é somente referência de paridade durante a Fase 1 e não deve receber novas funcionalidades. Os comandos legados terminam em `:legacy`.

## Inventário inicial da unificação

A comparação inicial confirmou que o Core já é, em geral, a implementação mais nova e completa. Entre as diferenças relevantes encontradas:

- Core possui `lib/auth/quotation-access.ts`;
- Core possui `components/security/safe-file-upload-boundary.tsx`;
- Core possui `components/settings/whatsapp-settings-page.tsx`;
- Core possui `lib/whatsapp/evolution-status-webhook.ts`;
- Core possui versões maiores/mais novas de `dashboard/pages.tsx`, `new-quotation-form.tsx`, `quotation-page-actions.tsx`, `supplier-links-table.tsx`, `app-shell.tsx`, repositórios e serviços operacionais;
- o workspace legado possui `lib/actions/auth.ts`, necessário apenas quando o app rodava isoladamente e, portanto, não deve ser migrado para o Core.

## Itens que ainda precisam de comparação antes da remoção do legado

Antes de apagar `apps/mba-cotacoes`, verificar explicitamente qualquer arquivo legado que seja maior ou tenha comportamento diferente, em especial:

- `components/quotations/demo-quotation-table.tsx`;
- `components/quotations/generate-purchase-orders-button.tsx`;
- documentação, scripts e eventuais testes do workspace legado;
- aliases de API e compatibilidade com links antigos.

Nenhum arquivo do Core deve ser substituído pela versão legada em bloco. Migrações devem ser pontuais e somente quando a função ausente for confirmada.

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
