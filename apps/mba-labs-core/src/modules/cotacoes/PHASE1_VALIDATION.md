# MBA Cotações — validação da Fase 1

Documento de trabalho da unificação do MBA Cotações no `mba-labs-core`.

A implementação oficial está em `apps/mba-labs-core/src/modules/cotacoes`; o workspace `apps/mba-cotacoes` permanece apenas como referência temporária. Em 12/08/2026 foram validados em produção o fluxo público real de resposta de fornecedor, o alias `/cotacao/responder/[token]`, o tratamento de token inválido e a integridade dos tokens/sessões no banco. O Core também contém geração de pedidos, links públicos de vencedores, upload seguro e integração WhatsApp/Evolution.

Antes de remover o legado ainda é obrigatório executar um teste autenticado completo criando uma nova cotação, enviando resposta final, finalizando, gerando um pedido vencedor ativo, abrindo o link desse pedido e confirmando o envio/reenvio por WhatsApp. Os pedidos históricos hoje existentes pertencem a cotações excluídas e, corretamente, não abrem mais por link público.