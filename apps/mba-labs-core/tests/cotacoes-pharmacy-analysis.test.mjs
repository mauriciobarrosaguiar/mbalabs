import assert from 'node:assert/strict';
import test from 'node:test';
import { generatePurchaseOrders } from '../src/modules/cotacoes/lib/services/purchase-orders.ts';
import { buildPharmacyAnalysis } from '../src/modules/cotacoes/lib/services/pharmacy-analysis.ts';

// Offline regression scenarios; no network, customer data, credentials or messages.
const item = {
  id: 'item-test', tenantId: 'tenant-test', quotationId: 'quotation-test',
  moduleType: 'pharmacy', itemNumber: 1, productName: 'TESTE Losartana 50 mg',
  requestedQuantity: 100, requestedUnit: 'un', laboratoryRequired: false,
  productType: 'generico', acceptEquivalent: false, allowPartialSupply: true,
  msRegistrationRequired: false, status: 'ativo',
};
const response = (id, extra = {}) => ({
  id, tenantId: item.tenantId, quotationId: item.quotationId, sessionId: `session-${id}`,
  supplierId: id, sellerName: `TESTE ${id}`, sellerCompany: 'FICTICIA',
  sellerWhatsapp: '', status: 'submitted', submittedAt: '2026-10-17T10:00:00Z', ...extra,
});
const offer = (id, price, extra = {}) => ({
  id: `offer-${id}`, tenantId: item.tenantId, quotationId: item.quotationId,
  quotationItemId: item.id, responseId: id, supplierId: id,
  unitPrice: price, hasStock: true, availableQuantity: 100,
  offeredProductName: item.productName, ...extra,
});
const analyze = (offers, responses = [response('A'), response('B')], items = [item], distributors = []) =>
  buildPharmacyAnalysis(items, offers, responses, distributors);

test('menor preço válido vence e total corresponde à quantidade', () => {
  const result = analyze([offer('A', 10), offer('B', 9.5)]);
  assert.equal(result.awards[0].supplierId, 'B');
  assert.equal(result.awards[0].totalPrice, 950);
});
test('rascunho não participa do julgamento', () => {
  const result = analyze([offer('A', 1), offer('B', 10)], [response('A', {status:'draft'}), response('B')]);
  assert.equal(result.awards[0].supplierId, 'B');
});
test('preço zero ou negativo não gera vencedor', () => {
  assert.equal(analyze([offer('A', 0), offer('B', -1)]).awards.length, 0);
});
test('representante sem resposta não impede análise de quem enviou', () => {
  const result = analyze([offer('A', 10)], [response('A'), response('B', {status:'opened'})]);
  assert.equal(result.awards.length, 1);
  assert.equal(result.awards[0].supplierId, 'A');
});
test('oferta explicitamente sem estoque não pode vencer', () => {
  const result = analyze([offer('A', 1, {hasStock:false, availableQuantity:0}), offer('B', 10)]);
  assert.equal(result.awards[0].supplierId, 'B');
});
test('quantidade adjudicada não pode exceder a disponibilidade confirmada', () => {
  const result = analyze([offer('A', 1, {availableQuantity:20, hasFullQuantity:false})]);
  const awarded = result.awards.filter(a => a.supplierId === 'A').reduce((sum,a) => sum+a.awardedQuantity,0);
  assert.ok(awarded <= 20, `oferta de 20 recebeu ${awarded}`);
});
test('empate: maior estoque confirmado prevalece sobre ordem de resposta', () => {
  const result = analyze([offer('A', 10, {availableQuantity:100}), offer('B', 10, {availableQuantity:200})],
    [response('A', {submittedAt:'2026-10-17T09:00:00Z'}), response('B')]);
  assert.equal(result.awards[0].supplierId, 'B');
});
test('preço não finito não pode gerar pedido', () => {
  assert.equal(analyze([offer('A', Infinity)]).awards.length, 0);
});
test('pedido mínimo atualmente gera apenas alerta e não elimina vencedor (caracterização)', () => {
  const result = analyze([offer('A', 1, {distributorId:'dist-test'})], [response('A')], [item], [{
    id:'dist-test', tenantId:item.tenantId, nome:'TESTE', unidadeCd:'FICTICIO', uf:'TO',
    pedidoMinimo:500, prazoMedio:'teste', status:'ativo',
  }]);
  assert.equal(result.awards[0].totalPrice,100);
  assert.equal(result.distributorMinimums[0].status,'atenção');
});

test('parciais distribuem somente o saldo sem ultrapassar a demanda', () => {
  const result = analyze([offer('A', 1, {availableQuantity:20}), offer('B', 2)]);
  assert.deepEqual(result.awards.map(a => [a.supplierId,a.awardedQuantity]), [['A',20],['B',80]]);
  assert.equal(result.awards.reduce((s,a) => s+a.totalPrice,0),180);
  assert.equal(result.awards.at(-1).remainingBalanceAfter,0);
});
test('parcial desativada exige atendimento integral', () => {
  const result = analyze([offer('A',1,{availableQuantity:20}),offer('B',2)], undefined,
    [{...item,allowPartialSupply:false}]);
  assert.deepEqual(result.awards.map(a => [a.supplierId,a.awardedQuantity]),[['B',100]]);
});
test('saldo descoberto permanece explícito', () => {
  const result = analyze([offer('A',1,{availableQuantity:20})]);
  assert.equal(result.awards[0].remainingBalanceAfter,80);
  assert.equal(result.awards[0].status,'partial');
});
test('oferta antiga somente com preço mantém compatibilidade', () => {
  const result=analyze([offer('A',1,{availableQuantity:undefined,hasStock:undefined,hasFullQuantity:undefined})]);
  assert.equal(result.awards[0].awardedQuantity,100);
});
test('estoque zero explícito é excluído mesmo com preço preenchido', () => {
  assert.equal(analyze([offer('A',1,{availableQuantity:0})]).awards.length,0);
});
test('parcial declarada sem quantidade não presume atendimento integral', () => {
  assert.equal(analyze([offer('A',1,{availableQuantity:undefined,hasFullQuantity:false})]).awards.length,0);
});
test('quantidades inválidas são excluídas do ranking e dos pedidos', () => {
  for (const quantity of [-1, NaN, Infinity]) {
    const result=analyze([offer('A',1,{availableQuantity:quantity})]);
    assert.equal(result.awards.length,0);
    assert.equal(result.ranking.length,0);
  }
});
test('demanda inválida não gera pedido', () => {
  for(const requestedQuantity of [0,-1,NaN,Infinity]) {
    assert.equal(analyze([offer('A',1)],undefined,[{...item,requestedQuantity}]).awards.length,0);
  }
});


test('análise para pedidos preserva as duas parcelas vencedoras', () => {
  const offers=[offer('A',1,{availableQuantity:20}),offer('B',2)];
  const analysis=analyze(offers);
  const orders=generatePurchaseOrders(analysis.awards,[item],offers);
  assert.equal(orders.length,2);
  assert.deepEqual(orders.map(o => [o.supplierId,o.items[0].quantityToBuy]),[['A',20],['B',80]]);
  assert.equal(orders.reduce((sum,o) => sum+o.totalAmount,0),180);
});
test('parcial isolada gera pedido só da quantidade disponível', () => {
  const offers=[offer('A',1,{availableQuantity:20})];
  const orders=generatePurchaseOrders(analyze(offers).awards,[item],offers);
  assert.equal(orders[0].items[0].quantityToBuy,20);
  assert.equal(orders[0].totalAmount,20);
});
test('repetição do mesmo resultado não duplica linha de pedido', () => {
  const offers=[offer('A',1)];
  const awards=analyze(offers).awards;
  const orders=generatePurchaseOrders([...awards,...awards],[item],offers);
  assert.equal(orders[0].items.length,1);
  assert.equal(orders[0].totalAmount,100);
});
