# Checklist de Teste de Producao

## Preparacao

1. Configurar variaveis de ambiente na Vercel.
2. Fazer redeploy sem cache.
3. Rodar migrations no Supabase.
4. Rodar `supabase/seed.sql`.
5. Criar `.env.local` com as variaveis reais.
6. Rodar `npm run setup:admin`.
7. Rodar `npm run check:supabase`.

## Configuracao

1. Entrar em `/login`.
2. Abrir `/app/configuracoes/supabase`.
3. Conferir:
   - `Modo atual`: Supabase.
   - `NEXT_PUBLIC_SUPABASE_URL`: Configurado.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Configurado.
   - `SUPABASE_SERVICE_ROLE_KEY`: Configurado.
4. Abrir `/api/health/supabase` e confirmar `tablesOk: true`.

## Cotacao farmacia

1. Cadastrar fornecedor em `/app/fornecedores`.
2. Criar cotacao em `/app/cotacoes-farmacia/nova`.
3. Adicionar pelo menos 2 produtos.
4. Selecionar fornecedor real.
5. Gerar link publico.
6. Abrir link em aba anonima.
7. Preencher preco, quantidade atendida, prazo e observacao.
8. Salvar rascunho.
9. Enviar resposta final.
10. Reabrir link e confirmar bloqueio de edicao.
11. Abrir `/app/cotacoes-farmacia/[id]/respostas`.
12. Abrir `/app/cotacoes-farmacia/[id]/analise`.
13. Gerar pedido em `/app/cotacoes-farmacia/[id]/pedidos`.
14. Abrir link publico do pedido.

## Licitacao

1. Criar cotacao em `/app/licitacoes/nova`.
2. Adicionar item com quantidade grande.
3. Selecionar 3 fornecedores reais.
4. Gerar links publicos.
5. Responder cada link com embalagem, preco e disponibilidade.
6. Abrir `/app/licitacoes/[id]/analise`.
7. Conferir preco unitario convertido.
8. Conferir atendimento parcial e saldo pendente.
9. Gerar pedidos vencedores.
10. Abrir link publico de cada pedido.

## Vercel

1. Abrir `https://mbacotacoes.vercel.app`.
2. Confirmar que nao aparece modo demo quando Supabase estiver configurado.
3. Confirmar que producao sem Supabase mostra configuracao obrigatoria, nao dados demo falsos.
