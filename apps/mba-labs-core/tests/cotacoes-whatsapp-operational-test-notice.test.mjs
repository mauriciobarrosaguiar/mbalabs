import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { buildQuotationWhatsappMessage, buildWinnerOrderWhatsappMessage } from '../src/modules/cotacoes/lib/whatsapp/message-templates.ts';

const input = { contactName: 'Representante', companyName: 'Farmácia', link: 'https://example.invalid/test-link' };

test('cotação operacional e pedido vencedor carregam aviso antes do conteúdo comercial', () => {
  for (const build of [buildQuotationWhatsappMessage, buildWinnerOrderWhatsappMessage]) {
    const message = build({ ...input, quotationName: 'TESTE OPERACIONAL MBA LABS — NÃO FATURAR — 20/10/2026' });
    assert.ok(message.startsWith('TESTE OPERACIONAL MBA LABS — NÃO FATURAR.\n'));
    assert.ok(message.includes('Não faturar, separar mercadorias ou realizar entrega.'));
    assert.ok(message.endsWith(input.link));
  }
});

test('cotações comerciais conservam exatamente as mensagens existentes', () => {
  assert.equal(buildQuotationWhatsappMessage({ ...input, quotationName: 'Reposição mensal' }), `Olá Representante, a farmácia Farmácia enviou uma nova cotação pelo MBA Cotações.\n\nPara responder, acesse:\n${input.link}`);
  assert.equal(buildWinnerOrderWhatsappMessage(input), `Olá Representante, a cotação da farmácia Farmácia foi finalizada pelo MBA Cotações.\n\nVocê possui itens vencedores.\n\nAcesse:\n${input.link}`);
});

test('identificação de teste aceita espaços e caixa, sem marcar títulos comerciais semelhantes', () => {
  assert.ok(buildQuotationWhatsappMessage({ ...input, quotationName: '  teste operacional mba labs — homologação' }).startsWith('TESTE OPERACIONAL'));
  for (const quotationName of ['Teste de produto', 'Reposição TESTE OPERACIONAL MBA LABS', 'TESTE OPERACIONAL MBA LABSXYZ']) {
    assert.ok(buildQuotationWhatsappMessage({ ...input, quotationName }).startsWith('Olá '));
  }
});

test('os dois fluxos de envio buscam o nome real da cotação e passam o aviso ao transporte', async () => {
  const sent = [];
  const quotation = { id: 'quote', tenant_id: 'tenant', name: 'TESTE OPERACIONAL MBA LABS — NÃO FATURAR', module_type: 'pharmacy', buyer_company_name: 'Farmácia' };
  const rows = {
    quotations: [quotation], tenants: [{ nome_fantasia: 'Farmácia' }],
    supplier_quote_sessions: [{ supplier_id: 'supplier', seller_name: 'Representante', seller_whatsapp: '00000000000', public_token: 'response-test' }],
  };
  const db = { from(table) {
    let fields;
    const result = () => (rows[table] ?? []).map(row => fields === '*' ? row : Object.fromEntries(fields.split(',').map(key => [key.trim(), row[key.trim()]])));
    const chain = {
      select(value) { fields = value; return chain; }, eq() { return chain; }, neq() { return chain; },
      maybeSingle: async () => ({ data: result()[0] }),
      then(resolve) { return Promise.resolve({ data: result() }).then(resolve); },
    };
    return chain;
  }};
  const source = stripTypeScriptTypes(readFileSync(new URL('../src/modules/cotacoes/lib/whatsapp/mba-cotacoes.ts', import.meta.url), 'utf8'))
    .replace(/^import .*;\s*$/gm, '').replace(/^export /gm, '');
  const context = vm.createContext({
    console, process: { env: {} }, hasSupabaseConfig: () => true, hasSupabaseAdminConfig: () => true,
    createSupabaseAdminClient: () => db, buildQuotationWhatsappMessage, buildWinnerOrderWhatsappMessage,
    capture: async value => { sent.push(value); return { status: 'enviado' }; },
  });
  vm.runInContext(source + '\nsendWhatsAppMbaCotacoes = capture; this.quote = sendQuotationLinksByQuotation; this.winner = sendWinnerOrderLinksByQuotation;', context);
  await context.quote({ quotationId: quotation.id, origin: 'https://example.invalid' });
  await context.winner({ quotationId: quotation.id, origin: 'https://example.invalid', orders: [{ id: 'order', quotationId: quotation.id, tenantId: 'tenant', moduleType: 'pharmacy', supplierId: 'supplier', supplierWhatsapp: '00000000000', publicToken: 'order-test' }] });
  assert.equal(sent.length, 2);
  for (const item of sent) {
    assert.ok(item.mensagem.startsWith('TESTE OPERACIONAL MBA LABS — NÃO FATURAR.'));
    assert.equal(item.vendedorId, 'supplier');
    assert.equal(item.telefone, '00000000000');
  }
});
